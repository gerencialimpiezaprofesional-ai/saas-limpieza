import React, { useState } from "react";
import { Megaphone, Rocket, Facebook, Globe, Sparkles, Loader2, Target, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { generateAIResponse } from "../services/gemini";

export default function MarketingEngine() {
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<{ platform: string; content: string; target: string }[] | null>(null);

  const generateAds = async () => {
    setLoading(true);
    try {
      const prompt = "Genera 1 anuncio para Facebook Ads y 1 para Google Ads para Impeccable AI, un ERP de limpieza. Enfócate en captar clientes en México ofreciendo 'Auditoría de Higiene por IA'. Devuelve un JSON con plataforma, contenido y target sugerido. Devuelve SOLO el JSON sin etiquetas de markdown.";
      const systemInstruction = "Experto en Growth Marketing de Limpieza.";
      
      const text = await generateAIResponse(prompt, systemInstruction, true);
      
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleaned);
      setAds(Array.isArray(data) ? data : [data]);
      toast.success("Estrategia de crecimiento generada");
    } catch (error: any) {
      console.error("Error generating ads:", error);
      toast.error("Error al conectar con el motor de crecimiento: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <section className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-secondary/10 to-transparent opacity-50"></div>
        <div className="flex items-center gap-4 relative">
          <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20 shadow-[0_0_20px_rgba(68,221,194,0.3)]">
            <Rocket className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Motor de Crecimiento</h1>
            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">IA Generativa de Pauta Publicitaria</p>
          </div>
        </div>
        <button 
          onClick={generateAds}
          disabled={loading}
          className="flex items-center gap-2 px-6 h-12 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 relative"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          <span className="text-xs">Re-Generar Estrategia</span>
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-6 bg-gradient-to-br from-white/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-secondary/10 rounded-xl">
               <Target className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Objetivos 30D</h3>
          </div>
          <div className="space-y-6">
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Nuevos Contratos</span>
                <span className="text-xs font-black text-white">2 / 10</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "20%" }}
                  className="h-full bg-secondary shadow-[0_0_15px_#44DDC2]"
                />
              </div>
            </div>
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Engagement Meta</span>
                <span className="text-xs font-black text-white">65%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "65%" }}
                  className="h-full bg-primary shadow-[0_0_15px_#4FE9FF]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-secondary/10 rounded-xl">
               <TrendingUp className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Proyecciones</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
              <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest leading-none">Costo por Lead</p>
              <p className="text-xl font-black text-white">$12.50 <span className="text-[10px] text-primary/20">MXN</span></p>
            </div>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
              <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest leading-none">ROI Estimado</p>
              <p className="text-xl font-black text-secondary">3.4x</p>
            </div>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
              <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest leading-none">Alcance Mensual</p>
              <p className="text-xl font-black text-white">45K+</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-6 bg-secondary/5 border-secondary/20">
          <div className="flex items-center gap-4">
             <div className="p-2 bg-secondary/20 rounded-xl">
                <Megaphone className="w-6 h-6 text-secondary" />
             </div>
             <h3 className="text-lg font-black text-white uppercase tracking-tight">IA Sugiere</h3>
          </div>
          <div className="space-y-4">
             <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 shrink-0"></div>
                <p className="text-xs text-white/70 font-medium leading-relaxed italic">"Enfoca el 60% de tu presupuesto en LinkedIn para decisores de compras corporativas."</p>
             </div>
             <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 shrink-0"></div>
                <p className="text-xs text-white/70 font-medium leading-relaxed italic">"Usa el video de la auditoría de IA como gancho visual principal."</p>
             </div>
          </div>
          <button className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
             Configurar Canales
          </button>
        </div>
      </div>

      <AnimatePresence>
        {ads && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {ads.map((ad, i) => (
              <div key={i} className="glass-panel p-6 rounded-[2rem] border border-white/10 space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  {ad.platform?.includes("Facebook") ? <Facebook className="w-20 h-20" /> : <Globe className="w-20 h-20" />}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary">
                    {ad.platform?.includes("Facebook") ? <Facebook className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                  </div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">{ad.platform}</h4>
                </div>
                <p className="text-sm text-primary/80 font-medium leading-relaxed bg-white/5 p-4 rounded-xl italic">
                  "{ad.content}"
                </p>
                <div className="pt-2">
                  <p className="text-[8px] font-black text-primary/40 uppercase tracking-widest mb-1">Target Sugerido</p>
                  <p className="text-[10px] text-secondary font-bold uppercase">{ad.target}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
