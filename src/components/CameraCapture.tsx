import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera as CameraIcon, RotateCcw, Check, X, Loader2, ShieldCheck, AlertCircle, MessageSquare, RefreshCw } from "lucide-react";
import { analyzeCleaningQuality } from "../services/gemini";
import { sendDigitalCertificate } from "../services/messagingService";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";

import { collection, doc, getDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function CameraCapture({ userData }: { userData: any }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<"capture" | "form" | "analyzing" | "result">("capture");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [sendingCert, setSendingCert] = useState(false);
  const [certSent, setCertSent] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [strictness, setStrictness] = useState<'human' | 'standard' | 'strict'>('standard');

  useEffect(() => {
    const fetchTenantSettings = async () => {
      if (userData?.tenantId && db) {
        try {
          const tenantId = userData.tenantId;
          const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
          if (tenantDoc.exists()) {
            setStrictness(tenantDoc.data().aiStrictness || 'standard');
          }
        } catch (e) {
          console.error("Error fetching tenant settings", e);
        }
      }
    };
    fetchTenantSettings();
  }, [userData]);

  const startCamera = async () => {
    setError(null);
    setLoading(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Tu navegador no soporta el acceso a la cámara o estás en una conexión no segura.");
      setLoading(false);
      return;
    }

    try {
      // Intentamos primero con la cámara trasera (óptima para evidencia)
      const constraints = { 
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      };
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Cámara trasera no encontrada o denegada, intentando cualquier cámara...", e);
        // Fallback: Cualquier cámara disponible con resolución básica
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false 
        });
      }

      streamRef.current = stream;
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera error final:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Permiso denegado. Intenta abrir la app en una pestaña nueva si estás en la vista previa.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No se detectó ninguna cámara funcional.");
      } else {
        setError(`Error de cámara: ${err.message || "No se pudo iniciar"}`);
      }
      setLoading(false);
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(console.error);
        setLoading(false);
      };
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const MAX_DIM = 1024; // Increased quality slightly
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        // Use slightly higher quality for Gemini
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        
        setCapturedImage(dataUrl);
        stopCamera();
        setStep("form");
      }
    }
  };

  const handleStartAnalysis = () => {
    if (!areaName.trim()) {
      toast.error("Por favor ingresa el nombre del área");
      return;
    }
    if (capturedImage) {
      handleAnalyze(capturedImage);
    }
  };

  const handleFinishService = async () => {
    if (!analysis) {
      toast.error("Error: No hay análisis de IA disponible para guardar.");
      return;
    }
    
    if (!userData || !db) {
      toast.error("Error: No se ha cargado el perfil de usuario o la base de datos.");
      return;
    }

    setLoading(true);
    console.log(`[FINISH_SERVICE] Intentando finalizar tarea: ${taskId || "N/A"}`);

    try {
      const tenantId = userData.tenantId;
      const operatorId = userData.uid;

      // Helper para limpiar undefined
      const cleanData = (obj: any) => {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) newObj[key] = obj[key];
        });
        return newObj;
      };

      const baseInfo = {
        score: analysis.score || 0,
        observations: analysis.observations || "",
        criteria: analysis.criteria || [],
        tenantId,
        operatorId,
        areaName,
        operatorName: userData.name || "Sin nombre",
        status: analysis.score >= 70 ? 'approved' : 'rejected',
        afterPhoto: capturedImage,
        updatedAt: serverTimestamp()
      };

      // 1. Guardar Auditoría (Nuevo documento)
      console.log("[FINISH_SERVICE] Guardando auditoría...");
      const auditRef = await addDoc(collection(db, "audits"), cleanData({
        ...baseInfo,
        createdAt: serverTimestamp(),
        type: 'service_finish',
        taskId: taskId || null
      }));
      
      // 2. Si hay taskId, actualizar el documento de la tarea, de lo contrario crear una nueva
      if (taskId) {
        console.log(`[FINISH_SERVICE] Actualizando tarea ${taskId}...`);
        await updateDoc(doc(db, "tasks", taskId), cleanData({
          status: 'completed',
          score: analysis.score,
          aiNotes: analysis.observations,
          areaName,
          afterPhoto: capturedImage,
          completedAt: serverTimestamp(),
          auditId: auditRef.id
        }));
      } else {
        console.log("[FINISH_SERVICE] Creando nueva tarea (escaneo directo)...");
        // Create a new task for this direct scan
        const taskRef = await addDoc(collection(db, "tasks"), cleanData({
          title: `Limpieza: ${areaName}`,
          clientName: userData.clientName || "Limpieza Eventual",
          clientId: userData.clientId || "ev_client",
          tenantId,
          operatorId,
          operatorName: userData.name || "Sin nombre",
          status: 'completed',
          score: analysis.score,
          aiNotes: analysis.observations,
          areaName,
          afterPhoto: capturedImage,
          createdAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          auditId: auditRef.id,
          type: 'direct_scan'
        }));
        
        // Link audit to the newly created task
        await updateDoc(auditRef, { taskId: taskRef.id });
      }

      toast.success("Servicio Finalizado Exitosamente");
      
      // Pequeño delay para que el usuario vea el éxito antes de navegar
      setTimeout(() => {
        navigate("/tasks");
      }, 500);
    } catch (error: any) {
      console.error("[FINISH_SERVICE] Error crítico:", error);
      toast.error(`Error al finalizar: ${error.message || "Fallo en la conexión"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === "capture" && !cameraActive) {
      startCamera();
    }
    return () => stopCamera();
  }, [step]);

  const handleAnalyze = async (image: string) => {
    setStep("analyzing");
    try {
      const result = await analyzeCleaningQuality(
        image.split(",")[1],
        strictness,
        userData?.industry || "Comercio"
      );
      setAnalysis(result);
      
      // Notify supervisor if score < 70
      if (result.score < 70) {
        import("../services/messagingService").then(m => {
          m.notifySupervisorTaskRejection(
            "+521234567890", // Mock supervisor phone
            userData.name || "Operador",
            "Servicio de Limpieza",
            result.score,
            result.observations
          );
        });
      }

      setStep("result");
    } catch (error: any) {
      console.error("Analysis failed:", error);
      toast.error(`No se pudo llamar a la API de Gemini: ${error.message || "Error desconocido"}. Inténtelo de nuevo.`);
      setStep("capture");
      startCamera();
    }
  };

  const handleSendCertificate = async () => {
    setSendingCert(true);
    try {
      await sendDigitalCertificate("Cliente", "+521234567890", analysis.score, `${window.location.origin}/cert/123`);
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
        {step === "capture" ? (
          <motion.div
            key="capture"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center space-y-6 w-full"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">
                Captura de Evidencia
              </h2>
              <p className="text-primary/60 font-medium">Toma una foto del espacio terminado para validación IA</p>
            </div>

            <div className="aspect-[3/4] w-full max-w-sm mx-auto bg-surface-container rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
              {cameraActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button 
                    onClick={capturePhoto}
                    className="absolute bottom-6 w-20 h-20 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-2xl active:scale-90 transition-transform z-10 border-4 border-white/20"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-on-secondary" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {loading ? (
                    <Loader2 className="w-10 h-10 text-secondary animate-spin" />
                  ) : (
                    <>
                      <CameraIcon className="w-12 h-12 text-primary/20" />
                      {error && (
                        <div className="space-y-2 px-4">
                          <p className="text-xs text-error font-bold leading-tight">{error}</p>
                          <button 
                            onClick={openInNewTab}
                            className="text-[10px] text-secondary font-black uppercase underline tracking-widest"
                          >
                            Abrir en Pestaña Nueva
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={startCamera}
                        className="px-6 py-2 bg-secondary/20 text-secondary rounded-xl text-xs font-bold uppercase"
                      >
                        Activar Cámara
                      </button>
                    </>
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest text-center">
              La IA evaluará la limpieza automáticamente después de que ingreses el área.
            </p>
          </motion.div>
        ) : step === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">Identificar Área</h2>
              <p className="text-primary/60 font-medium">¿Qué espacio acabas de limpiar?</p>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 shadow-xl mb-4">
              <img src={capturedImage!} alt="Captura" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-2">Nombre del Área / Ubicación</label>
                <input 
                  type="text" 
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="Ej: Quirófano A, Pasillo 4, Oficina 201..."
                  autoFocus
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary transition-all outline-none"
                />
              </div>

              <button 
                onClick={handleStartAnalysis}
                className="w-full h-14 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
              >
                Analizar con IA
              </button>

              <button 
                onClick={() => {
                  setCapturedImage(null);
                  setStep("capture");
                }}
                className="w-full py-2 text-primary/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
              >
                Volver a tomar foto
              </button>
            </div>
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
              analysis?.score >= 75 ? "bg-secondary/10 border-secondary/20" : "bg-error/10 border-error/20"
            )}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2 bg-white/5">
                {analysis?.score >= 75 ? (
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

            {analysis?.score >= 75 && (
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
                onClick={() => {
                  setCapturedImage(null);
                  setStep("capture");
                }}
                className="flex-1 h-14 glass-panel rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white active:scale-95 transition-transform"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
              <button 
                onClick={handleFinishService}
                disabled={loading}
                className="flex-[2] h-14 bg-secondary rounded-2xl flex items-center justify-center text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Finalizar Servicio"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
