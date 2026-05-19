import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  setDoc,
  query,
  where,
  limit
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Cache settings for singleton config
let appConfig = {
  excelSheetName: "Ventas_Master",
  excelFileName: "inventario_consolidado.xlsx"
};

// Seed function for empty database
async function seedDatabase() {
  const productsCol = collection(db, "products");
  const snapshot = await getDocs(query(productsCol, limit(1)));
  if (snapshot.empty) {
    console.log("Seeding initial products...");
    const initialProducts = [
      {name:"Arroz blanco 500g",category:"Granos",price:3200,cost:2000,stock:45,minStock:10},
      {name:"Aceite vegetal 1L",category:"Aceites",price:8500,cost:6000,stock:3,minStock:8},
      {name:"Leche entera 1L",category:"Lácteos",price:3800,cost:2800,stock:18,minStock:15},
      {name:"Azúcar blanca 1kg",category:"Endulzantes",price:4200,cost:3000,stock:7,minStock:10},
      {name:"Harina de trigo 1kg",category:"Granos",price:3500,cost:2500,stock:22,minStock:8},
      {name:"Jabón de baño",category:"Aseo",price:2800,cost:1800,stock:2,minStock:6},
      {name:"Papel higiénico x4",category:"Aseo",price:6500,cost:4500,stock:14,minStock:10},
      {name:"Café molido 500g",category:"Bebidas",price:12000,cost:8500,stock:9,minStock:5},
    ];
    for (const p of initialProducts) {
      await addDoc(productsCol, p);
    }
  }

  const configDoc = doc(db, "config", "global");
  const configSnap = await getDoc(configDoc);
  if (configSnap.exists()) {
    appConfig = configSnap.data() as any;
  } else {
    await setDoc(configDoc, appConfig);
  }
}

seedDatabase().catch(console.error);

// Gemini API setup
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

// API Routes
app.get("/api/products", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    const productsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(productsList);
  } catch (err) {
    res.status(500).json({ error: "No se pudieron obtener productos" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const docRef = await addDoc(collection(db, "products"), data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (err) {
    res.status(500).json({ error: "Error al crear producto" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { id: _, ...data } = req.body;
    const docRef = doc(db, "products", id);
    await updateDoc(docRef, data);
    res.json({ id, ...data });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(db, "products", id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

app.get("/api/sales", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "sales"));
    const salesList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(salesList);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener ventas" });
  }
});

app.post("/api/sales", async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const docRef = await addDoc(collection(db, "sales"), data);
    const savedSale = { id: docRef.id, ...data };
    
    // Update local product stock
    if (data.productId) {
      const productRef = doc(db, "products", data.productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const currentData = productSnap.data();
        const newStock = (currentData.stock || 0) - (newSale.quantity || 0);
        await updateDoc(productRef, { stock: Math.max(0, newStock) });
      }
    }

    // Logic to "feed" the Excel file (Note: serverless might not persist files, but we keep the logic)
    updateExcelFile(savedSale);
    
    res.status(201).json(savedSale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar venta" });
  }
});

app.delete("/api/sales/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(db, "sales", id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar venta" });
  }
});

app.get("/api/config", (req, res) => {
  res.json(appConfig);
});

app.post("/api/config", async (req, res) => {
  try {
    appConfig = { ...appConfig, ...req.body };
    await setDoc(doc(db, "config", "global"), appConfig);
    res.json(appConfig);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar config" });
  }
});

// AI Assistant Endpoint
app.post("/api/ai/query", async (req, res) => {
  const { prompt } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada" });
  }

  try {
    const productsSnap = await getDocs(collection(db, "products"));
    const salesSnap = await getDocs(collection(db, "sales"));
    
    const productsList = productsSnap.docs.map(d => d.data());
    const salesList = salesSnap.docs.map(d => d.data());

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const inventorySummary = `
      Productos: ${productsList.length}
      Ventas totales: ${salesList.length}
      Stock bajo: ${productsList.filter((p: any) => p.stock <= p.minStock).map((p: any) => p.name).join(", ")}
      Detalles: ${JSON.stringify(productsList.map((p: any) => ({ n: p.name, s: p.stock, m: p.minStock })))}
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
app.get("/api/export", async (req, res) => {
  const filePath = path.join(process.cwd(), appConfig.excelFileName);
  
  try {
    const snapshot = await getDocs(collection(db, "sales"));
    const salesList = snapshot.docs.map(d => d.data());
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(salesList);
    XLSX.utils.book_append_sheet(wb, ws, appConfig.excelSheetName);
    XLSX.writeFile(wb, filePath);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: "Error al exportar datos" });
  }
});

function updateExcelFile(newSale: any) {
  // This logic is mostly for local dev as serverless files are transient
  const filePath = path.join(process.cwd(), appConfig.excelFileName);
  let wb;
  if (fs.existsSync(filePath)) {
    wb = XLSX.readFile(filePath);
  } else {
    wb = XLSX.utils.book_new();
  }

  let ws = wb.Sheets[appConfig.excelSheetName];
  let data: any[] = [];
  if (ws) {
    data = XLSX.utils.sheet_to_json(ws);
  }
  
  data.push(newSale);
  const newWs = XLSX.utils.json_to_sheet(data);
  
  if (wb.SheetNames.includes(appConfig.excelSheetName)) {
    wb.Sheets[appConfig.excelSheetName] = newWs;
  } else {
    XLSX.utils.book_append_sheet(wb, newWs, appConfig.excelSheetName);
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
