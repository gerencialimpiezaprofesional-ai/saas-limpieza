import { motion } from "framer-motion";
import { Package, AlertTriangle, TrendingUp, ShoppingCart, ChevronRight, History, Zap, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useState, useEffect } from "react";
import { predictInventory } from "../services/gemini";

const inventory = [
  { name: "Detergente Industrial", stock: "12L", min: "10L", status: "ok", usage: "3L/semana" },
  { name: "Desinfectante Cloro", stock: "4L", min: "8L", status: "low", usage: "5L/semana" },
  { name: "Bolsas de Basura XL", stock: "200u", min: "150u", status: "ok", usage: "50u/semana" },
  { name: "Paños de Microfibra", stock: "15u", min: "20u", status: "low", usage: "2u/semana" }
];

export default function Inventory() {
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const usageHistory = inventory.map(i => `${i.name}: ${i.usage} (Stock: ${i.stock})`).join(", ");
      const result = await predictInventory(usageHistory);
      setPrediction(result);
    } catch (error) {
      console.error("Error predicting inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handlePredict();
  }, []);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Insumos</h1>
          <p className="text-sm text-primary/60 font-medium">Gestión Inteligente de Stock</p>
        </div>
        <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
          <Package className="w-6 h-6" />
        </div>
      </section>

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
          {loading ? (
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
              Basado en el ritmo de limpieza actual, el <span className="text-white font-bold">Desinfectante Cloro</span> se agotará en <span className="text-tertiary font-bold">3 días</span>.
            </p>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button className="flex-1 h-10 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-tertiary/20">
            Ignorar
          </button>
          <button className="flex-[2] h-10 bg-tertiary rounded-xl text-on-secondary font-black font-headline text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform">
            Generar Orden de Compra
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Inventario Actual</h3>
          <button className="text-[10px] font-bold text-secondary uppercase tracking-tighter flex items-center gap-1">
            Ver Historial <History className="w-3 h-3" />
          </button>
        </div>
        
        <div className="space-y-3">
          {inventory.map((item, i) => (
            <div key={i} className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center border",
                  item.status === "low" ? "bg-error/10 border-error/20 text-error" : "bg-primary/10 border-primary/20 text-primary"
                )}>
                  {item.status === "low" ? <AlertTriangle className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{item.name}</h4>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">Uso: {item.usage}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-lg font-black font-headline",
                  item.status === "low" ? "text-error" : "text-white"
                )}>{item.stock}</p>
                <p className="text-[10px] text-primary/40 font-bold uppercase">Mín: {item.min}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button className="w-full h-14 glass-panel border-dashed border-2 border-white/10 rounded-2xl flex items-center justify-center gap-3 text-primary/60 hover:text-primary hover:border-primary/40 transition-all active:scale-95">
        <ShoppingCart className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-widest">Nueva Solicitud de Insumos</span>
      </button>
    </div>
  );
}
