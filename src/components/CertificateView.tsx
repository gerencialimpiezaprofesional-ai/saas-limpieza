import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, CheckCircle2, Calendar, MapPin, Award, ArrowLeft, Download, Share2, ChevronDown, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function CertificateView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showCriteria, setShowCriteria] = useState(false);
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<any>(null);

  useEffect(() => {
    const fetchCert = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // Intentamos buscar en auditorías primero, luego en tareas
        let docRef = doc(db, "audits", id);
        let docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          docRef = doc(db, "tasks", id);
          docSnap = await getDoc(docRef);
        }

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCertData({
            id: docSnap.id,
            client: data.clientName || data.client || "Cliente Corporativo",
            date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 
                  (data.completedAt?.toDate ? data.completedAt.toDate().toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES')),
            score: data.score || data.aiScore || 0,
            location: data.location || data.locationName || "Área Validada",
            validator: "Impeccable AI Engine v4.2",
            status: "Validated",
            criteria: data.criteria || [
              { label: "Ausencia de Residuos", status: "ok" },
              { label: "Claridad en Evidencia", status: "ok" },
              { label: "Validación de Entorno", status: "ok" }
            ],
            observations: data.observations || data.aiNotes || data.aiFeedback || "Servicio validado satisfactoriamente por el motor de visión Impeccable."
          });
        } else if (id === "SRV-204") {
          // Fallback demo certificate
          setCertData({
            id: "SRV-204",
            client: "Corporativo Corporativo",
            date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            score: 98,
            location: "Ala Norte - Piso 4",
            validator: "Impeccable AI Engine v4.2 (Demo Mode)",
            status: "Validated",
            criteria: [
              { label: "Sanitización Superficies", status: "ok" },
              { label: "Remoción de Polvo", status: "ok" },
              { label: "Orden de Mobiliario", status: "ok" }
            ],
            observations: "Protocolo de limpieza profunda ejecutado con éxito. No se detectaron anomalías en la inspección visual por IA."
          });
        }
      } catch (e) {
        console.error("Error loading certificate:", e);
        toast.error("No se pudo cargar el certificado.");
      } finally {
        setLoading(false);
      }
    };
    fetchCert();
  }, [id]);

  const handleDownload = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-10 h-10 text-secondary animate-spin" />
        <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Validando Seguridad del Certificado...</p>
      </div>
    );
  }

  if (!certData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-6">
        <X className="w-16 h-16 text-error opacity-20" />
        <p className="font-bold text-white uppercase tracking-tighter">Certificado No Encontrado</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-white/5 rounded-2xl text-xs font-black uppercase text-white tracking-widest">Regresar al Panel</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center space-y-8 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .glass-panel { 
            border: 1px solid #e2e8f0 !important; 
            background: white !important; 
            box-shadow: none !important;
            color: black !important;
          }
          .text-white { color: black !important; }
          .text-primary\/40 { color: #64748b !important; }
          .text-primary\/60 { color: #475569 !important; }
          .bg-background { background: white !important; }
          button { display: none !important; }
        }
      `}} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass-panel p-8 rounded-[2.5rem] border-2 border-secondary/20 shadow-[0_0_50px_rgba(68,221,194,0.15)] relative overflow-hidden"
      >
        {/* Background Accents */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative space-y-8">
          <div className="flex justify-between items-start">
            <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div className="text-right">
              <div className="bg-secondary/10 px-3 py-1 rounded-full inline-flex items-center gap-2 border border-secondary/20">
                <CheckCircle2 className="w-3 h-3 text-secondary" />
                <span className="text-[10px] font-black text-secondary uppercase tracking-widest">
                  {certData.score > 0 ? "Validado con IA" : "Auditoría en Curso"}
                </span>
              </div>
              <p className="text-[10px] text-primary/40 font-bold mt-2 uppercase tracking-widest">ID: {certData.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="text-center space-y-4 pt-4">
            <h1 className="text-3xl font-black font-headline text-white uppercase tracking-tight leading-none">Certificado de Higiene Digital</h1>
            <p className="text-sm text-primary/60 font-medium">Este documento certifica que el inmueble cumple con los estándares óptimos de pureza y sanitización.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-3">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Nivel de Pureza</p>
                  <p className="text-4xl font-black font-headline text-secondary tracking-tighter">{certData.score}%</p>
                </div>
                <Award className="w-12 h-12 text-secondary/40" />
              </div>

              {/* Collapsible Criteria Section */}
              <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                <button 
                  onClick={() => setShowCriteria(!showCriteria)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Detalles de Inspección IA</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-primary/40 transition-transform ${showCriteria ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showCriteria && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 space-y-2"
                    >
                      {certData.criteria.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                          <span className="text-[10px] font-medium text-primary/60">{item.name || item.label}</span>
                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 ${
                            item.status === 'ok' ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
                          }`}>
                            {item.status === 'ok' ? <Check className="w-2 h-2" /> : <X className="w-2 h-2" />}
                            {(item.status || "fail").toUpperCase()}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {certData.observations && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest mb-2">Comentarios de la IA</p>
                  <p className="text-xs text-white/80 leading-relaxed italic">"{certData.observations}"</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {[
                { icon: MapPin, label: "Ubicación", value: certData.location },
                { icon: Calendar, label: "Fecha de Validación", value: certData.date },
                { icon: ShieldCheck, label: "Entidad Validadora", value: certData.validator },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">{item.label}</p>
                    <p className="text-xs font-bold text-white uppercase">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-3 print:hidden">
            <button 
              onClick={handleDownload}
              className="flex-1 h-14 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Download className="w-5 h-5" /> Descargar PDF
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Enlace copiado");
              }}
              className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-primary/40 hover:text-white transition-colors uppercase font-black text-[10px] tracking-widest px-4 py-2 print:hidden"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al Inicio
      </button>

      <div className="text-center opacity-20 hover:opacity-100 transition-opacity">
        <p className="text-[8px] text-white font-medium uppercase tracking-[0.3em]">Powered by Impeccable IA Holographic Engine</p>
      </div>
    </div>
  );
}
