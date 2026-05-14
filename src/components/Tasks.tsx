import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ChevronDown, Camera, Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";

interface Task {
  id: string;
  title: string;
  client?: string;
  clientId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'pending_review';
  score?: number;
  approvalStatus?: 'approved' | 'rejected';
  supervisorNote?: string;
  time?: string;
  completedAt?: any;
  beforePhoto?: string;
  afterPhoto?: string;
  aiNotes?: string;
  operatorId?: string;
}

export default function Tasks({ userData }: { userData: any }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userData?.tenantId || !auth.currentUser) return;

    // Si es supervisor, ve todas las tareas del tenant. Si es operador, solo las suyas.
    let q;
    if (userData.role === 'supervisor' || userData.role === 'ceo' || userData.role === 'superadmin') {
      q = query(
        collection(db, "tasks"),
        where("tenantId", "==", userData.tenantId),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, "tasks"),
        where("tenantId", "==", userData.tenantId),
        where("operatorId", "==", auth.currentUser.uid),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot: any) => {
        const fetchedTasks = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        })) as Task[];
        setTasks(fetchedTasks);
        setLoading(false);
      },
      (error: any) => {
        console.error("Error fetching tasks:", error);
        if (error.code === 'failed-precondition') {
          toast.error("Error de índices en Firebase. Contacte a soporte.");
        } else {
          toast.error("Error al sincronizar tareas.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userData?.tenantId, userData?.role, auth.currentUser]);

  const handleManualApprove = async (taskId: string) => {
    if (!taskId || !db) return;
    const note = prompt("Ingrese nota de por qué aprueba manualmente esta actividad:");
    if (!note) return;

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: 'completed',
        score: 100,
        aiNotes: `[APROBACIÓN MANUAL SUPERVISOR]: ${note}`,
        manualApproval: true,
        approvalStatus: 'approved',
        approvedBy: userData.name,
        updatedAt: serverTimestamp()
      });
      toast.success("Tarea aprobada manualmente");
    } catch (error) {
      toast.error("Error al aprobar tarea");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Clock className="w-8 h-8 text-secondary animate-spin" />
        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Sincronizando Tareas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <section>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-2xl font-bold font-headline text-white tracking-tight">Tareas del día</h1>
            <p className="text-sm text-primary/60 font-medium">Panel de Operaciones</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-headline text-secondary">
              {tasks.filter(t => t.status === 'completed').length} 
              <span className="text-primary/60 text-sm font-medium"> de {tasks.length}</span>
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(tasks.filter(t => t.status === 'completed').length / (tasks.length || 1)) * 100}%` }}
            className="h-full bg-secondary shadow-[0_0_12px_rgba(68,221,194,0.4)]" 
          />
        </div>
      </section>

      <div className="space-y-4">
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
            initial={{ opacity: 0.9, y: 10 }}
            animate={{ 
              opacity: task.status === 'completed' ? 0.85 : 1,
              y: 0,
              scale: task.status === 'completed' ? 0.98 : 1,
              backgroundColor: task.status === 'completed' ? "rgba(20, 20, 20, 0.4)" : "rgba(30, 30, 34, 1)"
            }}
            className={cn(
              "rounded-xl overflow-hidden shadow-lg border-l-4 transition-all cursor-pointer active:scale-[0.98] relative",
              task.status === "in_progress" ? "border-primary" : "border-transparent",
              task.status === "pending" && "opacity-60"
            )}
          >
            {task.status === 'completed' && (
              <motion.div 
                initial={{ scale: 3, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 0.05 }}
                className="absolute -right-6 -top-6 pointer-events-none"
              >
                <CheckCircle2 className="w-32 h-32 text-secondary" />
              </motion.div>
            )}
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary">
                <Search className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-sm">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{task.client || "Cliente"}</p>
                      {(task as any).areaName && (
                        <>
                          <span className="text-[10px] text-primary/20">•</span>
                          <p className="text-[10px] text-tertiary font-bold uppercase tracking-widest">{(task as any).areaName}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {task.status === 'pending_review' && (
                      <motion.span 
                        key="pending-review"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-orange-500/20"
                      >
                        <Clock className="w-3 h-3" />
                        En Revisión
                      </motion.span>
                    )}
                    {task.status === 'completed' && task.score && task.score >= 75 && (
                      <motion.span 
                        key="approved"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 fill-secondary/20" />
                        IA Aprobada
                      </motion.span>
                    )}
                    {task.status === 'completed' && task.score && task.score < 75 && !task.approvalStatus && !(task as any).clientApproved && (
                      <motion.span 
                        key="audit"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-2 py-1 rounded-full bg-error/10 text-error text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-error/20"
                      >
                        <XCircle className="w-3 h-3 fill-error/20" />
                        Revisión IA
                      </motion.span>
                    )}
                    {task.status === 'completed' && (task.approvalStatus === 'approved' || (task as any).clientApproved) && (
                      <motion.span 
                        key="approved-sup"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-2 py-1 rounded-full bg-secondary/20 text-secondary text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-secondary/30"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {(task as any).clientApproved ? "Cliente OK" : "Validado"}
                      </motion.span>
                    )}
                    {task.status === 'rejected' && (
                      <motion.span 
                        key="rejected"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-2 py-1 rounded-full bg-error text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-error/20"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Re-hacer
                      </motion.span>
                    )}
                    {task.status === "in_progress" && (
                      <motion.span 
                        key="progress"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider"
                      >
                        En Progreso
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-xs mt-1 text-primary/60 italic lowercase">
                  {task.status === 'pending_review' ? (
                    'Esperando aprobación estratégica'
                  ) : task.status === 'completed' ? (
                    `Completada ${task.completedAt?.toDate ? task.completedAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recientemente'}`
                  ) : task.status === 'rejected' ? (
                    'Esta tarea fue rechazada y debe repetirse'
                  ) : 'Pendiente de inicio'}
                </p>
              </div>
              <ChevronDown className={cn("w-5 h-5 text-primary/40 transition-transform", expandedId === task.id && "rotate-180")} />
            </div>

            <AnimatePresence>
              {expandedId === task.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 overflow-hidden"
                >
                  {task.status === 'completed' ? (
                    <>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">Evidencia de Limpieza</p>
                          <div className="aspect-video rounded-lg overflow-hidden bg-surface-container relative group">
                            <img src={task.afterPhoto} alt="Después" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      </div>
                      <div className="bg-surface-container-highest/50 p-4 rounded-xl space-y-3 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                              <Search className="w-4 h-4 text-secondary" />
                            </div>
                            <span className="text-xs font-semibold text-white">Score de Calidad IA</span>
                          </div>
                          <span className="text-lg font-black text-secondary font-headline">{task.score}%</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-[11px] text-white/80 leading-relaxed italic">
                            <span className="text-secondary font-bold mr-1">IA Report:</span>
                            "{task.aiNotes || "Análisis no disponible"}"
                          </p>
                        </div>
                        {task.supervisorNote && (
                          <div className="p-3 bg-secondary/5 rounded-lg border border-secondary/20">
                            <p className="text-[11px] text-secondary leading-relaxed">
                              <span className="font-bold mr-1 uppercase tracking-widest text-[9px]">Nota Supervisor:</span>
                              "{task.supervisorNote}"
                            </p>
                          </div>
                        )}
                        {task.score && task.score < 75 && userData.role === 'supervisor' && !task.approvalStatus && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualApprove(task.id);
                            }}
                            className="w-full h-10 bg-secondary/20 text-secondary border border-secondary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary/30 transition-all"
                          >
                            Aprobación Manual del Supervisor
                          </button>
                        )}
                      </div>
                    </>
                  ) : task.status === 'rejected' ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-error/10 border border-error/20 rounded-2xl">
                         <div className="flex items-center gap-2 text-error mb-2">
                           <AlertTriangle className="w-4 h-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Motivo del Rechazo</span>
                         </div>
                         <p className="text-xs text-white/80 italic">"{task.supervisorNote || 'No se especificó un motivo.'}"</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/camera/${task.id}`);
                        }}
                        className="w-full h-12 bg-error text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform shadow-xl shadow-error/20"
                      >
                        Repetir Actividad Correctamente
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-primary/60">Esta tarea aún no ha sido completada. La IA requiere evidencia visual del resultado final para validar el servicio.</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/camera/${task.id}`);
                        }}
                        className="w-full h-12 bg-primary text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
                      >
                        Capturar Evidencia
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <button 
        onClick={() => navigate("/camera")}
        className="fixed right-6 bottom-24 w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-secondary-container shadow-[0_8px_20px_rgba(68,221,194,0.3)] flex items-center justify-center text-on-secondary z-40 active:scale-95 transition-transform"
      >
        <Camera className="w-6 h-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}
