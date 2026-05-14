import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Star,
  QrCode,
  ClipboardList,
  Loader2,
  User,
  Trophy,
  Users as UsersIcon,
  ChevronRight,
  Camera,
  Target,
  Power,
  Zap,
  BrainCircuit,
  UserCheck,
  MapPin,
  ShieldCheck,
  X,
  LogOut,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  orderBy,
  limit,
  increment,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { signOut } from "firebase/auth";
import { analyzeCleaningQuality } from "../services/gemini";
import { notifySupervisorTaskRejection } from "../services/messagingService";
import { toast } from "sonner";

export default function TotemTabletView({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingService, setCallingService] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "ranking" | "activity"
  >("dashboard");
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [activityMode, setActivityMode] = useState<"checkin" | "audit" | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [topOperators, setTopOperators] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (activityMode && !selfie && !capturedImage) {
      startCamera();
    }
    return () => stopCamera();
  }, [activityMode, selfie, capturedImage]);

  useEffect(() => {
    if (!clientId) return;

    // Fetch Client Info
    const unsubscribeClient = onSnapshot(
      doc(db, "clients", clientId),
      (docSnap) => {
        if (docSnap.exists()) {
          const clientData = { id: docSnap.id, ...docSnap.data() } as any;
          setClient(clientData);

          // Once we have tenantId, we can subscribe to other data safely
          const today = new Date().toISOString().split("T")[0];
          
          // Fetch Today's Tasks for this specific tenant and client
          const qTasks = query(
            collection(db, "tasks"),
            where("tenantId", "==", clientData.tenantId),
            where("clientId", "==", clientId),
            where("scheduledDate", "==", today),
          );

          const unsubscribeTasks = onSnapshot(qTasks, 
            (snapshot) => {
              setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
              setLoading(false);
            },
            (error) => {
              handleFirestoreError(error, OperationType.LIST, "tasks");
              setLoading(false);
            }
          );

          // Fetch Active Attendance
          const qAttend = query(
            collection(db, "attendance"),
            where("tenantId", "==", clientData.tenantId),
            where("clientId", "==", clientId),
            where("date", "==", today),
            where("type", "==", "check-in"),
          );
          const unsubAttend = onSnapshot(qAttend, (snap) => {
            setAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, "attendance");
          });

          // Fetch Top Operators for this Tenant
          const qOps = query(
            collection(db, "users"),
            where("tenantId", "==", clientData.tenantId),
            where("role", "==", "operator"),
            orderBy("points", "desc"),
            limit(10),
          );

          const unsubOps = onSnapshot(qOps, (snap) => {
            setTopOperators(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }, (error) => {
             handleFirestoreError(error, OperationType.LIST, "users");
          });

          // Fetch team members for this specific client
          const qTeam = query(
            collection(db, "users"),
            where("tenantId", "==", clientData.tenantId),
            where("role", "==", "operator"),
            where("clientId", "==", clientId),
          );
          const unsubTeam = onSnapshot(qTeam, (snap) => {
            setTeam(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }, (error) => {
             handleFirestoreError(error, OperationType.LIST, "users (team)");
          });

          return () => {
            unsubscribeTasks();
            unsubAttend();
            unsubOps();
            unsubTeam();
          };
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `clients/${clientId}`);
      }
    );

    return () => {
      unsubscribeClient();
    };
  }, [clientId]);

  const startCamera = async () => {
    try {
      stopCamera(); // Ensure previous stream is closed
      
      // Try with specific requirements first
      const config: MediaStreamConstraints = {
        video: {
          facingMode: activityMode === "checkin" ? "user" : { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(config);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play().catch(e => console.error("Video play failed:", e));
        }
      } catch (innerErr: any) {
        // Fallback to basic video if facingMode fails
        console.warn("Retrying camera with basic config due to:", innerErr);
        const basicStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = basicStream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play().catch(e => console.error("Video play failed (basic):", e));
        }
      }
    } catch (err: any) {
      console.error("Camera error final:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Permiso denegado: Por favor habilita el acceso a la cámara en el candado de la barra de direcciones.");
      } else {
        toast.error(`Error de cámara: ${err.message || "No se pudo acceder"}`);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result as string;
        if (activityMode === "checkin") setSelfie(data);
        else setCapturedImage(data);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  };

  const capturePhoto = (isSelfie: boolean = true) => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      const maxDim = 1024;
      let width = videoRef.current.videoWidth;
      let height = videoRef.current.videoHeight;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvasRef.current.width = width;
      canvasRef.current.height = height;
      context?.drawImage(videoRef.current, 0, 0, width, height);
      const data = canvasRef.current.toDataURL("image/jpeg", 0.7);
      if (isSelfie) setSelfie(data);
      else setCapturedImage(data);
      stopCamera();
    }
  };

  const handleCheckIn = async () => {
    if (!client || !selectedOperator || isSubmitting) return;

    setIsSubmitting(true);
    // Prevent double check-in (re-verify state)
    const alreadyCheckedIn = attendance.find(
      (a) => a.userId === selectedOperator.id,
    );
    if (alreadyCheckedIn) {
      toast.error(
        `${selectedOperator.name} ya registró su entrada a las ${alreadyCheckedIn.time}`,
      );
      setActivityMode(null);
      setSelectedOperator(null);
      setIsSubmitting(false);
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
        });
      });

      const today = new Date().toISOString().split("T")[0];
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const newCheckIn = {
        userId: selectedOperator.id,
        operatorName: selectedOperator.name,
        type: "check-in",
        timestamp: serverTimestamp(),
        date: today,
        time: timeStr,
        location: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        },
        selfieUrl: selfie,
        clientId: clientId,
        tenantId: client.tenantId,
        source: "totem",
      };

      await addDoc(collection(db, "attendance"), newCheckIn);
      await updateDoc(doc(db, "users", selectedOperator.id), {
        lastCheckIn: serverTimestamp(),
        status: "active",
      });

      toast.success(`Check-In exitoso: ${selectedOperator.name}`);
      setSelfie(null);
      setActivityMode(null);
      setSelectedOperator(null);
      setActiveTab("dashboard");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "attendance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuditAction = async () => {
    if (!client || !selectedOperator || isSubmitting) return;
    setIsSubmitting(true);
    setAnalyzing(true);
    
    let auditResult = null;
    try {
      const base64 = capturedImage!.split(",")[1];
      auditResult = await analyzeCleaningQuality(base64, "standard", client?.industry || "Comercio");
      setAnalysis(auditResult);
    } catch (error: any) {
      console.error("Gemini Audit Error (Falling back to manual):", error);
      toast.error(`La IA no pudo procesar la imagen, pero guardaremos tu evidencia: ${error.message}`);
    }

    try {
      // Try to find an existing pending task for this area
      const existingTask = tasks.find(t => 
        t.status === 'pending' && 
        (t.areaName === selectedArea || (t.title && t.title.includes(selectedArea || "")))
      );

      const taskData = {
        score: auditResult ? auditResult.score : 0,
        status: auditResult ? (auditResult.score < 75 ? "pending_review" : "completed") : "pending_review",
        aiNotes: auditResult ? auditResult.observations : "Pendiente de revisión manual (Falla en conexión IA)",
        afterPhoto: capturedImage,
        completedAt: serverTimestamp(),
        operatorId: selectedOperator.id,
        operatorName: selectedOperator.name,
        source: "totem",
        updatedAt: serverTimestamp()
      };

      if (existingTask) {
        await updateDoc(doc(db, "tasks", existingTask.id), taskData);
      } else {
        const newTask = {
          ...taskData,
          title: `Validación Tótem: ${selectedArea || client?.name || "Área"}`,
          areaName: selectedArea || client?.name || "General",
          clientId: clientId,
          createdAt: serverTimestamp(),
          scheduledDate: new Date().toISOString().split("T")[0],
          tenantId: client.tenantId,
        };
        await addDoc(collection(db, "tasks"), newTask);
      }

      if (auditResult) {
        if (auditResult.score < 75) {
          try {
            // Find supervisor for this tenant to notify
            const qSup = query(
              collection(db, "users"),
              where("tenantId", "==", client.tenantId),
              where("role", "in", ["supervisor", "ceo", "rh"]),
              limit(1)
            );
            const supSnap = await getDocs(qSup);
            if (!supSnap.empty) {
              const supervisor = supSnap.docs[0].data();
              if (supervisor.phone) {
                await notifySupervisorTaskRejection(
                  supervisor.phone,
                  selectedOperator.name,
                  selectedArea || "General",
                  auditResult.score,
                  auditResult.observations
                );
                console.log("[Totem] Notificación enviada al supervisor:", supervisor.name);
              }
            }
          } catch (notifyErr) {
            console.error("Failed to notify supervisor:", notifyErr);
          }
        }

        const pointsWon = Math.floor(auditResult.score * 1.5);
        await updateDoc(doc(db, "users", selectedOperator.id), {
          points: increment(pointsWon),
          updatedAt: serverTimestamp(),
        });
        toast.success(`Validado: +${pointsWon} puntos para ${selectedOperator.name}`);
      } else {
        toast.info("Evidencia guardada correctamente (Pendiente de revisión manual)");
      }

      setSelectedOperator(null);
      setActivityMode(null);
      setSelectedArea(null);
      setActiveTab("dashboard");
    } catch (error: any) {
      console.error("Audit error:", error);
      handleFirestoreError(error, OperationType.WRITE, "tasks");
      toast.error("Error al guardar la evidencia en la base de datos");
    } finally {
      setIsSubmitting(false);
      setAnalyzing(false);
      setCapturedImage(null);
      setAnalysis(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Estación cerrada correctamente");
    } catch (e: any) {
      console.error(e);
      toast.error("Error al cerrar sesión");
    }
  };

  const handleCallService = async () => {
    setCallingService(true);
    try {
      await addDoc(collection(db, "incidents"), {
        clientId: clientId,
        clientName: client?.name || "Desconocido",
        type: "service_request",
        description: "Solicitud de asistencia inmediata desde Estación Tótem",
        status: "open",
        priority: "high",
        createdAt: serverTimestamp(),
        tenantId: client?.tenantId,
        source: "totem",
      });

      toast.success(
        "Solicitud enviada. Un operario será notificado inmediatamente.",
      );
    } catch (e: any) {
      console.error("Error calling service:", e);
      toast.error("Error al enviar solicitud: " + e.message);
    } finally {
      setTimeout(() => setCallingService(false), 2000);
    }
  };

  if (loading && !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-secondary animate-spin" />
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const auditedTasks = tasks.filter((t) => t.status === "completed" || t.status === "rejected");
  const progress =
    tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
  
  const avgScore = auditedTasks.length > 0
    ? auditedTasks.reduce((acc, t) => acc + (t.score || 0), 0) / auditedTasks.length
    : 0;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col font-headline overflow-hidden">
      {/* Top Header */}
      <header className="p-8 md:p-12 pb-6 flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-on-secondary shadow-[0_0_20px_rgba(68,221,194,0.3)]">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
              Impeccable{" "}
              <span className="text-secondary font-headline not-italic">
                TÓTEM
              </span>
            </h1>
          </div>
          <p className="text-primary/40 font-black uppercase tracking-[0.3em] text-sm">
            {client?.name || "Cargando Cliente..."}
          </p>
        </div>

        <div className="flex gap-8 items-start">
          <button
            onClick={handleLogout}
            className="h-14 px-6 bg-white/5 hover:bg-error/10 border border-white/10 rounded-2xl flex items-center gap-3 text-primary/40 hover:text-error transition-all font-black uppercase text-[10px] tracking-widest"
          >
            <LogOut className="w-5 h-5" /> Cerrar Estación
          </button>
          <div className="text-right">
            <p className="text-5xl font-black tracking-tighter">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">
              {new Date().toLocaleDateString([], {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-8 md:px-12 pb-12 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          {/* Left Side: Dynamic Tab Content */}
          <div className="lg:col-span-8 flex flex-col gap-8 h-full overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex-1 flex flex-col gap-8 h-full overflow-hidden"
                >
                  {/* Main Action Card: Check-In */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setActiveTab("activity");
                      setActivityMode("checkin");
                      setSelectedOperator(null);
                    }}
                    className="flex-1 bg-secondary rounded-[3.5rem] p-12 flex flex-col items-center justify-center gap-6 shadow-[0_30px_90px_rgba(68,221,194,0.15)] border-b-8 border-[#38b19a] active:border-b-0 active:translate-y-2 transition-all group relative overflow-hidden"
                  >
                    {/* Animated Background Decorative Elements */}
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="relative w-48 h-48 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-2xl">
                      <UserCheck className="w-24 h-24 text-white" />
                    </div>
                    <div className="relative text-center space-y-4">
                      <h2 className="text-6xl font-black uppercase tracking-tighter text-on-secondary italic leading-[0.9]">
                        Registro de
                        <br />
                        Entrada
                      </h2>
                      <p className="text-xl font-bold uppercase tracking-[0.2em] text-on-secondary/60">
                        Check-In Biométrico & Geo
                      </p>
                    </div>
                  </motion.button>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-2 flex flex-col justify-between group hover:border-secondary/30 transition-colors">
                      <div className="flex items-center gap-3 text-secondary">
                        <CheckCircle2 className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Ritmo Hoy
                        </span>
                      </div>
                      <div>
                        <p className="text-5xl font-black tracking-tighter">
                          {Math.round(progress)}%
                        </p>
                        <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-secondary"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-2 group hover:border-secondary/30 transition-colors">
                      <div className="flex items-center gap-3 text-secondary">
                        <ClipboardList className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Hitos
                        </span>
                      </div>
                      <p className="text-5xl font-black tracking-tighter">
                        {completedTasks.length}
                        <span className="text-xl text-primary/20">
                          /{tasks.length}
                        </span>
                      </p>
                    </div>
                    <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-2 group hover:border-secondary/30 transition-colors">
                      <div className="flex items-center gap-3 text-secondary">
                        <Star className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Nivel Calidad
                        </span>
                      </div>
                      <p className="text-5xl font-black tracking-tighter">
                        {avgScore > 0 ? (avgScore / 20).toFixed(1) : "0.0"}
                      </p>
                    </div>
                  </div>

                  {/* Areas Completadas Section */}
                  <div className="glass-panel p-10 rounded-[3rem] border border-white/5 flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-secondary" />
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Zonas Certificadas Hoy</h3>
                      </div>
                      <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">
                        {auditedTasks.length} Registradas
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                      {auditedTasks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {auditedTasks.sort((a,b) => (b.completedAt?.toMillis?.() || 0) - (a.completedAt?.toMillis?.() || 0)).map((task, i) => (
                            <motion.div 
                              key={task.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className="p-5 bg-white/5 rounded-3xl border border-white/5 flex items-center gap-4 group hover:bg-white/10 transition-all relative overflow-hidden"
                            >
                              {task.status === 'rejected' && (
                                <div className="absolute top-0 right-0 px-2 py-1 bg-error/20 text-error text-[8px] font-black uppercase rounded-bl-xl border-l border-b border-error/30 z-10">
                                  Rechazado IA
                                </div>
                              )}
                              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                                {task.afterPhoto ? (
                                  <img src={task.afterPhoto} className="w-full h-full object-cover" alt="Audit" />
                                ) : (
                                  <BrainCircuit className="w-6 h-6 text-primary/20" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-[10px] font-black uppercase tracking-widest truncate",
                                  task.status === 'rejected' ? "text-error" : "text-secondary"
                                )}>{task.areaName}</p>
                                <p className="text-xs font-bold text-white truncate">{task.operatorName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                     <div className={cn("h-full", task.status === 'rejected' ? "bg-error" : "bg-secondary")} style={{ width: `${task.score}%` }} />
                                  </div>
                                  <span className={cn("text-[9px] font-black", task.status === 'rejected' ? "text-error" : "text-secondary")}>{task.score}%</span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center py-10 opacity-20 text-center gap-4">
                          <Target className="w-16 h-16" />
                          <p className="text-sm font-black uppercase tracking-[0.2em]">Inicie una auditoría para ver resultados</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "ranking" && (
                <motion.div
                  key="ranking"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 glass-panel rounded-[3.5rem] p-12 border border-white/5 space-y-8 h-full overflow-hidden flex flex-col shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-secondary">
                        <Trophy className="w-8 h-8 font-black" />
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic">
                          Cuadro de Honor
                        </h2>
                      </div>
                      <p className="text-xs text-primary/40 font-black uppercase tracking-widest">
                        Líderes en excelencia y compromiso
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-primary/40 font-black uppercase tracking-widest">
                        Puntos Acumulados
                      </p>
                      <p className="text-2xl font-black text-secondary">
                        TOP 5
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1 overflow-y-auto pr-4 custom-scrollbar">
                    {topOperators.map((op, i) => (
                      <motion.div
                        key={op.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 group hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary relative">
                            {i === 0 ? (
                              <Trophy className="w-8 h-8" />
                            ) : (
                              <User className="w-8 h-8" />
                            )}
                            <div className="absolute -top-2 -left-2 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-on-secondary font-black text-sm border-4 border-background">
                              {i + 1}
                            </div>
                          </div>
                          <div>
                            <p className="text-xl font-black uppercase tracking-tight text-white">
                              {op.name}
                            </p>
                            <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest">
                              Operador de Excelencia
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black tracking-tighter text-secondary">
                            {op.points || 0}
                          </p>
                          <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest italic">
                            Puntos XP
                          </p>
                        </div>
                      </motion.div>
                    ))}
                    {topOperators.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-primary/20 gap-4">
                        <Trophy className="w-16 h-16 opacity-20" />
                        <p className="text-sm font-black uppercase tracking-widest">
                          Esperando primeras hazañas...
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "activity" && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 flex flex-col gap-8 h-full"
                >
                  {activityMode === "audit" && !selectedArea ? (
                      <div className="glass-panel flex-1 rounded-[3.5rem] p-10 border border-white/5 flex flex-col gap-8 overflow-hidden">
                        <div className="text-center space-y-2">
                          <h2 className="text-4xl font-black font-headline text-white uppercase tracking-tighter italic">
                            Seleccionar Área
                          </h2>
                          <p className="text-sm text-primary/40 font-black uppercase tracking-widest">
                            ¿Qué sector estás auditando?
                          </p>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar grid grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                          {(
                            client?.areas || [
                              "Lobby Principal",
                              "Baños Nivel 1",
                              "Oficinas Gerencia",
                              "Cafetería",
                              "Área Común",
                              "Estacionamiento",
                            ]
                          ).map((area: string) => {
                            const isCompleted = completedTasks.some(t => t.areaName === area);
                            return (
                              <button
                                key={area}
                                onClick={() => setSelectedArea(area)}
                                className={cn(
                                  "p-8 rounded-[2.5rem] border transition-all flex flex-col items-center justify-center gap-6 group text-center relative overflow-hidden",
                                  isCompleted 
                                    ? "bg-secondary/10 border-secondary/30 grayscale-[0.5]" 
                                    : "bg-white/5 border-white/5 hover:border-primary/40 hover:bg-primary/5"
                                )}
                              >
                                {isCompleted && (
                                  <div className="absolute top-4 right-4 animate-in fade-in zoom-in">
                                    <CheckCircle2 className="w-6 h-6 text-secondary" />
                                  </div>
                                )}
                                <div className={cn(
                                  "w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110",
                                  isCompleted ? "bg-secondary/20" : "bg-primary/10"
                                )}>
                                  <MapPin className={cn("w-8 h-8", isCompleted ? "text-secondary" : "text-primary")} />
                                </div>
                                <div>
                                  <p className="text-lg font-black text-white uppercase tracking-tight leading-tight italic">
                                    {area}
                                  </p>
                                  {isCompleted && <p className="text-[8px] font-black text-secondary uppercase mt-2 tracking-widest">Ya Completado</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => {
                            setActivityMode(null);
                            setSelectedOperator(null);
                          }}
                          className="mt-4 text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] hover:text-white transition-colors"
                        >
                          ← Cambiar Acción
                        </button>
                      </div>
                    ) : !selectedOperator ? (
                      <div className="glass-panel flex-1 rounded-[3.5rem] p-10 border border-white/5 flex flex-col gap-8 overflow-hidden">
                        <div className="text-center space-y-2">
                          <h2 className="text-4xl font-black font-headline text-white uppercase tracking-tighter">
                            Identificación Biométrica
                          </h2>
                          <p className="text-sm text-primary/40 font-black uppercase tracking-widest">
                            Selecciona el perfil para iniciar acción
                          </p>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar grid grid-cols-2 md:grid-cols-4 gap-6 pb-6">
                          {team.map((op) => (
                            <button
                              key={op.id}
                              onClick={() => setSelectedOperator(op)}
                              className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 hover:border-secondary/40 hover:bg-secondary/5 transition-all flex flex-col items-center gap-6 group"
                            >
                              <div className="w-24 h-24 rounded-3xl bg-secondary/10 border border-secondary/20 flex items-center justify-center overflow-hidden shadow-xl group-hover:scale-105 transition-transform">
                                <img
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${op.name}`}
                                  alt={op.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                                {op.name.split(" ")[0]}
                              </p>
                              <div className="w-full h-10 border border-white/10 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest group-hover:bg-secondary group-hover:text-on-secondary transition-all">
                                Seleccionar
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : !activityMode ? (
                      <div className="flex-1 filter-none flex flex-col gap-8 items-center justify-center p-12">
                        <div className="glass-panel p-8 rounded-[3rem] border border-secondary/30 bg-secondary/5 mb-8 w-full max-w-xl text-center">
                          <h3 className="text-3xl font-black text-white uppercase mb-2">
                            {selectedOperator.name}
                          </h3>
                          <p className="text-xs text-secondary font-black uppercase tracking-widest">
                            ¿Qué acción deseas realizar?
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                          <button
                            onClick={() => setActivityMode("checkin")}
                            className="glass-panel p-12 rounded-[3.5rem] border border-white/10 hover:border-secondary/40 hover:bg-secondary/5 transition-all space-y-6 group"
                          >
                            <div className="w-24 h-24 bg-secondary/10 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                              <UserCheck className="w-12 h-12 text-secondary" />
                            </div>
                            <div>
                              <h4 className="text-2xl font-black text-white uppercase italic">
                                Check-In
                              </h4>
                              <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest mt-2">
                                Iniciar Entrada de Turno
                              </p>
                            </div>
                          </button>

                          <button
                            onClick={() => setActivityMode("audit")}
                            className="glass-panel p-12 rounded-[3.5rem] border border-white/10 hover:border-primary/40 hover:bg-primary/5 transition-all space-y-6 group"
                          >
                            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                              <Target className="w-12 h-12 text-primary" />
                            </div>
                            <div>
                              <h4 className="text-2xl font-black text-white uppercase italic">
                                Auditoría
                              </h4>
                              <p className="text-[10px] text-primary/40 font-black uppercase tracking-widest mt-2">
                                Validar Limpieza de Área
                              </p>
                            </div>
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            if (activityMode === "audit") setSelectedArea(null);
                            else setSelectedOperator(null);
                          }}
                          className="mt-12 text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] hover:text-white transition-colors"
                        >
                          ← Volver
                        </button>
                      </div>
                    ) : (
                    <div className="h-full flex flex-col gap-8">
                      <div className="flex items-center gap-8 p-8 glass-panel rounded-[3rem] border border-secondary/30 bg-secondary/5 border-dashed">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10">
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedOperator.name}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-1">
                            {activityMode === "checkin"
                              ? "Entrada de Turno"
                              : `Auditoría: ${selectedArea}`}
                          </p>
                          <h3 className="text-3xl font-black text-white uppercase tracking-tight">
                            {selectedOperator.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => {
                            stopCamera();
                            setActivityMode(null);
                            setSelfie(null);
                            setCapturedImage(null);
                          }}
                          className="h-16 px-8 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-error hover:bg-error/10 transition-all font-black uppercase text-xs tracking-widest"
                        >
                          <X className="w-5 h-5" /> Cancelar
                        </button>
                      </div>

                      <div className="flex-1 glass-panel rounded-[3.5rem] p-10 border border-white/5 flex flex-col gap-8 overflow-hidden relative">
                        <div className="flex-1 bg-surface-container rounded-[2.5rem] border-2 border-dashed border-white/10 overflow-hidden relative">
                          {activityMode === "checkin" ? (
                            selfie ? (
                              <img
                                src={selfie}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="relative w-full h-full">
                                <video
                                  ref={videoRef}
                                  autoPlay
                                  playsInline
                                  muted
                                  className="w-full h-full object-cover scale-x-[-1]"
                                />
                                {!isSubmitting && (
                                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                                    <button
                                      onClick={() => fileInputRef.current?.click()}
                                      className="px-6 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-[8px] font-black uppercase tracking-widest hover:bg-black/80 transition-all text-white"
                                    >
                                      Subir de Galería
                                    </button>
                                    <input 
                                      type="file"
                                      ref={fileInputRef}
                                      onChange={handleFileUpload}
                                      accept="image/*"
                                      className="hidden"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          ) : capturedImage ? (
                            <img
                              src={capturedImage}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="relative w-full h-full">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                              />
                              {!isSubmitting && (
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                                  <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-[8px] font-black uppercase tracking-widest hover:bg-black/80 transition-all text-white"
                                  >
                                    Subir de Galería
                                  </button>
                                  <input 
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {analyzing && (
                            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-6 z-50">
                              <Loader2 className="w-20 h-20 text-secondary animate-spin" />
                              <p className="text-xl font-black text-white uppercase tracking-tight">
                                IA Analizando Superficies...
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-6">
                          {activityMode === "checkin" ? (
                            !selfie ? (
                              <button
                                onClick={() => capturePhoto(true)}
                                className="w-full h-20 bg-secondary text-on-secondary rounded-[1.5rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 shadow-2xl"
                              >
                                <Camera className="w-8 h-8" /> Capturar
                                Identidad
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setSelfie(null);
                                  }}
                                  className="flex-1 h-20 glass-panel rounded-[1.5rem] text-[10px] font-black uppercase text-white/40"
                                >
                                  Re-intentar
                                </button>
                                <button
                                  onClick={handleCheckIn}
                                  disabled={isSubmitting}
                                  className="flex-[2] h-20 bg-secondary text-on-secondary rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl disabled:opacity-50"
                                >
                                  {isSubmitting ? "Registrando..." : "Confirmar Entrada"}
                                </button>
                              </>
                            )
                          ) : !capturedImage ? (
                            <button
                              onClick={() => capturePhoto(false)}
                              className="w-full h-20 bg-primary text-on-primary rounded-[1.5rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 shadow-2xl"
                            >
                              <Camera className="w-8 h-8" /> Capturar Evidencia
                            </button>
                          ) : (
                            !analyzing && (
                              <>
                                <button
                                  onClick={() => {
                                    setCapturedImage(null);
                                  }}
                                  className="flex-1 h-20 glass-panel rounded-[1.5rem] text-[10px] font-black uppercase text-white/40"
                                >
                                  Re-capturar
                                </button>
                                <button
                                  onClick={handleAuditAction}
                                  disabled={isSubmitting}
                                  className="flex-[2] h-20 bg-primary text-on-primary rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl disabled:opacity-50"
                                >
                                  {isSubmitting ? "Enviando..." : "Enviar para Auditoría IA"}
                                </button>
                              </>
                            )
                          )}
                        </div>

                        <div className="absolute top-12 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                            <Zap className="w-4 h-4 text-secondary fill-secondary" />
                            {activityMode === "checkin"
                              ? "Selfie Obligatorio"
                              : "Visualización de Limpieza"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Side Column */}
          <div className="lg:col-span-4 flex flex-col gap-8 h-full overflow-hidden">
            {/* Shift Info Card */}
            <div className="glass-panel flex-1 rounded-[3.5rem] p-8 border border-white/5 flex flex-col min-h-0 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-6">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" /> Personal Activo
                  </h3>
                </div>
                <div className="px-3 py-1 bg-secondary/10 rounded-full border border-secondary/20">
                  <span className="text-[10px] font-black text-secondary">
                    {attendance.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {attendance.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-3xl border border-white/5"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black uppercase tracking-tight">
                        {entry.operatorName}
                      </p>
                      <p className="text-[9px] font-black text-secondary/60 uppercase tracking-widest">
                        Check-in: {entry.time}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  </div>
                ))}
                {attendance.length === 0 && (
                  <div className="text-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-primary/10 mx-auto animate-spin" />
                    <p className="text-[10px] text-primary/20 font-black uppercase tracking-widest italic">
                      Esperando check-in...
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-white/5 space-y-6">
                <button
                  onClick={() => {
                    setActiveTab("activity");
                    setActivityMode("audit");
                    setSelectedOperator(null);
                    setSelectedArea(null);
                  }}
                  className="flex w-full items-center gap-4 border border-dashed border-white/5 bg-white/5 p-5 text-left transition-all hover:border-secondary/40 hover:bg-secondary/5 group rounded-3xl"
                >
                  <QrCode className="h-12 w-12 text-secondary transition-transform group-hover:scale-110" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                      Modo Auditoría
                    </p>
                    <p className="text-xs font-black uppercase italic text-white">
                      Escanear para Calificar
                    </p>
                  </div>
                </button>

                {/* Tab Switcher */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`flex-1 h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === "dashboard" ? "bg-secondary text-on-secondary shadow-lg scale-100" : "bg-white/5 text-primary/40 hover:bg-white/10 scale-95"}`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("activity");
                      setSelectedOperator(null);
                    }}
                    className={`flex-1 h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === "activity" ? "bg-secondary text-on-secondary shadow-lg scale-100" : "bg-white/5 text-primary/40 hover:bg-white/10 scale-95"}`}
                  >
                    <UserCheck className="w-4 h-4" />
                    Check-In
                  </button>
                  <button
                    onClick={() => setActiveTab("ranking")}
                    className={`flex-1 h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === "ranking" ? "bg-secondary text-on-secondary shadow-lg scale-100" : "bg-white/5 text-primary/40 hover:bg-white/10 scale-95"}`}
                  >
                    <Trophy className="w-4 h-4" />
                    Ranking
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Branding */}
            <div className="p-6 glass-panel rounded-[2rem] border border-white/5 text-center flex items-center justify-center gap-4">
              <Shield className="w-4 h-4 text-primary/20" />
              <p className="text-[9px] font-black text-primary/20 uppercase tracking-[0.4em]">
                Powered by Impeccable ERP • v5.2
              </p>
            </div>
          </div>
        </div>
      </main>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
