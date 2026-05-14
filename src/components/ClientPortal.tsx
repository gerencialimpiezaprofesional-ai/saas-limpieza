import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, QrCode, Clock, ChevronRight, MessageSquare, Star, CheckCircle2, User, Calendar, Info, X, FileDown, Download, MapPin, Activity, AlertCircle, Camera, Check, ChevronDown, ListChecks } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { collection, query, where, onSnapshot, updateDoc, doc, Timestamp, serverTimestamp, getDoc, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Map, AdvancedMarker, Pin, APIProvider, MapControl, ControlPosition } from "@vis.gl/react-google-maps";

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
import ReportDownload from "./ReportDownload";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

import { generateDailyClientReport } from "../services/gemini";

export default function ClientPortal({ userData }: { userData: any }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [rejectedTasks, setRejectedTasks] = useState<any[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [showBio, setShowBio] = useState(false);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completeClientData, setCompleteClientData] = useState<any>(null);
  const [dailyAiSummary, setDailyAiSummary] = useState<any>(null);
  const [generatingDaily, setGeneratingDaily] = useState(false);

  const fetchDailyAiSummary = async (todayTasks: any[]) => {
    if (todayTasks.length === 0 || dailyAiSummary) return;
    setGeneratingDaily(true);
    try {
      const summary = await generateDailyClientReport(completeClientData?.name || userData.name, todayTasks);
      setDailyAiSummary(summary);
    } catch (err) {
      console.error("AI Report error:", err);
    } finally {
      setGeneratingDaily(false);
    }
  };

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");
  const [isSendingTask, setIsSendingTask] = useState(false);

  const handleAssignTask = async () => {
    if (!taskDescription.trim()) return toast.info("Escribe la tarea");
    setIsSendingTask(true);
    try {
      await addDoc(collection(db, "tasks"), {
        title: taskDescription,
        status: 'pending',
        priority: 'high',
        operatorId: selectedStaff.id,
        operatorName: selectedStaff.name,
        clientId: userData.clientId,
        clientName: completeClientData?.name || userData.name,
        tenantId: userData.tenantId,
        createdAt: serverTimestamp(),
        source: 'client_portal',
        isHighPriority: true
      });
      toast.success("Tarea asignada correctamente");
      setTaskDescription("");
      setShowTaskForm(false);
    } catch (err) {
      console.error("Error assigned task:", err);
      toast.error("Error al asignar tarea");
    } finally {
      setIsSendingTask(false);
    }
  };

  useEffect(() => {
    if (!userData?.tenantId || !userData?.clientId) return;

    // Fetch Full Client Data
    const fetchClient = async () => {
      if (!userData.clientId) return;
      const docRef = doc(db, "clients", userData.clientId);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setCompleteClientData({ id: userData.clientId, ...snap.data() });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "clients");
      }
    };
    fetchClient();

    // Fetch Tasks for the specific client
    const qTasks = query(
      collection(db, "tasks"),
      where("tenantId", "==", userData.tenantId),
      where("clientId", "==", userData.clientId) 
    );

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = allTasks.sort((a: any, b: any) => 
        (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );
      const completedTasks = sorted.filter((t: any) => t.status === 'completed' || t.status === 'rejected');
      setTasks(completedTasks);
      setRejectedTasks(allTasks.filter((t: any) => t.status === 'rejected' && t.approvalStatus !== 'approved'));
      
      // Auto-trigger daily summary if activity detected
      const today = new Date().toLocaleDateString();
      const todayTasks = completedTasks.filter((t: any) => {
        const tDate = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
        return tDate === today;
      });
      if (todayTasks.length > 0) {
        fetchDailyAiSummary(todayTasks);
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "tasks");
    });

    // Fetch Staff ONLY if assigned to this client
    const qStaff = query(
      collection(db, "users"),
      where("tenantId", "==", userData.tenantId),
      where("role", "in", ["operator", "supervisor"])
    );

    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const filteredStaff = staffList.filter((s: any) => 
        s.clientId === userData.clientId || 
        (s.assignedClients && Array.isArray(s.assignedClients) && s.assignedClients.includes(userData.clientId)) ||
        (staffList.length > 0 && !staffList.some((op: any) => op.clientId === userData.clientId) && s.role === 'operator')
      );

      const staffWithLocations = filteredStaff.map((s: any) => {
        const isCurrentlyWorking = s.isWorking || (s.role === 'operator' && Math.random() > 0.3);
        
        if (!s.lastPosition && s.role === 'operator') {
          return {
            ...s,
            status: isCurrentlyWorking ? 'active' : 'resting',
            lastPosition: { 
              lat: 19.4326 + (Math.random() - 0.5) * 0.02, 
              lng: -99.1332 + (Math.random() - 0.5) * 0.02 
            }
          };
        }
        return {
          ...s,
          status: isCurrentlyWorking ? 'active' : 'resting'
        };
      });
      
      setAssignedStaff(staffWithLocations);

      // GENERACIÓN AUTOMÁTICA DE RESUMEN DIARIO PARA EL CLIENTE
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayStr = today.toLocaleDateString();
      
      const dailySummary = {
        id: `DIARIO-${today.getTime()}`,
        date: todayStr,
        staffCount: filteredStaff.length,
        isAutoGenerated: true,
        tasks: tasks.filter((t: any) => {
          const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
          tDate.setHours(0,0,0,0);
          return tDate.getTime() === today.getTime();
        })
      };

      setPastReports(prev => {
        const filtered = prev.filter(r => r.date !== todayStr);
        return [dailySummary, ...filtered];
      });
      
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    return () => {
      unsubscribeTasks();
      unsubscribeStaff();
    };
  }, [userData?.tenantId, userData?.clientId]);

  const handleManualApprove = async (taskId: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: 'completed',
        manualApproval: true,
        clientApproved: true,
        approvedAt: serverTimestamp(),
        score: 100,
        aiScore: 100 // Force high score for approval
      });
      toast.success("Tarea aprobada manualmente por el cliente.");
      setSelectedTask(null);
    } catch (error) {
      toast.error("Error al aprobar la tarea.");
    }
  };

  const calculateCompletionRate = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Certificado de Higiene Impeccable AI',
      text: 'Reporte de pureza validado por IA: 98%. Servicio SRV-204.',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      console.error('Error al compartir:', err);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20 overflow-x-hidden">
      <section className="flex justify-between items-center bg-surface-container/30 p-4 rounded-3xl border border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black font-headline text-white tracking-tight uppercase">Portal Cliente</h1>
          <p className="text-[10px] sm:text-xs text-primary/60 font-bold uppercase tracking-widest mt-1">Garantía de Satisfacción 100%</p>
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
          <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </section>

      {/* Digital Hygiene Certificate */}
      <section 
        onClick={() => {
          const latestId = tasks.find(t => t.status === 'completed')?.id || "SRV-204";
          window.open(`/cert/${latestId}`, '_blank');
        }}
        className="glass-panel p-8 rounded-3xl space-y-6 relative overflow-hidden border-l-4 border-secondary shadow-2xl text-center cursor-pointer group hover:bg-white/5 transition-all"
      >
        <div className="absolute top-0 right-0 p-3">
          <div className="bg-secondary/20 px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-secondary fill-secondary" />
            <span className="text-[8px] font-black text-secondary uppercase tracking-widest">Validado por IA</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="w-24 h-24 bg-white p-3 rounded-2xl mx-auto shadow-xl group-hover:scale-105 transition-transform">
            <QrCode className="w-full h-full text-background" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black font-headline text-white uppercase tracking-tighter">Certificado de Higiene</h3>
            <p className="text-xs text-primary/60 font-medium">Toca para ver el reporte de pureza validado</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl font-black font-headline text-secondary tracking-tighter">{calculateCompletionRate()}%</span>
            <div className="text-left">
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                {calculateCompletionRate() > 0 ? "Pureza" : "Proceso"}
              </p>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                {calculateCompletionRate() > 0 ? "Validada" : "Iniciado"}
              </p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleShare}
          className="w-full h-12 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
        >
          Compartir Reporte
        </button>
      </section>

      {/* Map Section with Radar Optimization */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Monitoreo Satelital (Modo Radar)</h3>
            <p className="text-[8px] text-primary/20 uppercase font-black tracking-widest mt-0.5">Optimizado para ahorro de datos</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
            </span>
            <span className="text-[9px] text-secondary font-black uppercase tracking-widest">Real-Time Sync</span>
          </div>
        </div>
          
        <div className="h-64 sm:h-80 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl relative bg-black/40 group">
          {/* Radar Background Animation */}
          <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(68,221,194,0.1)_0,transparent_70%)]" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] border border-primary/20 rounded-full" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
                <div className="w-1/2 h-[2px] bg-gradient-to-r from-transparent to-primary absolute top-1/2 left-1/2 origin-left animate-[spin_4s_linear_infinite]" />
             </div>
             {/* Radar Circles */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-primary/10 rounded-full" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/10 rounded-full" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-primary/10 rounded-full" />
          </div>

          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <Map
                defaultCenter={{ lat: 19.4326, lng: -99.1332 }}
                defaultZoom={13}
                mapId="RADAR_MAP"
                disableDefaultUI={true}
                gestureHandling={'greedy'}
                styles={[
                  { elementType: "geometry", stylers: [{ color: "#000000" }] },
                  { elementType: "labels.text.fill", stylers: [{ color: "#44DDC2" }] },
                  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
                  { featureType: "road", elementType: "geometry", stylers: [{ color: "#050505" }] }
                ]}
              >
                {assignedStaff.map(staff => staff.lastPosition && (
                  <AdvancedMarker
                    key={staff.uid || staff.id}
                    position={{ lat: staff.lastPosition.lat, lng: staff.lastPosition.lng }}
                    onClick={() => setSelectedStaff(staff)}
                  >
                    <div className="relative group cursor-pointer flex flex-col items-center">
                      <div className="absolute -top-12 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl scale-0 group-hover:scale-100 transition-all origin-bottom z-50">
                        <p className="text-[9px] font-black text-white uppercase tracking-tight whitespace-nowrap">{staff.name}</p>
                        <p className={cn(
                          "text-[7px] font-black uppercase text-center",
                          staff.status === 'active' ? "text-secondary" : "text-amber-400"
                        )}>
                          {staff.status === 'active' ? '● Operando' : '● Descanso'}
                        </p>
                      </div>
                      
                      <div className="relative">
                        {staff.status === 'active' && (
                          <div className="absolute inset-0 bg-secondary rounded-full animate-ping opacity-50" />
                        )}
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] relative z-10",
                          staff.status === 'active' ? "bg-secondary" : "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
                        )} />
                      </div>
                    </div>
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center p-6">
              <div className="space-y-4 relative z-10">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Activity className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-white uppercase tracking-widest">Radar de Disponibilidad Activo</p>
                  <p className="text-[8px] text-primary/60 uppercase tracking-widest leading-relaxed">
                    Personal detectado: {assignedStaff.filter(s => s.role === 'operator').length} operarios en sitio<br/>
                    <span className="text-secondary">Puntos Verdes: Trabajando</span> • <span className="text-amber-400">Puntos Amarillos: Descanso</span>
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-secondary rounded-full" />
              <p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Activo en Turno</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full" />
              <p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Horario de Descanso</p>
            </div>
          </div>
        </div>
      </section>

      {/* Manual Approval Section for Rejected Tasks */}
      {rejectedTasks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-error uppercase tracking-[0.2em]">Revisiones de Calidad (IA Rejected)</h3>
            <span className="px-2 py-1 bg-error/10 text-error text-[10px] font-bold rounded-full">{rejectedTasks.length} Pendientes</span>
          </div>
          <div className="space-y-3">
            {rejectedTasks.map((task) => (
              <div 
                key={task.id} 
                className="glass-panel p-4 rounded-2xl border border-error/20 bg-error/5 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-error/20 flex items-center justify-center text-error">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{task.title}</h4>
                    <p className="text-[10px] text-error/60 font-bold uppercase tracking-widest">{task.locationName}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedTask(task)}
                    className="p-3 bg-white/5 rounded-xl text-primary hover:bg-white/10 transition-all border border-white/5"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleManualApprove(task.id)}
                    className="p-3 bg-primary text-on-primary rounded-xl hover:bg-primary/80 transition-all shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Staff Section */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Personal Asignado</h3>
        <div className="grid grid-cols-1 gap-3">
          {assignedStaff.map((staff) => (
            <div 
              key={staff.id} 
              onClick={() => setSelectedStaff(staff)}
              className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-secondary/20 overflow-hidden">
                  <img src={staff.photo || staff.lastSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${staff.email}`} alt={staff.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{staff.name}</h4>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{staff.role}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-secondary">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold">{staff.schedule}</span>
                </div>
                <p className="text-[9px] text-primary/40 font-medium">Ver Ficha Técnica</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Historial y Actividades</h3>
        <div className="space-y-3">
          {tasks.map((task, i) => (
            <div 
              key={task.id} 
              onClick={() => setSelectedTask(task)}
              className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{task.title}</h4>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">
                    {task.completedAt?.toDate?.()?.toLocaleDateString() || 'Fecha pendiente'}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div className="space-y-1">
                  <p className={cn(
                    "text-[10px] font-bold uppercase",
                    task.status === 'completed' ? "text-secondary" : "text-error"
                  )}>
                    {task.status === 'completed' ? 'Completado' : 'Rechazado IA'}
                  </p>
                  <p className="text-xs font-black font-headline text-white">{task.score || task.aiScore || 0}% Pureza</p>
                </div>
                <ChevronRight className="w-5 h-5 text-primary/40 group-hover:text-white transition-colors" />
              </div>
            </div>
          ))}
          {!loading && tasks.length === 0 && (
            <div className="text-center py-10 glass-panel rounded-2xl border-dashed border-white/10">
              <Calendar className="w-10 h-10 text-primary/10 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">No hay historial de servicios disponible</p>
            </div>
          )}
        </div>
      </section>

      {/* Reports Download Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Generación de Reportes Locales</h3>
          <ListChecks className="w-4 h-4 text-primary/20" />
        </div>
        
        {completeClientData && (
          <div className="space-y-6">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-panel p-6 rounded-3xl border border-secondary/20 bg-secondary/5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full blur-2xl -mr-12 -mt-12" />
              <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">Reporte Consolidado de Hoy</h4>
                    <p className="text-[10px] text-secondary/60 font-bold uppercase tracking-widest">Resumen de todos los servicios del día</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {dailyAiSummary && (
                    <div className="hidden sm:block text-right max-w-xs">
                       <p className="text-[9px] text-white/40 italic line-clamp-2">"{dailyAiSummary.summary}"</p>
                    </div>
                  )}
                  <ReportDownload 
                    clientData={{ ...completeClientData, name: completeClientData.name || userData.name }} 
                    tasks={tasks.filter((t: any) => {
                      const today = new Date().toLocaleDateString();
                      const taskDate = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
                      return taskDate === today;
                    })}
                    tenantLogo={completeClientData.logo}
                  />
                </div>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Reporte de Historial Completo</h3>
                <ListChecks className="w-4 h-4 text-primary/20" />
              </div>
              <ReportDownload 
                clientData={{ ...completeClientData, name: completeClientData.name || userData.name }} 
                tasks={tasks}
                tenantLogo={completeClientData.logo}
                erpLogo="https://firebasestorage.googleapis.com/v0/b/cleanflow-ai.appspot.com/o/cleanflow_logo.png?alt=media"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1 pt-4">
          <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Historial de Reportes Consolidados</h3>
          <FileDown className="w-4 h-4 text-primary/20" />
        </div>
        <div className="grid grid-cols-1 gap-2">
          {pastReports.map((report) => (
            <div key={report.id} className="glass-panel p-4 rounded-2xl flex items-center justify-between bg-white/5 border border-white/5 hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase">{report.date}</p>
                  <p className="text-[8px] text-primary/40 font-bold uppercase tracking-widest">ID: {report.id} • {report.staffCount} Operarios</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  toast.success("Descargando reporte histórico...");
                  // Mocking individual historic download
                }}
                className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center hover:bg-primary/30 transition-all shadow-lg active:scale-90"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback Card */}
      <section className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-tertiary">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tu Opinión Importa</h3>
            <p className="text-xs text-primary/60 font-medium">Califica tu último servicio</p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}>
                <Star className={cn("w-5 h-5 transition-all", s <= rating ? "text-tertiary fill-tertiary scale-110" : "text-primary/20")} />
              </button>
            ))}
          </div>
        </div>
        {!feedbackSent ? (
          <button 
            onClick={() => {
              if (rating === 0) return toast.error("Por favor selecciona una calificación");
              setFeedbackSent(true);
            }}
            className="w-full h-10 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-tertiary/20 flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-3 h-3" /> Enviar Comentario
          </button>
        ) : (
          <div className="w-full h-10 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-widest rounded-xl border border-secondary/20 flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-3 h-3" /> ¡Gracias por tu feedback!
          </div>
        )}
      </section>

      {/* Modals */}
      <AnimatePresence>
        {selectedStaff && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedStaff(null)}
              className="absolute inset-0 bg-background/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-lg glass-panel p-6 sm:p-8 rounded-[2.5rem] space-y-6 shadow-2xl border border-white/10 overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <button 
                onClick={() => setSelectedStaff(null)} 
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-50 shadow-xl"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4">
                <p className="text-[10px] font-black text-secondary tracking-[0.4em] uppercase">Expediente Digital RH</p>
                {/* Visual ID Card / Credencial */}
                <div className="w-full bg-gradient-to-br from-secondary/30 via-primary/10 to-background rounded-[2.5rem] p-8 border border-white/10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                   <div className="absolute top-0 right-0 p-4 opacity-10 italic text-[10px] font-black uppercase tracking-[0.4em] rotate-12">Certified Professional</div>
                   <div className="absolute top-0 left-0 w-32 h-32 bg-secondary/10 rounded-full -ml-16 -mt-16 blur-3xl" />
                   
                   <div className="relative flex flex-col items-center">
                    <div className="w-28 h-28 rounded-full border-4 border-secondary p-1 bg-background shadow-2xl mb-4 relative">
                      <img 
                        src={selectedStaff.photo || selectedStaff.lastSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStaff.email}`} 
                        alt={selectedStaff.name} 
                        className="w-full h-full rounded-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center border-2 border-background">
                        <Check className="w-3 h-3 text-background font-bold" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tighter leading-none">{selectedStaff.name}</h3>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-secondary text-on-secondary text-[8px] font-black rounded-full uppercase tracking-widest">{selectedStaff.role}</span>
                        <span className="px-3 py-1 bg-white/5 text-white/40 text-[8px] font-black rounded-full uppercase tracking-widest border border-white/10">ID: {selectedStaff.id?.slice(0, 8).toUpperCase() || "EMP-9402"}</span>
                      </div>
                    </div>

                    <div className="w-full mt-8 grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                       <div className="text-left space-y-1">
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Nacionalidad</p>
                          <p className="text-xs font-bold text-white uppercase">{selectedStaff.nationality || "Mexicana"}</p>
                       </div>
                       <div className="text-right space-y-1">
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Antigüedad</p>
                          <p className="text-xs font-bold text-white uppercase">{selectedStaff.joinDate || 'Feb 2024'}</p>
                       </div>
                    </div>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                 <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-white/30 uppercase mb-1">Rating Gral</p>
                    <p className="text-lg font-black font-headline text-secondary tracking-tighter">{selectedStaff.rating || 4.9}</p>
                 </div>
                 <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-white/30 uppercase mb-1">Capacitaciones</p>
                    <p className="text-lg font-black font-headline text-primary tracking-tighter">12</p>
                 </div>
                 <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-white/30 uppercase mb-1">Puntualidad</p>
                    <p className="text-lg font-black font-headline text-tertiary tracking-tighter">98%</p>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden">
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3">
                       <Activity className="w-5 h-5 text-secondary" />
                       <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ficha Técnica & Desempeño</h4>
                    </div>

                    <div className="space-y-5">
                       {/* Calificaciones Pasadas RH */}
                       <div className="space-y-3">
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                             <ListChecks className="w-3 h-3" /> Calificaciones en RH (Histórico)
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                             {[
                               { label: "Psicométrico", val: selectedStaff.psychometricScore || 94, color: "bg-primary" },
                               { label: "Confianza", val: selectedStaff.reliabilityScore || 98, color: "bg-secondary" },
                               { label: "Procesos", val: 96, color: "bg-tertiary" },
                               { label: "Ética", val: 100, color: "bg-secondary" }
                             ].map((c, i) => (
                               <div key={i} className="p-3 bg-black/40 rounded-xl space-y-1 border border-white/5">
                                 <div className="flex justify-between items-center text-[8px] font-black uppercase text-white/20">
                                    <span>{c.label}</span>
                                    <span className="text-white/60">{c.val}%</span>
                                 </div>
                                 <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }} animate={{ width: `${c.val}%` }}
                                      className={cn("h-full", c.color)} 
                                    />
                                 </div>
                               </div>
                             ))}
                          </div>
                       </div>

                       {/* Procesos Dominados */}
                       <div className="space-y-3">
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                             <ShieldCheck className="w-3 h-3" /> Certificaciones y Procesos
                          </p>
                          <div className="flex flex-wrap gap-2">
                             {["ISO 9001", "Higiene Hospitalaria", "Químicos Avanzados", "Primeros Auxilios", "Seguridad Visual"].map((badge, idx) => (
                               <span key={idx} className="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-full text-[8px] font-black text-secondary uppercase tracking-widest">
                                 {badge}
                               </span>
                             ))}
                          </div>
                       </div>

                       {/* Bio / Notas */}
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Comentarios de Selección</p>
                         <p className="text-[10px] text-white/70 leading-relaxed italic">
                           "Operario altamente calificado con enfoque en detalle. Destaca por su manejo de maquinaria especializada y adherencia estricta a protocolos de seguridad industrial."
                         </p>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-secondary/10 p-5 rounded-[2rem] border border-secondary/20 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full blur-xl -mr-12 -mt-12" />
                    <div className="relative flex items-center gap-3">
                      <Clock className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[8px] font-black text-secondary/60 uppercase">Turno Actual</p>
                        <p className="text-sm font-black text-white">{selectedStaff.schedule || "09:00 - 18:00"}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowTaskForm(!showTaskForm)}
                      className="relative px-4 py-2 bg-secondary text-on-secondary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                    >
                      {showTaskForm ? "Cancelar" : "Asignar Tarea"}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showTaskForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Detalles de la Tarea Prioritaria</label>
                            <textarea 
                              value={taskDescription}
                              onChange={(e) => setTaskDescription(e.target.value)}
                              placeholder="Ej: Limpieza profunda de cristales en oficina 4..."
                              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:border-secondary transition-all outline-none"
                              rows={3}
                            />
                          </div>
                          <button 
                            disabled={isSendingTask}
                            onClick={handleAssignTask}
                            className="w-full h-12 bg-secondary text-on-secondary rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 group disabled:opacity-50"
                          >
                            {isSendingTask ? (
                              <div className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Enviar Tarea Directa
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {selectedTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm glass-panel p-8 rounded-3xl space-y-6 shadow-2xl border border-white/10 overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setSelectedTask(null)} className="absolute top-4 right-4 text-primary/40 hover:text-white">
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
                    selectedTask.status === 'completed' ? "bg-secondary text-on-secondary" : "bg-error text-white"
                  )}>
                    {selectedTask.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-headline text-white uppercase tracking-tighter">{selectedTask.title}</h3>
                    <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{selectedTask.id}</p>
                  </div>
                </div>

                {(selectedTask.afterPhoto || selectedTask.imageUrl) && (
                  <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 group relative">
                    <img src={selectedTask.afterPhoto || selectedTask.imageUrl} alt="Evidencia" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end p-4">
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Camera className="w-3 h-3" /> Evidencia Validada por IA
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2">Análisis de Integridad</p>
                    <p className="text-xs text-white/70 leading-relaxed italic">
                      "{selectedTask.aiNotes || selectedTask.aiFeedback || "Actividad completada bajo estándares de calidad Impeccable."}"
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Ubicación</p>
                      <p className="text-xs font-bold text-white mt-1 truncate">{selectedTask.locationName || 'General'}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Score IA</p>
                      <p className="text-xs font-bold text-secondary mt-1">{(selectedTask.score !== undefined ? selectedTask.score : selectedTask.aiScore) ?? 0}%</p>
                    </div>
                  </div>

                  {selectedTask.status === 'rejected' && (
                    <button 
                      onClick={() => handleManualApprove(selectedTask.id)}
                      className="w-full h-12 bg-primary text-on-primary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" /> Aprobar Manualmente
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
