import { motion } from "framer-motion";
import { Power, Star, Flame, ChevronRight, Award, Phone, ShieldCheck, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { toast } from "sonner";

export default function OperatorHome({ userData }: { userData: any }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Welcome Section */}
      <section className="flex flex-col items-center text-center space-y-1">
        <h2 className="text-2xl sm:text-3xl font-black font-headline text-white tracking-tight uppercase">¡Hola, {userData?.name?.split(' ')[0] || "Operador"}!</h2>
        <p className="text-xs sm:text-sm text-primary/60 font-medium">Listo para elevar el estándar hoy</p>
      </section>

      {/* Gamification Badge */}
      <section className="flex justify-center">
        <div className="glass-panel px-3 py-1.5 xs:px-4 xs:py-2 rounded-full flex items-center gap-2 shadow-xl">
          <div className="bg-tertiary/20 p-1 rounded-full">
            <Award className="w-4 h-4 xs:w-5 xs:h-5 text-tertiary fill-tertiary/20" />
          </div>
          <span className="font-headline font-extrabold text-tertiary tracking-wide text-[10px] xs:text-sm uppercase">Nivel Maestro</span>
          <div className="h-3 xs:h-4 w-[1px] bg-white/10 mx-1" />
          <span className="text-[9px] xs:text-xs text-primary/60 font-medium whitespace-nowrap">Top 5% Global</span>
        </div>
      </section>

      {/* Main Action Button */}
      <section className="flex flex-col items-center justify-center py-4 xs:py-6 relative">
        <div className="absolute top-0 flex items-center gap-2 px-3 py-1 bg-secondary/10 rounded-full border border-secondary/20 z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </span>
          <span className="text-[9px] xs:text-[10px] font-bold text-secondary tracking-tighter uppercase whitespace-nowrap">
            {userData?.lastLocation ? `GPS: ${userData.lastLocation.lat.toFixed(2)}, ${userData.lastLocation.lng.toFixed(2)}` : "GPS Activo: Sector 7"}
          </span>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/checkin")}
          className="relative group mt-6 xs:mt-8"
        >
          {/* Radar Circles */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-full bg-secondary/30 rounded-full animate-radar-pulse opacity-0"></div>
            <div className="w-full h-full bg-secondary/30 rounded-full animate-radar-pulse delay-700 opacity-0"></div>
            <div className="w-full h-full bg-secondary/30 rounded-full animate-radar-pulse delay-1000 opacity-0"></div>
          </div>

          <div className="absolute -inset-4 bg-secondary/20 rounded-full blur-2xl group-active:bg-secondary/40 transition-all duration-500"></div>
          <div className={cn(
            "relative w-56 h-56 sm:w-64 sm:h-64 rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(68,221,194,0.3)] transition-colors",
            userData?.status === "active" ? "bg-gradient-to-br from-secondary to-secondary-container" : "bg-gradient-to-br from-primary to-primary/60"
          )}>
            <Power className="w-12 h-12 sm:w-16 sm:h-16 text-on-secondary mb-1 sm:mb-2" strokeWidth={3} />
            <span className="font-headline font-black text-on-secondary text-xl sm:text-2xl tracking-tighter uppercase leading-none">
              {userData?.status === "active" ? "Validar" : "Iniciar"}
            </span>
            <span className="font-headline font-black text-on-secondary text-xl sm:text-2xl tracking-tighter uppercase">Servicio</span>
          </div>
          {/* Precision Ring */}
          <div className="absolute inset-0 border border-white/20 rounded-full scale-110 animate-[spin_10s_linear_infinite]"></div>
        </motion.button>
        
        <p className="mt-6 xs:mt-8 text-primary/40 text-xs sm:text-sm font-medium">
          {userData?.lastCheckIn ? `Último Check-in: ${new Date(userData.lastCheckIn.seconds * 1000).toLocaleTimeString()}` : "Turno: 08:00 AM - 04:00 PM"}
        </p>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-3 xs:gap-4">
        <button 
          onClick={() => {
            const rhPhone = userData?.tenantConfig?.rhPhone || "521234567890";
            window.open(`https://wa.me/${rhPhone}?text=Hola RH, soy ${userData.name}. Necesito apoyo con...`, '_blank');
          }}
          className="col-span-2 glass-panel p-4 xs:p-6 flex items-center justify-between group hover:border-secondary/40 transition-all border-l-4 border-secondary active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 xs:gap-4">
            <div className="w-10 h-10 xs:w-12 xs:h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
              <Phone className="w-5 h-5 xs:w-6 xs:h-6" />
            </div>
            <div className="text-left">
              <h4 className="text-xs xs:text-sm font-black text-white uppercase leading-tight">Contactar a RH</h4>
              <p className="text-[9px] xs:text-[10px] text-primary/60 font-bold uppercase tracking-widest mt-0.5">Soporte directo vía WhatsApp</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 xs:w-5 xs:h-5 text-primary/40 group-hover:text-secondary translate-x-0 group-hover:translate-x-1 transition-all" />
        </button>

        <button 
          onClick={() => navigate("/points")}
          className="col-span-2 glass-panel p-4 xs:p-6 flex items-center justify-between group hover:border-tertiary/40 transition-all border-l-4 border-tertiary active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 xs:gap-4">
            <div className="relative">
              <div className="w-10 h-10 xs:w-12 xs:h-12 bg-tertiary/10 rounded-2xl flex items-center justify-center text-tertiary">
                <Trophy className="w-5 h-5 xs:w-6 xs:h-6" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full flex items-center justify-center text-[8px] font-black text-white animate-pulse">!</div>
            </div>
            <div className="text-left">
              <h4 className="text-xs xs:text-sm font-black text-white uppercase leading-tight">Comunidad & Ranking</h4>
              <p className="text-[9px] xs:text-[10px] text-primary/60 font-bold uppercase tracking-widest mt-0.5">Ve el Top 3 y celebra logros en equipo</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 xs:w-5 xs:h-5 text-primary/40 group-hover:text-tertiary translate-x-0 group-hover:translate-x-1 transition-all" />
        </button>

        <div className="glass-panel p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Saldo de Puntos</span>
            <Star className="w-5 h-5 text-secondary fill-secondary" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-headline font-black text-white">{userData?.points?.toLocaleString() || "0"}</span>
            <span className="text-xs font-bold text-secondary uppercase tracking-widest ml-1">Pts Totales</span>
          </div>
          <button 
            onClick={() => navigate("/points")}
            className="w-full mt-2 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary text-[8px] font-black uppercase tracking-[0.2em] rounded-lg border border-secondary/20 transition-all"
          >
            Canjear Premios
          </button>
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
              <h4 className="text-xs font-bold text-primary/60 uppercase tracking-widest">Plan de Trabajo</h4>
              <p className="text-white text-sm font-semibold">Tareas diarias asignadas por IA</p>
            </div>
          </div>
          <button 
            onClick={() => navigate("/tasks")}
            className="w-full h-12 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary/20 transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Ver mi Plan del Día
          </button>
        </div>

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
            <button 
              onClick={() => navigate("/achievements")}
              className="text-[10px] font-bold text-primary/60 uppercase tracking-tighter flex items-center gap-1 hover:text-primary transition-colors"
            >
              Historial de Logros <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
