import React from "react";
import { motion } from "framer-motion";
import { Award, Trophy, Zap, CheckCircle, Star, Target, ShieldCheck, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";

const achievements = [
  {
    id: 1,
    title: "Maestro del Brillo",
    description: "Has obtenido un score de 95%+ en 10 servicios consecutivos.",
    progress: 80,
    total: 10,
    current: 8,
    icon: Star,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    unlocked: false
  },
  {
    id: 2,
    title: "Puntualidad Marcial",
    description: "Llegada al sector asignado antes de la hora de inicio por 5 días.",
    progress: 100,
    total: 5,
    current: 5,
    icon: ShieldCheck,
    color: "text-primary",
    bgColor: "bg-primary/10",
    unlocked: true
  },
  {
    id: 3,
    title: "Zero Desperdicio",
    description: "Optimización de insumos reportada por la IA en 3 pedidos.",
    progress: 33,
    total: 3,
    current: 1,
    icon: Zap,
    color: "text-tertiary",
    bgColor: "bg-tertiary/10",
    unlocked: false
  },
  {
    id: 4,
    title: "Veterano de Impeccable",
    description: "Más de 50 servicios validados exitosamente por la plataforma.",
    progress: 100,
    total: 50,
    current: 54,
    icon: Trophy,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    unlocked: true
  }
];

export default function Achievements() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-10">
      <section className="flex items-center gap-4">
        <button 
          onClick={() => navigate("/profile")}
          className="w-10 h-10 glass-panel rounded-xl flex items-center justify-center text-primary/60 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-black font-headline text-white uppercase tracking-tight">Mis Logros</h1>
          <p className="text-sm text-primary/60 font-medium tracking-tight">Gamificación y Mérito IA</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-3xl space-y-2 border-l-4 border-yellow-400 bg-yellow-400/5">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Insignias</p>
          <p className="text-3xl font-black font-headline text-white">12</p>
          <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-tighter">Nivel 4: Oro</p>
        </div>
        <div className="glass-panel p-5 rounded-3xl space-y-2 border-l-4 border-secondary bg-secondary/5">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Rango Global</p>
          <p className="text-3xl font-black font-headline text-white">#42</p>
          <p className="text-[10px] text-secondary font-bold uppercase tracking-tighter">Top 5% Operadores</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] px-1">Progreso de Desafíos</h3>
        <div className="space-y-3">
          {achievements.map((achievement) => (
            <div key={achievement.id} className={cn(
              "glass-panel p-5 rounded-3xl border transition-all relative overflow-hidden",
              achievement.unlocked ? "border-white/10" : "border-white/5 opacity-80"
            )}>
              {!achievement.unlocked && (
                <div className="absolute top-0 right-0 p-3">
                  <Target className="w-4 h-4 text-primary/20" />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  achievement.bgColor,
                  achievement.color
                )}>
                  <achievement.icon className="w-6 h-6" />
                </div>
                <div className="space-y-3 w-full">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{achievement.title}</h4>
                    <p className="text-[10px] text-primary/60 font-medium leading-relaxed">{achievement.description}</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className={achievement.unlocked ? "text-secondary" : "text-primary/40"}>
                        {achievement.unlocked ? "Completado" : "En Progreso"}
                      </span>
                      <span className="text-white">{achievement.current} / {achievement.total}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${achievement.progress}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          achievement.unlocked ? "bg-secondary shadow-[0_0_10px_#44DDC2]" : "bg-primary"
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="p-6 bg-primary/5 rounded-3xl border border-dashed border-primary/20 text-center space-y-3">
        <Award className="w-8 h-8 text-primary/40 mx-auto" />
        <p className="text-xs text-primary/60 font-medium italic">"Los logros desbloquean bonos de puntos extra y beneficios en la tienda de canje."</p>
      </section>
    </div>
  );
}
