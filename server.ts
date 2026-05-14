import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory "database" (for a real app, use Firestore or a DB)
let products = [
  {id:"1",name:"Arroz blanco 500g",category:"Granos",price:3200,cost:2000,stock:45,minStock:10},
  {id:"2",name:"Aceite vegetal 1L",category:"Aceites",price:8500,cost:6000,stock:3,minStock:8},
  {id:"3",name:"Leche entera 1L",category:"Lácteos",price:3800,cost:2800,stock:18,minStock:15},
  {id:"4",name:"Azúcar blanca 1kg",category:"Endulzantes",price:4200,cost:3000,stock:7,minStock:10},
  {id:"5",name:"Harina de trigo 1kg",category:"Granos",price:3500,cost:2500,stock:22,minStock:8},
  {id:"6",name:"Jabón de baño",category:"Aseo",price:2800,cost:1800,stock:2,minStock:6},
  {id:"7",name:"Papel higiénico x4",category:"Aseo",price:6500,cost:4500,stock:14,minStock:10},
  {id:"8",name:"Café molido 500g",category:"Bebidas",price:12000,cost:8500,stock:9,minStock:5},
];

let sales: any[] = [
  {
    id: "sale-init",
    productId: "1",
    productName: "Arroz blanco 500g",
    quantity: 2,
    price: 3200,
    total: 6400,
    timestamp: new Date().toLocaleString(),
    status: "Entregado",
    trackingNumber: "TRK-12345"
  }
];
let config = {
  excelSheetName: "Ventas_Master",
  excelFileName: "inventario_consolidado.xlsx"
};

// Gemini API setup for assistant
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

// API Routes
app.get("/api/products", (req, res) => {
  res.json(products);
});

app.post("/api/products", (req, res) => {
  const newProduct = {
    ...req.body,
    id: Math.random().toString(36).substr(2, 9)
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

app.put("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const index = products.findIndex(p => p.id === id);
  if (index !== -1) {
    products[index] = { ...products[index], ...req.body, id };
    res.json(products[index]);
  } else {
    res.status(404).json({ error: "Producto no encontrado" });
  }
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  products = products.filter(p => p.id !== id);
  res.status(204).send();
});

app.get("/api/sales", (req, res) => {
  res.json(sales);
});

app.post("/api/sales", (req, res) => {
  const newSale = req.body;
  sales.push(newSale);
  
  // Logic to "feed" the Excel file
  updateExcelFile(newSale);
  
  res.status(201).json(newSale);
});

app.patch("/api/sales/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const saleIndex = sales.findIndex(s => s.id === id);
  if (saleIndex !== -1) {
    sales[saleIndex] = { ...sales[saleIndex], ...updates };
    // Potentially re-sync the whole Excel or just track it
    res.json(sales[saleIndex]);
  } else {
    res.status(404).json({ error: "Venta no encontrada" });
  }
});

app.delete("/api/sales/:id", (req, res) => {
  const { id } = req.params;
  sales = sales.filter(s => s.id !== id);
  res.status(204).send();
});

app.get("/api/config", (req, res) => {
  res.json(config);
});

app.post("/api/config", (req, res) => {
  config = { ...config, ...req.body };
  res.json(config);
});

// AI Assistant Endpoint
app.post("/api/ai/query", async (req, res) => {
  const { prompt } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const inventorySummary = `
      Productos: ${products.length}
      Ventas totales: ${sales.length}
      Stock bajo: ${products.filter(p => p.stock <= p.minStock).map(p => p.name).join(", ")}
      Detalles: ${JSON.stringify(products.map(p => ({ n: p.name, s: p.stock, m: p.minStock })))}
    `;

    const result = await model.generateContent([
      `Eres un experto en inventarios. Analiza estos datos: ${inventorySummary}. Responde a la pregunta del usuario de forma profesional y concisa en español.`,
      prompt
    ]);
    const response = await result.response;
    res.json({ answer: response.text() });
  } catch (error) {
    console.error("Error AI:", error);
    res.status(500).json({ error: "Error procesando consulta IA" });
  }
});

// Excel Download
app.get("/api/export", (req, res) => {
  const filePath = path.join(process.cwd(), config.excelFileName);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    // Generate it if it doesn't exist
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sales);
    XLSX.utils.book_append_sheet(wb, ws, config.excelSheetName);
    XLSX.writeFile(wb, filePath);
    res.download(filePath);
  }
});

function updateExcelFile(newSale: any) {
  const filePath = path.join(process.cwd(), config.excelFileName);
  let wb;
  if (fs.existsSync(filePath)) {
    wb = XLSX.readFile(filePath);
  } else {
    wb = XLSX.utils.book_new();
  }

  let ws = wb.Sheets[config.excelSheetName];
  let data: any[] = [];
  if (ws) {
    data = XLSX.utils.sheet_to_json(ws);
  }
  
  data.push(newSale);
  const newWs = XLSX.utils.json_to_sheet(data);
  
  // Replace or add the sheet
  if (wb.SheetNames.includes(config.excelSheetName)) {
    wb.Sheets[config.excelSheetName] = newWs;
  } else {
    XLSX.utils.book_append_sheet(wb, newWs, config.excelSheetName);
  }

  XLSX.writeFile(wb, filePath);
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
