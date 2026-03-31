import { motion } from "framer-motion";
import { UserPlus, FileText, CheckCircle2, Clock, ChevronRight, MessageSquare, ShieldCheck, Award } from "lucide-react";
import { cn } from "../lib/utils";

const candidates = [
  { name: "Juan Pérez", status: "interview", score: 88, role: "Operador" },
  { name: "María García", status: "onboarding", score: 94, role: "Supervisor" },
  { name: "Luis Rodríguez", status: "pending", score: 72, role: "Operador" }
];

export default function RHModule() {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Talento IA</h1>
          <p className="text-sm text-primary/60 font-medium">Reclutamiento y Onboarding Express</p>
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
          <UserPlus className="w-6 h-6" />
        </div>
      </section>

      {/* Recruitment Funnel */}
      <section className="glass-panel p-6 rounded-3xl space-y-6 relative overflow-hidden border-l-4 border-secondary shadow-2xl">
        <div className="absolute top-0 right-0 p-3">
          <div className="bg-secondary/20 px-2 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-secondary fill-secondary" />
            <span className="text-[8px] font-black text-secondary uppercase tracking-widest">Filtro IA Activo</span>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-secondary" /> Candidatos en WhatsApp
          </h3>
          <p className="text-xs text-primary/60 leading-relaxed">
            La IA ha filtrado <span className="text-white font-bold">12 candidatos</span> esta semana. <span className="text-secondary font-bold">3 listos</span> para entrevista técnica.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button className="flex-1 h-10 bg-secondary/10 hover:bg-secondary/20 text-secondary text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-secondary/20">
            Ver Chat Logs
          </button>
          <button className="flex-[2] h-10 bg-secondary rounded-xl text-on-secondary font-black font-headline text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform">
            Programar Entrevistas
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Candidatos Recientes</h3>
        <div className="space-y-3">
          {candidates.map((candidate, i) => (
            <div key={i} className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{candidate.name}</h4>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{candidate.role}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div className="space-y-1">
                  <p className={cn(
                    "text-[10px] font-bold uppercase",
                    candidate.status === "onboarding" ? "text-secondary" : "text-tertiary"
                  )}>{candidate.status}</p>
                  <p className="text-xs font-black font-headline text-white">{candidate.score}% Match</p>
                </div>
                <ChevronRight className="w-5 h-5 text-primary/40 group-hover:text-white transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Onboarding Progress */}
      <section className="glass-panel p-6 rounded-3xl space-y-4">
        <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Onboarding en Curso</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">María García</p>
                <p className="text-[10px] text-primary/60 font-medium uppercase tracking-widest">Módulo 3: Protocolos Químicos</p>
              </div>
            </div>
            <span className="text-lg font-black font-headline text-secondary">75%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "75%" }}
              className="h-full bg-secondary shadow-[0_0_8px_rgba(68,221,194,0.4)]" 
            />
          </div>
        </div>
      </section>
    </div>
  );
}
