import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ChevronDown, Camera, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";

const tasks = [
  {
    id: 1,
    title: "Limpieza Baños - Ala Norte",
    client: "Emmsa",
    status: "completed",
    aiStatus: "approved",
    time: "Finalizado hace 20 min",
    score: 92,
    beforePhoto: "https://picsum.photos/seed/before1/400/400",
    afterPhoto: "https://picsum.photos/seed/after1/400/400",
    icon: "wc"
  },
  {
    id: 2,
    title: "Oficinas Piso 4",
    client: "Casa Lumbre",
    status: "in_progress",
    time: "Iniciado 14:05",
    icon: "office"
  },
  {
    id: 3,
    title: "Comedor Empleados",
    client: "Engrane",
    status: "rejected",
    aiStatus: "rejected",
    time: "Re-inspección requerida",
    icon: "coffee"
  },
  {
    id: 4,
    title: "Almacén de Insumos",
    client: "Emmsa",
    status: "pending",
    time: "Estimado: 16:30",
    icon: "inventory"
  }
];

export default function Tasks() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <section>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-2xl font-bold font-headline text-white tracking-tight">Tareas del día</h1>
            <p className="text-sm text-primary/60 font-medium">Lunes, 24 de Octubre</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-headline text-secondary">5 <span className="text-primary/60 text-sm font-medium">de 8</span></span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "62.5%" }}
            className="h-full bg-secondary shadow-[0_0_12px_rgba(68,221,194,0.4)]" 
          />
        </div>
        <p className="mt-3 text-xs text-primary/40 font-medium uppercase tracking-wider">62% de la jornada completada</p>
      </section>

      <div className="space-y-4">
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            className={cn(
              "bg-surface-container-low rounded-xl overflow-hidden shadow-lg border-l-4 transition-all",
              task.status === "in_progress" ? "border-primary" : "border-transparent",
              task.status === "pending" && "opacity-60"
            )}
          >
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary">
                <Search className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-sm">{task.title}</h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{task.client}</p>
                  </div>
                  {task.aiStatus === "approved" && (
                    <span className="px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 fill-secondary/20" />
                      IA Aprobada
                    </span>
                  )}
                  {task.aiStatus === "rejected" && (
                    <span className="px-2 py-1 rounded-full bg-error/10 text-error text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <XCircle className="w-3 h-3 fill-error/20" />
                      Rechazada
                    </span>
                  )}
                  {task.status === "in_progress" && (
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                      En Progreso
                    </span>
                  )}
                </div>
                <p className={cn(
                  "text-xs mt-1",
                  task.status === "rejected" ? "text-error/80" : "text-primary/60"
                )}>{task.time}</p>
              </div>
              <ChevronDown className="w-5 h-5 text-primary/40" />
            </div>

            {task.aiStatus === "approved" && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">Foto Antes</p>
                    <div className="aspect-square rounded-lg overflow-hidden bg-surface-container relative group">
                      <img src={task.beforePhoto} alt="Antes" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">Foto Después</p>
                    <div className="aspect-square rounded-lg overflow-hidden bg-surface-container relative group">
                      <img src={task.afterPhoto} alt="Después" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface-container-highest/50 p-3 rounded-lg flex items-center justify-between border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Search className="w-4 h-4 text-secondary" />
                    </div>
                    <span className="text-xs font-semibold text-white">Score de Calidad IA</span>
                  </div>
                  <span className="text-lg font-black text-secondary font-headline">{task.score}%</span>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* FAB */}
      <button 
        onClick={() => navigate("/camera")}
        className="fixed right-6 bottom-24 w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-secondary-container shadow-[0_8px_20px_rgba(68,221,194,0.3)] flex items-center justify-center text-on-secondary z-40 active:scale-95 transition-transform"
      >
        <Camera className="w-6 h-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}
