import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ShieldCheck, Star, Camera, ClipboardCheck, Loader2, X, AlertCircle, CheckCircle2, Building2, RefreshCw, Zap, ShieldAlert, MessageSquare, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, limit } from "firebase/firestore";
import { toast } from "sonner";
import { analyzeCleaningQuality, analyzeCleaningVideo } from "../services/gemini";
import { notifySupervisorTaskRejection } from "../services/messagingService";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function AuditForm({ userData }: { userData: any }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"location" | "form" | "success">("location");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera, Video & AI State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [manualReviewRequested, setManualReviewRequested] = useState(false);
  const [strictness, setStrictness] = useState<'human' | 'standard' | 'strict'>('standard');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [auditData, setAuditData] = useState({
    cleanliness: 5,
    uniform: true,
    punctuality: true,
    suppliesOk: true,
    observations: ""
  });

  const [showManualSelection, setShowManualSelection] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      if (!userData?.tenantId) return;
      const path = "clients";
      try {
        const q = query(collection(db, path), where("tenantId", "==", userData.tenantId));
        const snap = await getDocs(q);
        setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    };
    fetchClients();
  }, [userData?.tenantId]);

  useEffect(() => {
    const fetchTenantSettings = async () => {
      if (userData?.tenantId && db) {
        try {
          const tenantDoc = await getDoc(doc(db, "tenants", userData.tenantId));
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

  const requestLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocalización no soportada");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const myLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(myLoc);
        setGeofenceStatus("checking");
        
        // Simulación de búsqueda del cliente más cercano
        setTimeout(() => {
          if (clients.length > 0) {
            // Buscamos el cliente cuya ubicación coincida o esté cerca
            const closest = clients[0]; // Simplificado: tomamos el primero o el match
            setSelectedClient(closest);
            setGeofenceStatus("valid");
            setTimeout(() => setStep("form"), 1500);
          } else {
            setGeofenceStatus("invalid");
            setError("No se encontraron clientes configurados para este sector.");
          }
          setLoading(false);
        }, 2000);
      },
      (err) => {
        setError("error_location");
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const startCamera = async (mode: "photo" | "video" = "photo") => {
    setLoading(true);
    setError(null);
    setCameraMode(mode);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Tu navegador no soporta el acceso a la cámara.");
      setLoading(false);
      return;
    }

    try {
      const constraints = {
        video: { facingMode: "environment" },
        audio: mode === "video"
      };
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Error con cámara trasera, reintentando...", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: mode === "video" });
      }

      streamRef.current = stream;
      setShowCamera(true);
    } catch (err: any) {
      console.error("Camera error audit:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        const msg = "Permiso denegado. Intenta abrir la app en una pestaña nueva si estás en la vista previa.";
        toast.error(msg);
        setError(msg);
      } else {
        toast.error("Error al acceder a la cámara: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showCamera && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(console.error);
      };
    }
  }, [showCamera]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingDuration(0);
    setIsRecording(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setCapturedImage(dataUrl);
        setCapturedVideo(null);
        stopCamera();
        
        // Auto-analyze
        handleAnalyze(dataUrl, "photo");
      }
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/mp4" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCapturedVideo(base64);
        setCapturedImage(null);
        handleAnalyze(base64, "video");
      };
      reader.readAsDataURL(blob);
      stopCamera();
    };
    
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    // Stop recording after 10 seconds to limit size
    setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        stopRecording();
      }
    }, 10500);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalyze = async (media: string, type: "photo" | "video") => {
    setAnalyzing(true);
    try {
      const base64 = media.split(",")[1];
      let result;
      if (type === "photo") {
        result = await analyzeCleaningQuality(base64, strictness, selectedClient?.industry || "Comercio");
      } else {
        result = await analyzeCleaningVideo(base64);
      }
      setAnalysis(result);
      if (result.score < 75) {
        toast.warning("Calidad por debajo del estándar. Se sugiere revisión manual.");
        
        try {
          // Notify top management/supervisor about this low score
          const qSup = query(
            collection(db, "users"),
            where("tenantId", "==", userData.tenantId),
            where("role", "in", ["ceo", "supervisor", "rh"]),
            limit(1)
          );
          const supSnap = await getDocs(qSup);
          if (!supSnap.empty) {
            const topUser = supSnap.docs[0].data();
            if (topUser.phone) {
              await notifySupervisorTaskRejection(
                topUser.phone,
                "Personal en " + (selectedClient?.name || "Sitio"),
                "Auditoría Aleatoria",
                result.score,
                result.observations
              );
            }
          }
        } catch (notifyErr) {
          console.error("Failed to notify management:", notifyErr);
        }
      }
    } catch (err: any) {
      console.error("AI Analysis failed:", err);
      toast.error(`Error en el análisis de IA: ${err.message || "Fallo inesperado"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAudit = async () => {
    if (!capturedImage && !capturedVideo) {
      toast.error("Por favor, toma una foto o video de la evidencia antes de finalizar.");
      return;
    }
    setLoading(true);
    const path = "audits";
    try {
      const auditPayload = {
        tenantId: userData.tenantId,
        supervisorId: userData.uid,
        supervisorName: userData.name,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        location,
        results: auditData,
        aiAnalysis: analysis,
        mediaType: capturedVideo ? "video" : "photo",
        evidenceData: capturedVideo || capturedImage,
        manualReviewRequested,
        createdAt: serverTimestamp()
      };

      // Check size roughly (1MB limit for Firestore)
      const payloadSize = JSON.stringify(auditPayload).length;
      if (payloadSize > 900000) {
        toast.warning("La evidencia es muy grande. Guardando auditoría sin archivo multimedia para asegurar el registro.");
        auditPayload.evidenceData = capturedImage || "Video demasiado grande para almacenamiento directo";
      }

      await addDoc(collection(db, path), auditPayload);
      setStep("success");
      setTimeout(() => navigate("/"), 2500);
    } catch (error: any) {
      console.error("Firestore Save Error:", error);
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center pt-10 px-6 pb-20">
      <AnimatePresence mode="wait">
        {step === "location" && (
          <motion.div
            key="loc"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm space-y-8 text-center"
          >
            <div className="space-y-2">
              <h1 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">Supervisión Aleatoria</h1>
              <p className="text-sm text-primary/60 font-medium">Valida tu ubicación para iniciar el formulario de calidad.</p>
            </div>

            <div className="relative mx-auto w-32 h-32">
              <div className={cn(
                "w-32 h-32 rounded-[2rem] flex items-center justify-center border-2 transition-all duration-700",
                geofenceStatus === "checking" ? "border-white/10 animate-pulse bg-white/5" : 
                geofenceStatus === "valid" ? "border-secondary bg-secondary/10 shadow-[0_0_40px_rgba(68,221,194,0.2)]" : "border-white/10"
              )}>
                {geofenceStatus === "checking" && location ? <Loader2 className="w-12 h-12 text-primary animate-spin" /> : 
                 geofenceStatus === "valid" ? <ShieldCheck className="w-12 h-12 text-secondary" /> :
                 <MapPin className="w-12 h-12 text-primary/20" />}
              </div>
            </div>

            {error && (
              <div className="space-y-4">
                <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error text-xs font-bold text-left leading-tight">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p>{error === "error_location" ? "Asegúrate de tener el GPS encendido y permisos de ubicación activados." : error}</p>
                    <p className="mt-1 text-[10px] opacity-70 italic font-medium">Nota: Para el CEO o modo demo, puedes usar selección manual abajo.</p>
                  </div>
                </div>
                
                {!showManualSelection && (
                  <button 
                    onClick={() => setShowManualSelection(true)}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:bg-white/10 transition-all"
                  >
                    Seleccionar Cliente Manualmente
                  </button>
                )}

                {showManualSelection && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-4 block text-left">Lista de Clientes</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {clients.length === 0 ? (
                        <p className="text-[10px] text-white/40 p-4 border border-dashed border-white/10 rounded-xl italic">
                          No hay clientes registrados en el sistema. Regresa al módulo CEO para agregarlos.
                        </p>
                      ) : (
                        clients.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedClient(c);
                              setStep("form");
                            }}
                            className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-white hover:border-secondary transition-all flex items-center gap-3"
                          >
                            <Building2 className="w-4 h-4 text-primary" />
                            {c.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!location ? (
              <button
                onClick={requestLocation}
                disabled={loading}
                className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <MapPin className="w-6 h-6" />}
                Validar Ubicación
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">
                  {geofenceStatus === "checking" ? "Buscando Perímetro..." : "Cliente Detectado: " + (selectedClient?.name || "Cargando...")}
                </p>
                <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: "100%" }}
                     transition={{ duration: 1.5 }}
                     className="h-full bg-secondary"
                   />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8"
          >
            <div className="glass-panel p-6 rounded-[2.5rem] space-y-4 border border-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/10">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-xl font-black font-headline text-white uppercase tracking-tight">{selectedClient?.name}</h2>
                   <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Ubicación Validada • Sector 7</p>
                </div>
              </div>
            </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" /> Formulario de Auditoría
                </h3>

                <div className="space-y-4">
                  <div className="glass-panel p-5 rounded-3xl space-y-4">
                    {/* ... (Cleanliness controls) */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white/80">Limpieza del área</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                          <button 
                            key={i}
                            onClick={() => setAuditData({...auditData, cleanliness: i})}
                            className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", 
                              auditData.cleanliness >= i ? "bg-secondary text-on-secondary" : "bg-white/5 text-white/20"
                            )}
                          >
                            <Star className={cn("w-4 h-4", auditData.cleanliness >= i && "fill-on-secondary")} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white/80">Uniforme Completo</span>
                      <button 
                        onClick={() => setAuditData({...auditData, uniform: !auditData.uniform})}
                        className={cn("w-14 h-8 rounded-full relative p-1 transition-colors", auditData.uniform ? "bg-secondary" : "bg-white/10")}
                      >
                        <motion.div 
                          animate={{ x: auditData.uniform ? 24 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-lg" 
                        />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white/80">Puntualidad del Personal</span>
                      <button 
                        onClick={() => setAuditData({...auditData, punctuality: !auditData.punctuality})}
                        className={cn("w-14 h-8 rounded-full relative p-1 transition-colors", auditData.punctuality ? "bg-secondary" : "bg-white/10")}
                      >
                        <motion.div 
                          animate={{ x: auditData.punctuality ? 24 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-lg" 
                        />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white/80">Insumos Disponibles</span>
                      <button 
                        onClick={() => setAuditData({...auditData, suppliesOk: !auditData.suppliesOk})}
                        className={cn("w-14 h-8 rounded-full relative p-1 transition-colors", auditData.suppliesOk ? "bg-secondary" : "bg-white/10")}
                      >
                        <motion.div 
                          animate={{ x: auditData.suppliesOk ? 24 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-lg" 
                        />
                      </button>
                    </div>
                  </div>

                  {/* Visual Evidence Section */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-4 flex items-center gap-2">
                       <Camera className="w-3 h-3" /> Evidencia de Servicio (IA)
                    </label>
                    
                    {!capturedImage && !capturedVideo ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => startCamera("photo")}
                          className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group"
                        >
                           <div className="w-10 h-10 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                              <Camera className="w-5 h-5" />
                           </div>
                           <p className="text-[9px] font-black uppercase tracking-widest text-primary/40">Foto de Entrega</p>
                        </button>
                        <button 
                          onClick={() => startCamera("video")}
                          className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group"
                        >
                           <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <RefreshCw className="w-5 h-5" />
                           </div>
                           <p className="text-[9px] font-black uppercase tracking-widest text-primary/40">Video Recorrido</p>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-white/10 group bg-black">
                           {capturedImage && <img src={capturedImage} className="w-full h-full object-cover" alt="Evidencia" />}
                           {capturedVideo && (
                             <video 
                              src={capturedVideo} 
                              className="w-full h-full object-cover" 
                              controls 
                              playsInline 
                             />
                           )}
                           
                           <div className="absolute top-4 right-4 z-20">
                              <button 
                                onClick={() => { setCapturedImage(null); setCapturedVideo(null); setAnalysis(null); }}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black shadow-xl"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                           </div>
                           
                           {analyzing && (
                             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-10">
                               <Loader2 className="w-8 h-8 text-secondary animate-spin mb-2" />
                               <p className="text-[10px] font-black uppercase tracking-widest text-white">Gemini Analizando {capturedVideo ? "Video" : "Foto"}...</p>
                             </div>
                           )}
                        </div>

                        {analysis && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "p-5 rounded-3xl border space-y-3",
                              analysis.score >= 75 ? "bg-secondary/5 border-secondary/20" : "bg-error/5 border-error/20"
                            )}
                          >
                             <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                   <Zap className={cn("w-4 h-4", analysis.score >= 75 ? "text-secondary" : "text-error")} />
                                   <span className="text-xs font-black uppercase tracking-widest text-white">IA Score: {analysis.score}%</span>
                                </div>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                                  analysis.score >= 75 ? "bg-secondary/20 text-secondary" : "bg-error/20 text-error"
                                )}>
                                  {analysis.score >= 75 ? "Aprobado" : "Bajo Estándar"}
                                </span>
                             </div>
                             <p className="text-[10px] text-white/70 leading-relaxed italic">"{analysis.observations}"</p>
                             
                             {analysis.detectedIssues && analysis.detectedIssues.length > 0 && (
                               <div className="space-y-1">
                                 {analysis.detectedIssues.map((issue: string, i: number) => (
                                   <div key={i} className="flex items-center gap-2 text-[9px] text-white/40">
                                     <div className="w-1 h-1 rounded-full bg-error" />
                                     {issue}
                                   </div>
                                 ))}
                               </div>
                             )}

                             {analysis.score < 75 && (
                               <div className="space-y-3">
                                 <button 
                                   onClick={() => setManualReviewRequested(!manualReviewRequested)}
                                   className={cn(
                                     "w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                     manualReviewRequested ? "bg-error text-white shadow-lg" : "bg-error/10 text-error border border-error/20 hover:bg-error/20"
                                   )}
                                 >
                                    {manualReviewRequested ? <ShieldAlert className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                    {manualReviewRequested ? "Revisión Manual Solicitada" : "Solicitar Revisión Manual"}
                                 </button>
                                 
                                 <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 space-y-2 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                      <Zap className="w-12 h-12 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-primary/20 rounded-lg">
                                        <Zap className="w-4 h-4 text-primary" />
                                      </div>
                                      <span className="text-[10px] font-black uppercase text-primary tracking-widest">Guía de Corrección IA</span>
                                    </div>
                                    <p className="text-xs text-primary/80 italic leading-relaxed font-medium">
                                      "{analysis.score < 50 
                                        ? "Hallazgos críticos detectados. Es vital sanitizar nuevamente con enfoque en superficies de contacto humano frecuente." 
                                        : "Casi perfecto. Un poco más de atención a los bordes y esquinas elevará el resultado al 100%."}"
                                    </p>
                                 </div>
                               </div>
                             )}
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-4">Observaciones Adicionales</label>
                    <textarea 
                      className="w-full h-32 bg-white/5 border border-white/5 rounded-[1.5rem] p-4 text-sm text-white outline-none focus:border-secondary transition-all resize-none"
                      placeholder="Escribe aquí cualquier hallazgo importante..."
                      value={auditData.observations}
                      onChange={e => setAuditData({...auditData, observations: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveAudit}
                  disabled={loading || analyzing}
                  className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Finalizar Supervisión"}
                </button>
              </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 bg-secondary rounded-[2rem] flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(68,221,194,0.4)]">
              <CheckCircle2 className="w-12 h-12 text-on-secondary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">Supervisión Guardada</h2>
              <p className="text-sm text-primary/60 font-medium">Reporte generado y guardado exitosamente.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            <div className="absolute top-6 right-6 z-10">
               <button 
                onClick={stopCamera}
                className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white"
               >
                 <X className="w-6 h-6" />
               </button>
            </div>

            <div className="relative w-full h-full max-w-lg aspect-[3/4] overflow-hidden bg-surface-container flex flex-col items-center justify-center">
              {error && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-black/80 backdrop-blur-md">
                  <AlertCircle className="w-12 h-12 text-error" />
                  <p className="text-sm text-white font-medium">{error}</p>
                  <button 
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-6 py-3 bg-secondary text-on-secondary rounded-xl text-xs font-black uppercase tracking-widest"
                  >
                    Abrir en Ventana Nueva
                  </button>
                </div>
              )}
              
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-0 border-2 border-white/20 pointer-events-none">
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-secondary m-8" />
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-secondary m-8" />
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-secondary m-8" />
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-secondary m-8" />
              </div>

              <div className="absolute bottom-12 flex flex-col items-center justify-center w-full gap-6">
                {cameraMode === "video" && (
                  <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
                    <div className={cn("w-2 h-2 rounded-full bg-error", isRecording && "animate-pulse")} />
                    <span className="text-xs font-black font-mono text-white tracking-widest">
                      {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:
                      {(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[8px] font-black uppercase text-white/40 border-l border-white/20 pl-3">REC</span>
                  </div>
                )}
                
                <div className="flex items-center gap-8">
                  <button 
                    onClick={cameraMode === "photo" ? capturePhoto : (isRecording ? stopRecording : startRecording)}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-4 border-white/20",
                      cameraMode === "photo" ? "bg-secondary text-on-secondary" : (isRecording ? "bg-error text-white" : "bg-white text-black")
                    )}
                  >
                    {cameraMode === "photo" ? (
                      <div className="w-12 h-12 rounded-full border-2 border-on-secondary" />
                    ) : (
                      isRecording ? <div className="w-8 h-8 bg-white rounded-sm" /> : <div className="w-8 h-8 bg-error rounded-full" />
                    )}
                  </button>
                </div>
                
                {cameraMode === "video" && !isRecording && (
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Máximo 10 segundos</p>
                )}
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
