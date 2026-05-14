import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Box, 
  Receipt, 
  Bell, 
  Bot, 
  Plus, 
  FileSpreadsheet, 
  Send,
  Trash2,
  Edit2,
  CheckCircle2,
  TriangleAlert,
  Search,
  Settings,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Sale, OrderStatus, AppConfig } from './types.ts';

// Modal Component
const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0d0d0d] rounded-sm shadow-2xl w-full max-w-md overflow-hidden border border-white/10"
        >
          <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h3 className="font-serif italic text-lg text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>
          <div className="p-8">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'sales' | 'alerts' | 'assistant' | 'settings'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [config, setConfig] = useState<AppConfig>({ excelSheetName: 'Ventas_Master', excelFileName: 'inventario_consolidado.xlsx' });
  const [searchTerm, setSearchTerm] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 5
  });

  // Fetch data
  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
    fetch('/api/sales').then(res => res.json()).then(setSales);
    fetch('/api/config').then(res => res.json()).then(setConfig);
  }, []);

  const handleSaveProduct = async () => {
    const method = editingProduct ? 'PUT' : 'POST';
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productForm)
    });

    if (res.ok) {
      const saved = await res.json();
      if (editingProduct) {
        setProducts(products.map(p => p.id === saved.id ? saved : p));
      } else {
        setProducts([...products, saved]);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductForm({ name: '', category: '', price: 0, cost: 0, stock: 0, minStock: 5 });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este producto?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        category: product.category,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        minStock: product.minStock
      });
    } else {
      setEditingProduct(null);
      setProductForm({ name: '', category: '', price: 0, cost: 0, stock: 0, minStock: 5 });
    }
    setIsProductModalOpen(true);
  };

  const handleAddSale = async (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) return;

    const newSale: Partial<Sale> = {
      id: Math.random().toString(36).substr(2, 9),
      productId,
      productName: product.name,
      quantity,
      price: product.price,
      total: product.price * quantity,
      timestamp: new Date().toLocaleString(),
      status: 'Pendiente',
      trackingNumber: ''
    };

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSale)
    });

    if (res.ok) {
      const savedSale = await res.json();
      setSales([...sales, savedSale]);
      // Update local stock
      setProducts(products.map(p => p.id === productId ? { ...p, stock: p.stock - quantity } : p));
    }
  };

  const handleUpdateSaleStatus = async (saleId: string, status: OrderStatus, trackingNumber?: string) => {
    const res = await fetch(`/api/sales/${saleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, trackingNumber })
    });

    if (res.ok) {
      const updatedSale = await res.json();
      setSales(sales.map(s => s.id === saleId ? updatedSale : s));
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm('¿Seguro que desea eliminar este registro de venta?')) return;
    const res = await fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
    if (res.ok) {
      setSales(sales.filter(s => s.id !== saleId));
    }
  };

  const askAi = async (prompt: string) => {
    setIsAiLoading(true);
    setAiResponse('Analizando datos...');
    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setAiResponse(data.answer);
    } catch (e) {
      setAiResponse('Error al consultar a la IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExport = () => {
    window.location.href = '/api/export';
  };

  const updateConfig = async (newConfig: AppConfig) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    if (res.ok) setConfig(newConfig);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0d0d0d] border-r border-white/10 flex flex-col">
        <div className="px-8 py-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-sm flex items-center justify-center text-black font-serif italic text-xl">I</div>
          <h1 className="font-serif italic text-2xl tracking-tight text-white leading-none">Inven<span className="opacity-50">IA</span></h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'inventory', icon: Box, label: 'Inventario' },
            { id: 'sales', icon: Receipt, label: 'Ventas y Pedidos' },
            { id: 'alerts', icon: Bell, label: 'Alertas', badge: products.filter(p => p.stock <= p.minStock).length },
            { id: 'assistant', icon: Bot, label: 'Asistente IA' },
            { id: 'settings', icon: Settings, label: 'Configuración' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group ${
                activeTab === item.id 
                ? 'bg-white/5 text-white border border-white/10 shadow-sm shadow-white/5' 
                : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full transition-all ${activeTab === item.id ? 'bg-white scale-100' : 'bg-transparent border border-gray-600 scale-75 group-hover:border-white'}`} />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
        
        <div className="p-6 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 mb-4">
            <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Excel Hub</h3>
            <div className="space-y-2">
               <div>
                  <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Target</p>
                  <p className="text-[11px] font-mono truncate text-white/70">{config.excelFileName}</p>
               </div>
            </div>
          </div>
          <button 
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded text-[11px] uppercase tracking-widest font-bold hover:bg-gray-100 transition-colors shadow-lg shadow-white/5"
          >
            Exportar Consolidado
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-[#0d0d0d] border-b border-white/10 px-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold border border-white/10 px-2 py-1 bg-white/5 rounded">Secure Feed</span>
            <h2 className="text-2xl font-serif italic text-white capitalize">{activeTab.replace('inventory', 'inventario').replace('sales', 'ventas')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all w-64 text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => openProductModal()}
              className="px-6 py-2 bg-emerald-500 text-white rounded text-[11px] uppercase tracking-widest font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          </div>
        </header>

        {/* Dynamic Content View */}
        <div className="flex-1 overflow-y-auto p-10 bg-[#0a0a0a]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <DashboardView products={products} sales={sales} />}
              {activeTab === 'inventory' && <InventoryView products={products} searchTerm={searchTerm} onEdit={openProductModal} onDelete={handleDeleteProduct} />}
              {activeTab === 'sales' && <SalesView sales={sales} onUpdate={handleUpdateSaleStatus} onAdd={handleAddSale} products={products} />}
              {activeTab === 'alerts' && <AlertsView products={products} />}
              {activeTab === 'assistant' && <AssistantView aiResponse={aiResponse} isLoading={isAiLoading} onAsk={askAi} />}
              {activeTab === 'settings' && <SettingsView config={config} onSave={updateConfig} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Modal 
        isOpen={isProductModalOpen} 
        onClose={() => setIsProductModalOpen(false)} 
        title={editingProduct ? "Editar Producto" : "Nuevo Producto"}
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }}>
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 italic">Nombre del Producto</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 italic">Categoría</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 italic">Precio Venta ($)</label>
              <input 
                type="number" 
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
                value={productForm.price || ''}
                onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 italic">Costo ($)</label>
              <input 
                type="number" 
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
                value={productForm.cost || ''}
                onChange={(e) => setProductForm({ ...productForm, cost: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 italic">Stock Inicial</label>
              <input 
                type="number" 
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
                value={productForm.stock || ''}
                onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 italic">Mínimo Alerta</label>
              <input 
                type="number" 
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
                value={productForm.minStock || ''}
                onChange={(e) => setProductForm({ ...productForm, minStock: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-white text-black rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-gray-100 transition-colors mt-6 shadow-xl shadow-white/5"
          >
            {editingProduct ? "Actualizar Inventario" : "Autorizar Alta de Producto"}
          </button>
          {editingProduct && (
            <button 
              type="button"
              onClick={() => { handleDeleteProduct(editingProduct.id); setIsProductModalOpen(false); }}
              className="w-full py-3 border border-red-500/30 text-red-400 rounded-sm text-[11px] uppercase tracking-widest font-bold hover:bg-red-500/10 transition-colors mt-2"
            >
              Eliminar Permanentemente
            </button>
          )}
        </form>
      </Modal>
    </div>
  );
}

// Stats Card
const StatCard = ({ label, value, sub, icon: Icon, color }: { label: string, value: string, sub: string, icon: any, color: string }) => (
  <div className="bg-[#0d0d0d] p-6 rounded-sm border border-white/10 shadow-lg flex items-start justify-between group transition-all hover:bg-white/[0.02]">
    <div>
      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">{label}</p>
      <h3 className="text-3xl font-serif italic text-white">{value}</h3>
      <p className="text-[10px] text-gray-500 mt-2 italic flex items-center gap-1.5 font-medium uppercase tracking-tighter">
        <span className={`w-1.5 h-1.5 rounded-full bg-${color === 'emerald' ? 'emerald' : color === 'blue' ? 'blue' : color === 'amber' ? 'orange' : 'white'}-500 shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
        {sub}
      </p>
    </div>
    <div className={`p-4 rounded border border-white/5 bg-white/5`}>
      <Icon className={`w-5 h-5 text-white opacity-40 group-hover:opacity-100 transition-opacity`} />
    </div>
  </div>
);

function DashboardView({ products, sales }: { products: Product[], sales: Sale[] }) {
  const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const lowStock = products.filter(p => p.stock <= p.minStock).length;
  const todaySales = sales.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Inversion Total" value={`$${totalValue.toLocaleString()}`} sub="Inventario Activo" icon={Box} color="emerald" />
        <StatCard label="Ventas Totales" value={`$${todaySales.toLocaleString()}`} sub={`${sales.length} Pedidos Procesados`} icon={Receipt} color="blue" />
        <StatCard label="Críticos" value={lowStock.toString()} sub="Alertas de Stock" icon={TriangleAlert} color="amber" />
        <StatCard label="Sincronización" value="99.9%" sub="Excel Bridge Active" icon={FileSpreadsheet} color="white" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-[#0d0d0d] p-10 rounded-sm border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-serif italic text-white">Deliveries & Log</h3>
            <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Real-time Stream</span>
          </div>
          <div className="space-y-4">
            {sales.slice(-5).reverse().map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-sm hover:bg-white/[0.08] transition-all group">
                <div>
                  <p className="font-mono text-gray-400 italic text-[11px] mb-1 group-hover:text-white transition-colors">#{sale.id.slice(-4).toUpperCase()}</p>
                  <p className="font-medium text-sm text-white/90">{sale.productName}</p>
                  <p className="text-[10px] text-gray-500 italic mt-1">{sale.timestamp}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-white tracking-tighter mb-2">${sale.total.toLocaleString()}</p>
                  <span className={`text-[9px] px-2 py-0.5 border font-bold uppercase tracking-widest rounded ${
                    sale.status === 'Entregado' ? 'border-emerald-500/40 text-emerald-400' : 
                    sale.status === 'Enviado' ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400'
                  }`}>
                    {sale.status}
                  </span>
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="text-center py-20 text-gray-600 text-xs italic tracking-widest uppercase">No stream signal</p>}
          </div>
        </div>

        <div className="bg-[#0d0d0d] p-10 rounded-sm border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-serif italic text-white">Inventory Anomalies</h3>
            <TriangleAlert className="w-4 h-4 text-orange-500 opacity-50" />
          </div>
          <div className="space-y-4">
            {products.filter(p => p.stock <= p.minStock).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-5 bg-orange-500/5 border border-orange-500/20 rounded-sm group hover:bg-orange-500/10 transition-all">
                <div>
                  <p className="font-medium text-sm text-orange-100 group-hover:text-white transition-colors">{p.name}</p>
                  <p className="text-[10px] text-orange-500/60 font-bold uppercase tracking-wider mt-1">Nivel Crítico: {p.stock} / {p.minStock}</p>
                </div>
                <button className="px-4 py-1.5 border border-orange-500/30 text-orange-400 text-[10px] font-bold uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">Reabastecer</button>
              </div>
            ))}
             {products.filter(p => p.stock <= p.minStock).length === 0 && (
               <div className="text-center py-20 opacity-30">
                 <CheckCircle2 className="w-12 h-12 text-white mx-auto mb-4" />
                 <p className="text-white text-[10px] uppercase tracking-[0.3em] font-bold">Systems Optimized</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryView({ products, searchTerm, onEdit, onDelete }: { products: Product[], searchTerm: string, onEdit: (p: Product) => void, onDelete: (id: string) => void }) {
  const filtered = products.filter(p => (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()));

  return (
    <div className="bg-[#0d0d0d] rounded-sm border border-white/10 shadow-2xl overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-white/5">
          <tr>
            <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Identificador / Producto</th>
            <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Categoría</th>
            <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Valuación ($)</th>
            <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Existencias</th>
            <th className="px-8 py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {filtered.map(p => (
            <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="px-8 py-5">
                <span className="font-mono text-[10px] text-gray-600 italic block mb-1 uppercase tracking-tighter">PRD-{p.id.padStart(4, '0')}</span>
                <span className="font-medium text-white/90 group-hover:text-white">{p.name}</span>
              </td>
              <td className="px-8 py-5">
                <span className="px-2 py-1 bg-white/5 border border-white/5 text-[10px] text-gray-400 rounded uppercase font-bold tracking-widest">{p.category}</span>
              </td>
              <td className="px-8 py-5">
                <div className="text-sm font-mono text-white tracking-tighter">${p.price.toLocaleString()}</div>
                <div className="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-widest italic">Neto: ${p.cost.toLocaleString()}</div>
              </td>
              <td className="px-8 py-5">
                <div className={`text-sm font-mono tracking-tighter ${p.stock <= p.minStock ? 'text-orange-500' : 'text-emerald-400'}`}>
                  {p.stock}
                  {p.stock <= p.minStock && <span className="ml-2 text-[9px] font-bold text-orange-600">CRITICAL</span>}
                </div>
                <div className="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-widest">Base Logística: {p.minStock}</div>
              </td>
              <td className="px-8 py-5 text-right">
                <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(p)} className="p-2 border border-white/10 hover:bg-white/10 text-white rounded transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(p.id)} className="p-2 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalesView({ sales, onUpdate, onAdd, products }: { sales: Sale[], onUpdate: any, onAdd: any, products: Product[] }) {
  const [selectedProd, setSelectedProd] = useState('');
  const [qty, setQty] = useState(1);

  return (
    <div className="space-y-10">
      {/* Transaction Form */}
      <div className="bg-[#0d0d0d] p-10 rounded-sm border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-serif italic text-white flex items-center gap-3">
            <Truck className="w-5 h-5 text-emerald-400" />
            Registry Pipeline
          </h3>
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">New Transaction Input</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3 italic">Selection Channel</label>
            <select 
              className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-white/20 text-white appearance-none cursor-pointer"
              value={selectedProd}
              onChange={(e) => setSelectedProd(e.target.value)}
            >
              <option value="" className="bg-[#0d0d0d]">Primary Inventory Select...</option>
              {products.map(p => <option key={p.id} value={p.id} className="bg-[#0d0d0d]">{p.name} (AVAIL: {p.stock})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3 italic">Volume</label>
            <input 
              type="number" 
              min="1" 
              className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 font-mono" 
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value))}
            />
          </div>
          <button 
            disabled={!selectedProd}
            onClick={() => { onAdd(selectedProd, qty); setSelectedProd(''); setQty(1); }}
            className="w-full py-3.5 bg-white text-black rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-gray-100 transition-all shadow-xl shadow-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Authorize Entry
          </button>
        </div>
      </div>

      <div className="bg-[#0d0d0d] rounded-sm border border-white/10 shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5">
            <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <th className="px-8 py-5 border-b border-white/10">Timeline / UID</th>
              <th className="px-8 py-5 border-b border-white/10">Entity Detail</th>
              <th className="px-8 py-5 border-b border-white/10">Active Tracking</th>
              <th className="px-8 py-5 border-b border-white/10">Status Marker</th>
              <th className="px-8 py-5 border-b border-white/10 text-right">Value (Consolidated)</th>
              <th className="px-8 py-5 border-b border-white/10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sales.slice().reverse().map(sale => (
              <tr key={sale.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-8 py-5 italic text-[10px] text-gray-500">
                  <span className="text-white/60 font-mono block mb-1 uppercase tracking-tighter group-hover:text-white transition-colors">ORD-{sale.id.slice(-4).toUpperCase()}</span>
                  {sale.timestamp}
                </td>
                <td className="px-8 py-5 font-medium text-white/90">
                  {sale.productName} 
                  <span className="text-gray-600 font-mono text-[10px] ml-2 tracking-tighter">QTY: {sale.quantity}</span>
                </td>
                <td className="px-8 py-5">
                  <input 
                    type="text" 
                    placeholder="Pending Tracker..." 
                    className="text-[10px] bg-white/5 border border-white/5 px-3 py-1.5 rounded italic font-mono text-white/50 focus:text-white focus:bg-white/10 transition-all w-40 outline-none hover:border-white/20"
                    defaultValue={sale.trackingNumber}
                    onBlur={(e) => onUpdate(sale.id, sale.status, e.target.value)}
                  />
                </td>
                <td className="px-8 py-5">
                  <select 
                    value={sale.status} 
                    onChange={(e) => onUpdate(sale.id, e.target.value as OrderStatus, sale.trackingNumber)}
                    className="text-[10px] font-bold bg-transparent border border-white/10 px-2 py-1 rounded cursor-pointer text-white/80 uppercase tracking-tighter hover:border-white/40 transition-colors appearance-none"
                  >
                    <option value="Pendiente" className="bg-[#0a0a0a]">PROCESSING</option>
                    <option value="Enviado" className="bg-[#0a0a0a]">EN ROUTE</option>
                    <option value="Entregado" className="bg-[#0a0a0a]">FINALIZED</option>
                    <option value="Cancelado" className="bg-[#0a0a0a]">VOIDED</option>
                  </select>
                </td>
                <td className="px-8 py-5 font-mono text-sm text-white text-right tracking-tighter">${sale.total.toLocaleString()}</td>
                <td className="px-8 py-5 text-right">
                  <button 
                    onClick={() => handleDeleteSale(sale.id)}
                    className="p-2 border border-red-500/20 hover:bg-red-500/20 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssistantView({ aiResponse, isLoading, onAsk }: { aiResponse: string, isLoading: boolean, onAsk: (q: string) => void }) {
  const [input, setInput] = useState('');

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="bg-[#0d0d0d] p-12 rounded-sm border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 via-white/20 to-blue-500/50 opacity-40"></div>
        <div className="flex items-center gap-6 mb-12">
          <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-sm flex items-center justify-center shadow-lg">
            <Bot className="text-white w-7 h-7 italic" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-emerald-500/60 mb-1 block">Analytical Neural Engine</span>
            <h3 className="text-2xl font-serif italic text-white leading-tight">InvenIA Synthesis Hub</h3>
          </div>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-sm p-8 mb-10 min-h-[200px] relative">
          {isLoading && (
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 backdrop-blur-sm">
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />
                  <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-pulse [animation-delay:0.4s]" />
                </div>
             </div>
          )}
          <p className="text-gray-400 leading-relaxed text-sm whitespace-pre-wrap italic opacity-80 group-hover:opacity-100 transition-opacity">
            {aiResponse || "Hub initialized. Waiting for prompt data sync..."}
          </p>
        </div>

        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Interrogate systems: predictive stock levels, profitability metrics... " 
            className="flex-1 px-8 py-5 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30 transition-all font-mono italic"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (onAsk(input), setInput(''))}
          />
          <button 
            onClick={() => { onAsk(input); setInput(''); }}
            className="w-16 h-16 bg-white text-black rounded-sm flex items-center justify-center shadow-2xl hover:bg-gray-200 transition-colors group"
          >
            <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          "Predictive profit margins per category",
          "Risk assessment: Out of stock forecast",
          "Consolidated weekly export summary"
        ].map((q) => (
          <button 
            key={q} 
            onClick={() => onAsk(q)}
            className="text-left p-6 bg-white/5 border border-white/5 rounded-sm text-[10px] uppercase font-bold tracking-widest text-gray-500 hover:border-white/20 hover:text-white transition-all italic"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlertsView({ products }: { products: Product[] }) {
  const alerts = products.filter(p => p.stock <= p.minStock);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {alerts.map(p => (
        <div key={p.id} className="bg-[#0d0d0d] p-8 rounded-sm border-l-2 border-l-orange-500 border border-white/10 shadow-2xl group transition-all hover:bg-white/[0.02]">
          <div className="flex justify-between items-start mb-6">
            <div className={`p-3 rounded border ${p.stock === 0 ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-orange-500/30 bg-orange-500/10 text-orange-400'}`}>
              <TriangleAlert className="w-5 h-5" />
            </div>
            <span className={`text-[9px] font-bold px-3 py-1 border uppercase tracking-widest rounded ${p.stock === 0 ? 'border-red-500/40 text-red-500' : 'border-orange-500/40 text-orange-400'}`}>
              {p.stock === 0 ? 'Depleted' : 'Low Phase'}
            </span>
          </div>
          <h4 className="font-serif italic text-xl text-white mb-2">{p.name}</h4>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-6 italic">{p.category}</p>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-orange-500 transition-all shadow-[0_0_8px_orange]" style={{ width: `${(p.stock / (p.minStock * 2)) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            <span>UNITS: {p.stock}</span>
            <span>THRESHOLD: {p.minStock}</span>
          </div>
        </div>
      ))}
      {alerts.length === 0 && (
        <div className="col-span-full py-32 text-center">
            <CheckCircle2 className="w-20 h-20 text-white/10 mx-auto mb-6" />
            <h3 className="text-white font-serif italic text-2xl mb-2">Systems Nominal</h3>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.4em] font-bold">No active anomalies detected in data stream</p>
        </div>
      )}
    </div>
  );
}

function SettingsView({ config, onSave }: { config: AppConfig, onSave: (c: AppConfig) => void }) {
  const [localConfig, setLocalConfig] = useState(config);

  return (
    <div className="bg-[#0d0d0d] p-12 rounded-sm border border-white/10 shadow-2xl max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-2xl font-serif italic text-white flex items-center gap-4">
          <Settings className="w-6 h-6 text-emerald-400" />
          Excel Node Configuration
        </h3>
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Parameters</span>
      </div>
      <div className="space-y-8">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 italic">Active Data Sheet Name</label>
          <input 
            type="text" 
            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
            value={localConfig.excelSheetName}
            onChange={(e) => setLocalConfig({ ...localConfig, excelSheetName: e.target.value })}
            placeholder="Primary_Stream"
          />
          <p className="text-[9px] text-gray-600 mt-2 px-1 uppercase tracking-tighter">Target sheet for consolidated log exports.</p>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 italic">Master File Identity (.xlsx)</label>
          <input 
            type="text" 
            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
            value={localConfig.excelFileName}
            onChange={(e) => setLocalConfig({ ...localConfig, excelFileName: e.target.value })}
            placeholder="master_cons_v1.xlsx"
          />
          <p className="text-[9px] text-gray-600 mt-2 px-1 uppercase tracking-tighter">System-level file name for server-side persistence.</p>
        </div>
        
        <button 
          onClick={() => onSave(localConfig)}
          className="w-full py-5 bg-white text-black rounded-sm text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-gray-100 transition-all shadow-xl shadow-white/5 mt-6"
        >
          Synchronize Configuration
        </button>
      </div>
    </div>
  );
}
