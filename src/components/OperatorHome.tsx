import { motion } from "framer-motion";
import { Power, Star, Flame, ChevronRight, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";

export default function OperatorHome({ userData }: { userData: any }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <section className="flex flex-col items-center text-center space-y-1">
        <h2 className="text-3xl font-black font-headline text-white tracking-tight uppercase">¡Hola, {userData?.name?.split(' ')[0] || "Operador"}!</h2>
        <p className="text-sm text-primary/60 font-medium">Listo para elevar el estándar hoy</p>
      </section>

      {/* Gamification Badge */}
      <section className="flex justify-center">
        <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
          <div className="bg-tertiary/20 p-1.5 rounded-full">
            <Award className="w-5 h-5 text-tertiary fill-tertiary/20" />
          </div>
          <span className="font-headline font-extrabold text-tertiary tracking-wide text-sm uppercase">Nivel Maestro</span>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <span className="text-xs text-primary/60 font-medium">Top 5% Global</span>
        </div>
      </section>

      {/* Main Action Button */}
      <section className="flex flex-col items-center justify-center py-10 relative">
        <div className="absolute top-0 flex items-center gap-2 px-3 py-1 bg-secondary/10 rounded-full border border-secondary/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </span>
          <span className="text-[10px] font-bold text-secondary tracking-tighter uppercase">GPS Activo: Sector 7</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/tasks")}
          className="relative group mt-8"
        >
          <div className="absolute -inset-4 bg-secondary/20 rounded-full blur-2xl group-active:bg-secondary/40 transition-all duration-500"></div>
          <div className="relative w-64 h-64 rounded-full bg-gradient-to-br from-secondary to-secondary-container flex flex-col items-center justify-center shadow-[0_0_50px_rgba(68,221,194,0.3)]">
            <Power className="w-16 h-16 text-on-secondary mb-2" strokeWidth={3} />
            <span className="font-headline font-black text-on-secondary text-2xl tracking-tighter uppercase leading-none">Iniciar</span>
            <span className="font-headline font-black text-on-secondary text-2xl tracking-tighter uppercase">Servicio</span>
          </div>
          {/* Precision Ring */}
          <div className="absolute inset-0 border border-white/20 rounded-full scale-110 animate-[spin_10s_linear_infinite]"></div>
        </motion.button>
        
        <p className="mt-8 text-primary/40 text-sm font-medium">Turno: 08:00 AM - 04:00 PM</p>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Puntos Hoy</span>
            <Star className="w-5 h-5 text-secondary fill-secondary" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-headline font-black text-white">+450</span>
            <span className="text-xs font-bold text-secondary uppercase">Pts</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Racha Fuego</span>
            <Flame className="w-5 h-5 text-error fill-error" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-headline font-black text-white">12</span>
            <span className="text-xs font-bold text-primary/60 uppercase">Días</span>
          </div>
        </div>

        {/* Progress Card */}
        <div className="col-span-2 glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-primary/60 uppercase tracking-widest">Próximo Nivel: Élite</h4>
              <p className="text-white text-sm font-semibold">Faltan 550 pts para subir</p>
            </div>
            <span className="text-tertiary font-headline font-black text-xl">85%</span>
          </div>
          <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "85%" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-tertiary to-tertiary/60 shadow-[0_0_10px_rgba(255,186,56,0.4)]" 
            />
          </div>
          <div className="flex justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-[10px] font-bold text-primary/60">4 Tareas Pendientes</span>
            </div>
            <button className="text-[10px] font-bold text-primary/60 uppercase tracking-tighter flex items-center gap-1 hover:text-primary transition-colors">
              Historial de Logros <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
