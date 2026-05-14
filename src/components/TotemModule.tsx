import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  MapPin, 
  UserCheck, 
  ShieldCheck, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Power,
  ChevronRight,
  BrainCircuit,
  Target,
  Star,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth } from "../firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  documentId
} from "firebase/firestore";
import { analyzeCleaningQuality } from "../services/gemini";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { handleFirestoreError, OperationType } from "../firebase";

interface TotemModuleProps {
  userData: any;
}

const TotemModule: React.FC<TotemModuleProps> = ({ userData }) => {
  const [step, setStep] = useState<'standby' | 'checkin' | 'activity' | 'analyzing' | 'result' | 'supervisor_select'>('standby');
  const [isSupervisorMode, setIsSupervisorMode] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (userData?.tenantId) {
        setLoading(true);
        try {
          console.log(`[TOTEM] Fetching data for tenant: ${userData.tenantId}, client: ${userData.clientId}, role: ${userData.role}`);
          
          // Fetch team members - Simplified query to avoid index issues
          try {
            // Step 1: Try query with tenantId + role (usually indexed by default)
            const qBasic = query(collection(db, "users"), where("tenantId", "==", userData.tenantId), where("role", "==", "operator"));
            const teamSnap = await getDocs(qBasic);
            
            let filtered = teamSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
            // Step 2: Manual filter for status and clientId to avoid requiring triple composite index
            filtered = filtered.filter(u => u.status === 'active' && u.clientId === userData.clientId);
            
            console.log(`[TOTEM] Team members found: ${filtered.length}`);
            setTeam(filtered);
          } catch (e: any) {
            console.error("[TOTEM] Error fetching team:", e);
            // Fallback: Fetch all from tenant and filter manually
            const qFallback = query(collection(db, "users"), where("tenantId", "==", userData.tenantId));
            const fallbackSnap = await getDocs(qFallback);
            const filtered = fallbackSnap.docs
              .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
              .filter(u => u.role === 'operator' && u.clientId === userData.clientId && u.status === 'active');
            setTeam(filtered);
          }
          
          // Fetch clients - For Totem, we ONLY fetch our own client to avoid permissions errors
          if (userData.clientId && userData.clientId !== 'none') {
            try {
              const clientDoc = await getDoc(doc(db, "clients", userData.clientId));
              if (clientDoc.exists()) {
                const clientData = { id: clientDoc.id, ...(clientDoc.data() as any) };
                setClients([clientData]);
                setSelectedClient(clientData);
                console.log("[TOTEM] Assigned client loaded:", clientData.name);
              } else {
                console.error("[TOTEM] Assigned client document not found:", userData.clientId);
                // Auto-create if not found (extra resilience)
                await setDoc(doc(db, "clients", userData.clientId), {
                  id: userData.clientId,
                  name: `CLIENTE ${userData.clientId.toUpperCase()}`,
                  address: "Ubicación Automática",
                  status: 'active',
                  tenantId: userData.tenantId
                }, { merge: true });
                setClients([{ id: userData.clientId, name: `CLIENTE ${userData.clientId.toUpperCase()}`, tenantId: userData.tenantId }]);
              }
            } catch (e) {
              handleFirestoreError(e, OperationType.GET, `clients/${userData.clientId}`);
            }
          } else if (userData.role !== 'totem') {
            // Only non-totems (SuperAdmin/Supervisor) can list all clients
            try {
              const qClients = query(collection(db, "clients"), where("tenantId", "==", userData.tenantId));
              const clientSnap = await getDocs(qClients);
              setClients(clientSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
            } catch (e) {
              handleFirestoreError(e, OperationType.LIST, "clients");
            }
          }
        } catch (err: any) {
          console.error("Error fetching totem data:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [userData]);

  const handleFixData = async () => {
    if (!userData?.tenantId) return;
    setLoading(true);
    const toastId = toast.loading("Reparando datos de operarios...");
    try {
      console.log("[TOTEM] Running repair for tenant:", userData.tenantId);
      
      // Step 1: Try to find any operators in this tenant
      let operatorsSnap;
      try {
        const q = query(collection(db, "users"), where("tenantId", "==", userData.tenantId));
        operatorsSnap = await getDocs(q);
      } catch (e) {
        // Total fallback if index for tenantId+role is missing
        const qRaw = query(collection(db, "users"));
        const rawSnap = await getDocs(qRaw);
        operatorsSnap = { 
          docs: rawSnap.docs.filter(d => d.data().tenantId === userData.tenantId),
          empty: rawSnap.docs.filter(d => d.data().tenantId === userData.tenantId).length === 0
        };
      }
      
      const operators = (operatorsSnap as any).docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.role === 'operator');

      let fixed = 0;
      
      // If we have operators but they aren't assigned to this client, fix them
      if (operators.length > 0) {
        for (const op of operators) {
          if (!op.clientId || op.clientId === 'none' || (userData.clientId === 'ave1' && op.name.includes("Ave1"))) {
            await updateDoc(doc(db, "users", op.id), {
              clientId: userData.clientId || "ave1",
              status: "active"
            });
            fixed++;
          }
        }
      }

      // Step 2: If we still don't have enough operators, create them (resilience)
      if (fixed < 2 && operators.filter((o: any) => o.clientId === userData.clientId).length < 2) {
        const demoOps = [
          { email: `op1_${userData.clientId}@impeccable.com`, name: "Carlos Mendoza (Demo)", role: "operator", clientId: userData.clientId, tenantId: userData.tenantId, points: 5000, status: "active" },
          { email: `op2_${userData.clientId}@impeccable.com`, name: "Ana López (Demo)", role: "operator", clientId: userData.clientId, tenantId: userData.tenantId, points: 3000, status: "active" }
        ];

        for (const demo of demoOps) {
          const id = demo.email.replace(/@|\./g, '_');
          await setDoc(doc(db, "users", id), {
            ...demo,
            uid: id,
            updatedAt: serverTimestamp()
          }, { merge: true });
          fixed++;
        }
      }
      
      toast.success(`${fixed} operarios listos en esta estación.`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error("[TOTEM] Repair failed:", e);
      toast.error("Error al reparar datos. Verifica permisos de administrador.");
    } finally {
      setLoading(false);
      toast.dismiss(toastId);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("No se pudo acceder a la cámara");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const capturePhoto = (isSelfie: boolean = true) => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      
      // Resize logic - Max 1024px for AI processing
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
      const data = canvasRef.current.toDataURL("image/jpeg", 0.7); // 0.7 quality for smaller file
      if (isSelfie) setSelfie(data);
      else setCapturedImage(data);
      stopCamera();
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // Get location
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
      const newCheckIn = {
        userId: selectedOperator.id,
        userName: selectedOperator.name,
        type: "check-in",
        timestamp: serverTimestamp(),
        location: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        },
        selfieUrl: selfie,
        totemId: userData.uid,
        tenantId: userData.tenantId
      };

      await addDoc(collection(db, "attendance"), newCheckIn);
      
      // Update check-in status on operator
      await updateDoc(doc(db, "users", selectedOperator.id), {
        lastCheckIn: serverTimestamp(),
        status: 'active'
      });
      
      toast.success(`Check-In exitoso: ${selectedOperator.name}`);
      setStep('activity');
    } catch (error) {
      toast.error("Error al registrar entrada");
    } finally {
      setLoading(false);
    }
  };

  const handleAuditAction = async () => {
    setStep('analyzing');
    try {
      const base64 = capturedImage!.split(",")[1];
      const result = await analyzeCleaningQuality(base64, isSupervisorMode ? "strict" : "standard", selectedClient?.industry || "Comercio");
      setAnalysis(result);

      // Save task/audit
      const newTask = {
        title: isSupervisorMode 
          ? `Auditoría Supervisión: ${selectedClient?.name || 'Área'}` 
          : `Autocontrol Tótem: ${selectedClient?.name || 'Área'}`,
        areaName: selectedClient?.name || 'General',
        operatorId: selectedOperator.id,
        operatorName: selectedOperator.name,
        clientId: selectedClient?.id || userData.clientId || 'none',
        supervisorId: userData.uid,
        score: result.score,
        status: result.score < 75 ? "pending_review" : "completed",
        aiNotes: result.observations,
        afterPhoto: capturedImage,
        createdAt: serverTimestamp(),
        scheduledDate: new Date().toISOString().split('T')[0],
        completedAt: serverTimestamp(),
        tenantId: userData.tenantId,
        source: 'totem',
        isSupervisorAudit: isSupervisorMode
      };
      
      await addDoc(collection(db, "tasks"), newTask);

      // ASIGNAR PUNTOS AL OPERARIO REALMENTE
      // Si es supervisión, los puntos valen más (bono de excelencia)
      const multiplier = isSupervisorMode ? 2.5 : 1.5;
      const pointsWon = Math.floor(result.score * multiplier); 
      const currentPoints = selectedOperator.points || 0;
      await updateDoc(doc(db, "users", selectedOperator.id), {
        points: currentPoints + pointsWon,
        updatedAt: serverTimestamp()
      });
      
      // Actualizar estado local
      setSelectedOperator({...selectedOperator, points: currentPoints + pointsWon});

      toast.success(isSupervisorMode 
        ? `Auditoría de Supervisión: +${pointsWon} puntos para ${selectedOperator.name}`
        : `Autocontrol validado: +${pointsWon} puntos asignados`
      );
      setStep('result');
    } catch (error) {
      console.error("Audit error:", error);
      toast.error("Error en el análisis de IA");
      setStep('activity');
    }
  };

  const handleRedeem = async () => {
    if (!selectedOperator) return;
    setLoading(true);
    try {
      const pointsToRedeem = 5000; // Ejemplo: Canje de bono de $50
      if ((selectedOperator.points || 0) < pointsToRedeem) {
        toast.error("Puntos insuficientes para el canje mínimo.");
        return;
      }

      await addDoc(collection(db, "redemptions"), {
        userId: selectedOperator.id,
        userName: selectedOperator.name,
        rewardId: "bonus_50",
        rewardTitle: "Bono de Efectivo en Nómina ($50)",
        points: pointsToRedeem,
        status: 'pending',
        tenantId: userData.tenantId,
        createdAt: serverTimestamp()
      });

      // Deducir puntos
      await updateDoc(doc(db, "users", selectedOperator.id), {
        points: selectedOperator.points - pointsToRedeem,
        updatedAt: serverTimestamp()
      });
      
      setSelectedOperator({
        ...selectedOperator,
        points: selectedOperator.points - pointsToRedeem
      });

      toast.success("Canje solicitado. Aparecerá en tu próxima pre-nómina.");
    } catch (e) {
      toast.error("Error al procesar canje");
    } finally {
      setLoading(false);
    }
  };

  const resetTotem = () => {
    setStep('standby');
    setIsSupervisorMode(false);
    setSelectedOperator(null);
    setSelfie(null);
    setCapturedImage(null);
    setAnalysis(null);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        
        {/* STEP 0: STANDBY */}
        {step === 'standby' && (
          <motion.div 
            key="standby"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center space-y-8"
          >
            <div className="relative">
              <div className="absolute -inset-10 bg-primary/20 rounded-full blur-[80px] animate-pulse" />
              <div className="w-40 h-40 bg-surface-container rounded-[2.5rem] border border-white/10 flex items-center justify-center mx-auto shadow-2xl relative">
                <Power className="w-16 h-16 text-primary" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black font-headline text-white uppercase tracking-tighter">Estación Tótem IA</h1>
              <p className="text-primary/60 font-bold uppercase tracking-[0.3em] text-xs">Identifícate para comenzar</p>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => {
                  setIsSupervisorMode(false);
                  setStep('checkin');
                }}
                className="px-12 h-20 bg-primary text-on-primary rounded-[2rem] font-black font-headline text-2xl uppercase tracking-tighter shadow-[0_0_50px_rgba(68,221,194,0.4)] active:scale-90 transition-all flex items-center justify-center gap-4"
              >
                <Clock className="w-8 h-8" /> Iniciar Turno
              </button>
              
              {(userData.role !== 'operator') && (
                <button 
                  onClick={() => {
                    setIsSupervisorMode(true);
                    setStep('supervisor_select');
                  }}
                  className="px-8 h-16 bg-surface-container-high text-primary border border-primary/20 rounded-2xl font-black font-headline text-lg uppercase tracking-tight hover:bg-primary/10 transition-all flex items-center justify-center gap-3"
                >
                  <ShieldCheck className="w-5 h-5" /> Auditoría de Supervisor
                </button>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 pt-10 opacity-40">
              <ShieldCheck className="w-6 h-6" />
              <BrainCircuit className="w-6 h-6" />
              <MapPin className="w-6 h-6" />
            </div>
          </motion.div>
        )}

        {/* STEP 1: CHECK-IN / IDENTIFICACION (OPERARIO O SUPERVISOR SELECT) */}
        {(step === 'checkin' || step === 'supervisor_select') && (
          <motion.div 
            key={step}
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-full max-w-lg space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">
                {isSupervisorMode ? 'Premiar a un Operario' : '¿Quién opera hoy?'}
              </h2>
              <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">
                {isSupervisorMode ? 'Selecciona quién realizó la limpieza' : 'Selecciona tu perfil de la lista'}
              </p>
            </div>

            {!selectedOperator ? (
              <div className="space-y-4">
                {team.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide py-1">
                    {team.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => {
                          setSelectedOperator(op);
                          if (isSupervisorMode) {
                            setStep('activity');
                            startCamera();
                          } else {
                            startCamera();
                          }
                        }}
                        className="p-6 glass-panel rounded-3xl border border-white/5 hover:border-primary/40 transition-all flex flex-col items-center gap-4 group"
                      >
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                          <img 
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${op.name}`} 
                            alt={op.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-black text-white uppercase leading-tight">{op.name.split(' ')[0]}</p>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <Star className="w-3 h-3 text-secondary fill-secondary" />
                            <p className="text-[10px] text-secondary font-black">{op.points || 0}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4 glass-panel rounded-[2rem] border border-dashed border-white/10 bg-white/5">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Users className="w-8 h-8 text-primary opacity-40" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-white font-black uppercase text-sm">Sin operarios asignados</p>
                       <p className="text-primary/40 text-[10px] font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                         Solicita a un Supervisor que asigne personal a este Cliente ({userData.clientId || "Sin ID"})
                       </p>
                    </div>
                    <div className="flex flex-col gap-3 items-center">
                      <button 
                        onClick={() => window.location.reload()}
                        className="text-secondary text-[10px] font-black uppercase tracking-widest border-b border-secondary/20 pb-0.5"
                      >
                        Actualizar Lista
                      </button>
                      <button 
                        onClick={handleFixData}
                        className="px-4 py-2 bg-white/5 rounded-xl text-[8px] font-black uppercase text-primary/60 border border-white/10 hover:bg-white/10 transition-all font-headline"
                      >
                        Autocorregir Datos de Equipo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="aspect-square w-64 mx-auto bg-surface-container rounded-full border-4 border-primary/20 overflow-hidden relative shadow-2xl">
                  {selfie ? (
                    <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirror" />
                  )}
                  {!selfie && (
                    <div className="absolute inset-0 border-4 border-dashed border-primary/40 rounded-full animate-pulse flex items-center justify-center">
                       <div className="text-on-surface opacity-20"><Users className="w-20 h-20" /></div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  {!selfie ? (
                    <button 
                      onClick={() => capturePhoto(true)}
                      className="flex-1 h-16 bg-secondary text-on-secondary rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" /> Capturar Selfie
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => { setSelfie(null); startCamera(); }}
                        className="flex-1 h-14 glass-panel text-white/60 rounded-2xl text-xs font-bold uppercase"
                      >
                        Re-intentar
                      </button>
                      <button 
                        onClick={handleCheckIn}
                        disabled={loading}
                        className="flex-[2] h-14 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirmar</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            
            <button onClick={resetTotem} className="w-full text-center text-primary/40 text-[10px] font-black uppercase tracking-widest">Cancelar y Volver</button>
          </motion.div>
        )}

        {/* STEP 2: ACTIVITY RECORDING */}
        {step === 'activity' && (
          <motion.div 
            key="activity"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-xl space-y-8"
          >
            <div className={cn(
              "flex items-center justify-between p-4 rounded-3xl border",
              isSupervisorMode 
                ? "bg-secondary/10 border-secondary/20" 
                : "bg-primary/10 border-primary/20"
            )}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                  {selfie ? (
                    <img src={selfie!} className="w-full h-full object-cover" alt="Current user" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-secondary" />
                  )}
                </div>
                <div>
                  <p className={cn("text-[10px] font-bold uppercase", isSupervisorMode ? "text-secondary" : "text-primary")}>
                    {isSupervisorMode ? 'Control de Calidad (Supervisor)' : 'Autocontrol Activo'}
                  </p>
                  <p className="text-lg font-black text-white uppercase tracking-tight">Evaluando a {selectedOperator?.name.split(' ')[0]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRedeem}
                  disabled={loading}
                  className="px-4 h-10 bg-secondary/10 border border-secondary/20 rounded-xl text-[10px] font-black uppercase text-secondary hover:bg-secondary hover:text-on-secondary transition-all disabled:opacity-50"
                >
                  Canjear Puntos
                </button>
                <button 
                  onClick={resetTotem}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-error hover:bg-error/20 transition-all"
                >
                  <Power className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-2">1. Seleccionar Cliente/Área</label>
                <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto scrollbar-hide py-1">
                  {clients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all flex justify-between items-center",
                        selectedClient?.id === client.id 
                          ? "bg-secondary/20 border-secondary text-white" 
                          : "bg-surface-container-low border-white/5 text-primary/40"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase">{client.name}</span>
                        <span className="text-[10px] opacity-60">{client.address || 'Ubicación Central'}</span>
                      </div>
                      {selectedClient?.id === client.id && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-2">2. Capturar Evidencia</label>
                <div 
                  className={cn(
                    "aspect-square rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden bg-surface-container",
                    capturedImage && "border-solid border-secondary"
                  )}
                >
                  {capturedImage ? (
                    <img src={capturedImage} className="w-full h-full object-cover" alt="Work evidence" />
                  ) : (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  )}
                  
                  {!capturedImage && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button 
                        onClick={() => { startCamera(); }}
                        className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary border border-primary/20"
                      >
                        <Camera className="w-8 h-8" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!capturedImage ? (
                    <button 
                      onClick={() => capturePhoto(false)}
                      disabled={!selectedClient}
                      className="w-full h-14 bg-secondary text-on-secondary rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale"
                    >
                      <Target className="w-5 h-5" /> Capturar Limpieza
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => { setCapturedImage(null); startCamera(); }}
                        className="flex-1 h-14 glass-panel text-white/50 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                      >
                        Re-tomar
                      </button>
                      <button 
                        onClick={handleAuditAction}
                        className={cn(
                          "flex-[2] h-14 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(68,221,194,0.3)] transition-all",
                          isSupervisorMode ? "bg-secondary text-white" : "bg-primary text-on-primary"
                        )}
                      >
                        {isSupervisorMode ? <><ShieldCheck className="w-5 h-5" /> Validar Calidad</> : <><CheckCircle2 className="w-5 h-5" /> Validar con IA</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: ANALYZING */}
        {step === 'analyzing' && (
          <motion.div 
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-8"
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center mx-auto">
                <Loader2 className="w-12 h-12 text-secondary animate-spin" />
              </div>
              <div className="absolute inset-0 border-4 border-secondary rounded-full animate-radar" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-headline text-white uppercase">Procesando Inteligencia</h2>
              <p className="text-primary/60 font-medium max-w-[250px] mx-auto mt-2">Gemini está analizando la profundidad de limpieza y asignando puntos de mérito...</p>
            </div>
          </motion.div>
        )}

        {/* STEP 4: RESULT */}
        {step === 'result' && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg space-y-8 text-center"
          >
            <div className="relative">
              <div className="absolute -inset-10 bg-secondary/10 rounded-full blur-3xl" />
              <div className="w-32 h-32 bg-secondary/20 rounded-[2.5rem] border border-secondary/30 flex items-center justify-center mx-auto shadow-2xl relative">
                <ShieldCheck className="w-16 h-16 text-secondary" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-5xl font-black font-headline text-white tracking-tighter">{analysis?.score}%</h2>
              <p className="text-xs font-black text-secondary uppercase tracking-[0.3em]">Pureza Certificada por IA</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-secondary px-6 py-3 bg-secondary/10 rounded-full w-fit mx-auto">
                 <ShieldCheck className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest">
                   Auditoría de Supervisión Certificada
                 </span>
              </div>
              <div className="glass-panel p-6 rounded-[2rem] border border-white/5 space-y-4">
                <p className="text-sm text-white/80 leading-relaxed italic">"{analysis?.observations}"</p>
                <div className="flex items-center justify-center gap-4 text-secondary">
                   <Zap className="w-5 h-5 animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest">
                     {selectedOperator?.name.split(' ')[0]} ha recibido un bono de excelencia
                   </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setStep('activity')}
              className="w-full h-16 bg-surface-container border border-white/10 rounded-2xl font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Registrar Otra Área
            </button>
            <button 
              onClick={resetTotem}
              className="w-full text-center text-primary/40 text-[10px] font-black uppercase tracking-widest"
            >
              Cerrar Sesión del Operario
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default TotemModule;
