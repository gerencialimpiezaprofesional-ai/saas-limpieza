import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera as CameraIcon, RotateCcw, Check, X, Loader2, ShieldCheck, AlertCircle, MessageSquare } from "lucide-react";
import { analyzeCleaningQuality } from "../services/gemini";
import { sendDigitalCertificate } from "../services/messagingService";
import { cn } from "../lib/utils";

export default function CameraCapture() {
  const [step, setStep] = useState<"before" | "after" | "analyzing" | "result">("before");
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [sendingCert, setSendingCert] = useState(false);
  const [certSent, setCertSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (step === "before") {
        setBeforeImage(base64);
        setStep("after");
      } else {
        setAfterImage(base64);
        handleAnalyze(beforeImage!, base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (before: string, after: string) => {
    setStep("analyzing");
    try {
      const result = await analyzeCleaningQuality(
        before.split(",")[1],
        after.split(",")[1]
      );
      setAnalysis(result);
      setStep("result");
    } catch (error) {
      console.error("Analysis failed", error);
      setStep("after");
    }
  };

  const handleSendCertificate = async () => {
    setSendingCert(true);
    try {
      // Simulación de datos de cliente
      await sendDigitalCertificate("Emmsa", "+521234567890", analysis.score, "https://cleanflow.ai/cert/123");
      setCertSent(true);
    } catch (error) {
      console.error("Error sending certificate:", error);
    } finally {
      setSendingCert(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8">
      <AnimatePresence mode="wait">
        {step === "before" || step === "after" ? (
          <motion.div
            key="capture"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center space-y-6 w-full"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">
                {step === "before" ? "Foto Antes" : "Foto Después"}
              </h2>
              <p className="text-primary/60 font-medium">Captura evidencia para validación IA</p>
            </div>

            <div className="aspect-[3/4] w-full max-w-sm mx-auto bg-surface-container rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden">
              {step === "after" && beforeImage && (
                <img src={beforeImage} alt="Antes" className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale" />
              )}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-2xl active:scale-90 transition-transform z-10"
              >
                <CameraIcon className="w-10 h-10" strokeWidth={2.5} />
              </button>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleCapture}
              />
            </div>

            <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">
              {step === "before" ? "Paso 1 de 2" : "Paso 2 de 2: Compara con el estado inicial"}
            </p>
          </motion.div>
        ) : step === "analyzing" ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-6"
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-secondary animate-spin" />
              </div>
              <div className="absolute inset-0 border-4 border-secondary rounded-full animate-radar" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black font-headline text-white uppercase">Analizando con Gemini</h3>
              <p className="text-sm text-primary/60 font-medium max-w-[200px] mx-auto">Detectando profundidad de limpieza y residuos...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-6"
          >
            <div className={cn(
              "p-6 rounded-3xl text-center space-y-4 border shadow-2xl",
              analysis?.score >= 85 ? "bg-secondary/10 border-secondary/20" : "bg-error/10 border-error/20"
            )}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2 bg-white/5">
                {analysis?.score >= 85 ? (
                  <ShieldCheck className="w-10 h-10 text-secondary" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-error" />
                )}
              </div>
              <h2 className="text-4xl font-black font-headline text-white">{analysis?.score}%</h2>
              <p className="text-sm font-bold uppercase tracking-widest text-primary/60">Score de Pureza</p>
              <p className="text-sm text-white/80 leading-relaxed italic">"{analysis?.observations}"</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Checklist de IA</h4>
              <div className="grid grid-cols-1 gap-2">
                {analysis?.criteria.map((item: any, i: number) => (
                  <div key={i} className="glass-panel p-3 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">{item.name}</span>
                    {item.status === "ok" ? (
                      <Check className="w-4 h-4 text-secondary" />
                    ) : (
                      <X className="w-4 h-4 text-error" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {analysis?.score >= 95 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs font-bold text-white">Certificado Disponible</p>
                    <p className="text-[10px] text-primary/60">Enviar validación IA al cliente vía WhatsApp</p>
                  </div>
                </div>
                <button 
                  onClick={handleSendCertificate}
                  disabled={sendingCert || certSent}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    certSent ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary active:scale-95"
                  )}
                >
                  {sendingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : certSent ? "Enviado ✓" : "Enviar"}
                </button>
              </motion.div>
            )}

            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setStep("before")}
                className="flex-1 h-14 glass-panel rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" /> Reintentar
              </button>
              <button 
                className="flex-[2] h-14 bg-secondary rounded-2xl flex items-center justify-center text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
              >
                Finalizar Servicio
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
