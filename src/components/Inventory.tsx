import { motion, AnimatePresence } from "framer-motion";
import { Package, AlertTriangle, TrendingUp, ShoppingCart, ChevronRight, History, Zap, Loader2, X, Check, Box, ListChecks, CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import React, { useState, useEffect } from "react";
import { predictInventory } from "../services/gemini";
import { toast } from "sonner";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";

export default function Inventory({ userData }: { userData: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'requisitions'>('inventory');

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [requestItems, setRequestItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ name: "", stock: 0, min: 5, unit: "pza", usage: "Bajo" });

  useEffect(() => {
    if (!userData?.tenantId) return;

    const inventoryQuery = query(
      collection(db, "inventory"),
      where("tenantId", "==", userData.tenantId)
    );

    const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(fetchedItems);
      setLoading(false);
    });

    const requisitionsQuery = query(
      collection(db, "requisitions"),
      where("tenantId", "==", userData.tenantId)
    );

    const unsubscribeRequisitions = onSnapshot(requisitionsQuery, (snapshot) => {
      setRequisitions(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    });

    return () => {
      unsubscribeInventory();
      unsubscribeRequisitions();
    };
  }, [userData?.tenantId]);

  const openRequestForm = () => {
    if (items.length === 0) {
      toast.error("No hay insumos cargados en el inventario");
      return;
    }
    setRequestItems(items.map(i => ({ id: i.id, name: i.name, quantity: 0 })));
    setShowRequestForm(true);
  };

  const handlePredict = async () => {
    if (items.length === 0) return;
    setPredicting(true);
    try {
      const usageHistory = items.map(i => `${i.name}: ${i.usage} (Stock: ${i.stock}${i.unit || ''})`).join(", ");
      const result = await predictInventory(usageHistory);
      setPrediction(result);
    } catch (error) {
      console.error("Error predicting inventory:", error);
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    if (items.length > 0 && !prediction) {
      handlePredict();
    }
  }, [items]);

  const handleSendRequest = async () => {
    const selected = requestItems.filter(i => i.quantity > 0);
    if (selected.length === 0) {
      toast.error("Selecciona al menos un insumo");
      return;
    }

    try {
      await addDoc(collection(db, "requisitions"), {
        tenantId: userData.tenantId,
        requestedBy: userData.name,
        role: userData.role,
        items: selected,
        status: 'pending',
        type: 'monthly_requisition',
        createdAt: serverTimestamp()
      });
      // Add a notification for RH
      await addDoc(collection(db, "notifications"), {
        tenantId: userData.tenantId,
        title: "Nueva Requisición Mensual",
        message: `El supervisor ${userData.name} ha solicitado insumos mensuales.`,
        targetRoles: ["rh", "ceo"],
        createdAt: serverTimestamp()
      });
      toast.success("Requisición mensual enviada correctamente a RH");
      setShowRequestForm(false);
      setRequestItems(items.map(i => ({ id: i.id, name: i.name, quantity: 0 })));
    } catch (error) {
      toast.error("Error al enviar solicitud");
    }
  };

  const handleFulfillRequisition = async (req: any) => {
    try {
      setLoading(true);
      // Update inventory for each item
      for (const item of req.items) {
        if (!item.id || !db) continue;
        const invItem = items.find(i => i.id === item.id);
        if (invItem) {
          const newStock = Math.max(0, invItem.stock - item.quantity);
          await updateDoc(doc(db, "inventory", item.id), {
            stock: newStock,
            status: newStock <= invItem.min ? 'low' : 'ok'
          });
        }
      }
      
      if (!req.id || !db) return;
      // Mark requisition as fulfilled
      await updateDoc(doc(db, "requisitions", req.id), {
        status: 'fulfilled',
        fulfilledBy: userData.name,
        fulfilledAt: serverTimestamp()
      });

      toast.success("Requisición surtida y stock actualizado");
    } catch (error) {
      toast.error("Error al surtir requisición");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userData?.tenantId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "inventory"), {
        ...newItem,
        status: newItem.stock <= newItem.min ? 'low' : 'ok',
        tenantId: userData.tenantId,
        createdAt: serverTimestamp()
      });
      toast.success("Nuevo insumo agregado al catálogo");
      setNewItem({ name: "", stock: 0, min: 5, unit: "pza", usage: "Bajo" });
      setShowAddItem(false);
    } catch (error) {
      toast.error("Error al agregar insumo");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedInventory = async () => {
    const baseCatalog = [
      { name: "Detergente Multiusos", stock: 20, min: 5, unit: "litro", usage: "Alto" },
      { name: "Desinfectante Quirúrgico", stock: 15, min: 5, unit: "litro", usage: "Medio" },
      { name: "Paños de Microfibra", stock: 50, min: 10, unit: "pza", usage: "Alto" },
      { name: "Guantes de Nitrilo (M)", stock: 100, min: 20, unit: "pza", usage: "Alto" },
      { name: "Mopas de Limpieza", stock: 10, min: 3, unit: "pza", usage: "Bajo" }
    ];

    setLoading(true);
    try {
      for (const item of baseCatalog) {
        await addDoc(collection(db, "inventory"), {
          ...item,
          status: 'ok',
          tenantId: userData.tenantId,
          createdAt: serverTimestamp()
        });
      }
      toast.success("Catálogo base generado con éxito");
    } catch (error) {
      toast.error("Error al generar catálogo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (itemId: string, amount: number) => {
    if (!itemId || !db) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const newStock = Math.max(0, item.stock + amount);
    try {
      await updateDoc(doc(db, "inventory", itemId), {
        stock: newStock,
        status: newStock <= item.min ? 'low' : 'ok',
        updatedAt: serverTimestamp()
      });
      toast.success(`Stock actualizado: ${newStock} ${item.unit}`);
    } catch (error) {
      toast.error("Error al actualizar stock");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!id || !db) return;
    if (!confirm("¿Eliminar este insumo del catálogo?")) return;
    try {
      await deleteDoc(doc(db, "inventory", id));
      toast.success("Insumo eliminado");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <section className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Insumos y Suministros</h1>
            <p className="text-[10px] text-secondary/60 font-bold uppercase tracking-widest">Gestión Inteligente de Stock por IA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(userData?.role === 'rh' || userData?.role === 'ceo') && (
            <>
              {items.length === 0 && (
                <button 
                  onClick={handleSeedInventory}
                  className="flex items-center gap-2 px-6 h-12 bg-primary/10 text-primary rounded-2xl font-black font-headline uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-all"
                >
                  <Zap className="w-5 h-5" />
                  <span className="text-xs">Catálogo IA</span>
                </button>
              )}
              <button 
                onClick={() => setShowAddItem(true)}
                className="flex items-center gap-2 px-6 h-12 bg-white/5 text-white rounded-2xl font-black font-headline uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
              >
                <Plus className="w-5 h-5 text-secondary" />
                <span className="text-xs">Agregar Insumo</span>
              </button>
            </>
          )}
          {(userData?.role === 'supervisor' || userData?.isInventoryManager) && (
            <button 
              onClick={openRequestForm}
              className="flex items-center gap-2 px-6 h-12 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-xs">Requisición Mensual</span>
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-surface-container rounded-2xl border border-white/5">
        {[
          { id: 'inventory', label: 'Inventario', icon: Box },
          { id: 'requisitions', label: 'Requisiciones', icon: ListChecks },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === tab.id ? "bg-secondary text-on-secondary shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && (
        <>
          {/* AI Prediction Card */}
          <section className="glass-panel p-6 rounded-3xl space-y-6 relative overflow-hidden border-l-4 border-tertiary shadow-2xl">
            <div className="absolute top-0 right-0 p-3">
              <div className="bg-tertiary/20 px-2 py-1 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3 text-tertiary fill-tertiary" />
                <span className="text-[8px] font-black text-tertiary uppercase tracking-widest">IA Predictiva</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-tertiary" /> Alerta de Reabastecimiento
              </h3>
              {predicting ? (
                <div className="flex items-center gap-2 text-xs text-primary/40">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analizando patrones de uso...
                </div>
              ) : prediction ? (
                <p className="text-xs text-primary/60 leading-relaxed">
                  Basado en el ritmo de limpieza actual, el stock crítico se agotará el <span className="text-white font-bold">{prediction.predictedEmptyDate}</span>. 
                  Se sugiere pedir <span className="text-tertiary font-bold">{prediction.suggestedOrderAmount}</span>.
                </p>
              ) : (
                <p className="text-xs text-primary/60 leading-relaxed">
                  Analizando tendencias para optimizar compras...
                </p>
              )}
            </div>
            {userData?.role === 'rh' && (
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => toast.info("Análisis postergado")}
                  className="flex-1 h-10 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-tertiary/20"
                >
                  Ignorar
                </button>
                <button 
                  onClick={() => toast.success("Orden de compra enviada")}
                  className="flex-[2] h-10 bg-tertiary rounded-xl text-on-secondary font-black font-headline text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                >
                  Generar Orden de Compra
                </button>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Stock Actual</h3>
              <button 
                onClick={() => handlePredict()}
                className="text-[10px] font-bold text-secondary uppercase tracking-tighter flex items-center gap-1"
              >
                Actualizar IA <History className="w-3 h-3" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div className="col-span-full flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : items.map((item) => (
                <div key={item.id} className="glass-panel p-5 rounded-3xl flex items-center justify-between border border-white/5 hover:border-secondary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border",
                      item.status === "low" ? "bg-error/10 border-error/20 text-error" : "bg-secondary/10 border-secondary/20 text-secondary"
                    )}>
                      {item.status === "low" ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase">{item.name}</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Uso: {item.usage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={cn(
                        "text-xl font-black font-headline",
                        item.status === "low" ? "text-error" : "text-white"
                      )}>{item.stock} {item.unit}</p>
                      <p className="text-[8px] text-white/40 font-bold uppercase">Meta: {item.min} {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(userData.role === 'rh' || userData.role === 'ceo' || userData.role === 'supervisor' || userData.isInventoryManager) && (
                        <>
                          <button 
                            onClick={() => handleUpdateStock(item.id, -1)}
                            className="w-8 h-8 bg-error/10 text-error rounded-lg flex items-center justify-center hover:bg-error/20 transition-colors"
                            title="Consumir 1 unidad"
                          >
                            -
                          </button>
                          <button 
                            onClick={() => handleUpdateStock(item.id, 1)}
                            className="w-8 h-8 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center hover:bg-secondary/20 transition-colors"
                            title="Agregar 1 unidad"
                          >
                            +
                          </button>
                        </>
                      )}
                      {(userData.role === 'rh' || userData.role === 'ceo') && (
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-white/10 hover:text-error transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'requisitions' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Histórico de Solicitudes</h3>
          </div>
          <div className="space-y-3">
            {requisitions.length === 0 ? (
              <div className="glass-panel p-10 rounded-3xl text-center border-dashed border border-white/10">
                <ListChecks className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/40 font-medium">No hay requisiciones pendientes</p>
              </div>
            ) : requisitions.sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map((req) => (
              <div key={req.id} className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", 
                      req.status === 'pending' ? "bg-tertiary/10 text-tertiary" : "bg-secondary/10 text-secondary"
                    )}>
                      {req.status === 'pending' ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight">REQ-{req.id.slice(0,5).toUpperCase()}</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{req.requestedBy} • {req.role}</p>
                    </div>
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                    req.status === 'pending' ? "bg-tertiary/10 text-tertiary" : "bg-secondary/10 text-secondary"
                  )}>
                    {req.status === 'pending' ? 'Pendiente' : 'Surtida'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {req.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs py-2 border-b border-white/5 last:border-0">
                      <span className="text-white/60">{item.name}</span>
                      <span className="font-black text-white">{item.quantity} pza</span>
                    </div>
                  ))}
                </div>

                {req.status === 'pending' && (userData.role === 'rh' || userData.role === 'ceo') && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleFulfillRequisition(req)}
                      disabled={loading}
                      className="flex-1 h-12 bg-secondary text-on-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Surtir
                    </button>
                    <button 
                      onClick={async () => {
                        if (!confirm("¿Rechazar esta requisición?")) return;
                        try {
                          await updateDoc(doc(db, "requisitions", req.id), { status: 'rejected', updatedAt: serverTimestamp() });
                          toast.error("Requisición rechazada");
                        } catch (e) {
                          toast.error("Error al rechazar");
                        }
                      }}
                      className="flex-1 h-12 bg-error/10 text-error rounded-2xl text-[10px] font-black uppercase tracking-widest border border-error/20 hover:bg-error/20 transition-all"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddItem && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-6 relative border border-white/10"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black font-headline text-white uppercase">Agregar Insumo</h2>
                <button onClick={() => setShowAddItem(false)} className="text-white/40"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-4">
                <input 
                  placeholder="Nombre del insumo"
                  className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-primary"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-black px-1">Stock Actual</label>
                    <input 
                      type="number"
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-primary"
                      value={newItem.stock}
                      onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-black px-1">Stock Mínimo</label>
                    <input 
                      type="number"
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-primary"
                      value={newItem.min}
                      onChange={e => setNewItem({...newItem, min: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    placeholder="Unidad (Ej: L, pza, kg)"
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-primary"
                    value={newItem.unit}
                    onChange={e => setNewItem({...newItem, unit: e.target.value})}
                    required
                  />
                  <select 
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-primary"
                    value={newItem.usage}
                    onChange={e => setNewItem({...newItem, usage: e.target.value})}
                  >
                    <option value="Bajo">Uso Bajo</option>
                    <option value="Medio">Uso Medio</option>
                    <option value="Alto">Uso Alto</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-widest"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Agregar al Inventario"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRequestForm && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-6 relative border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black font-headline text-white uppercase tracking-tight">Requisición Mensual</h2>
                  <p className="text-[10px] text-secondary/60 font-bold uppercase tracking-widest">Solo una solicitud por mes calendario</p>
                </div>
                <button onClick={() => setShowRequestForm(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {requestItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-sm font-bold text-white/80">{item.name}</span>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setRequestItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(0, it.quantity - 1) } : it))}
                        className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                      >-</button>
                      <span className="text-sm font-black text-white w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => setRequestItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                        className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary hover:bg-secondary/20 transition-colors"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleSendRequest}
                className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all"
              >
                <ShoppingCart className="w-6 h-6" />
                Levantar Requisición
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
