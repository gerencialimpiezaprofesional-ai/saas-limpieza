import { motion } from "framer-motion";
import { ShieldCheck, QrCode, Clock, ChevronRight, MessageSquare, Star, CheckCircle2, Award } from "lucide-react";
import { cn } from "../lib/utils";

const services = [
  { date: "Hoy, 10:30 AM", status: "completed", score: 98, location: "Oficinas Centrales", id: "SRV-204" },
  { date: "Ayer, 04:15 PM", status: "completed", score: 95, location: "Almacén Norte", id: "SRV-203" },
  { date: "22 Oct, 09:00 AM", status: "completed", score: 99, location: "Oficinas Centrales", id: "SRV-202" }
];

export default function ClientPortal() {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Portal Cliente</h1>
          <p className="text-sm text-primary/60 font-medium">Garantía de Satisfacción 100%</p>
        </div>
        <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
          <ShieldCheck className="w-6 h-6" />
        </div>
      </section>

      {/* Digital Hygiene Certificate */}
      <section className="glass-panel p-8 rounded-3xl space-y-6 relative overflow-hidden border-l-4 border-secondary shadow-2xl text-center">
        <div className="absolute top-0 right-0 p-3">
          <div className="bg-secondary/20 px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-secondary fill-secondary" />
            <span className="text-[8px] font-black text-secondary uppercase tracking-widest">Validado por IA</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="w-24 h-24 bg-white p-3 rounded-2xl mx-auto shadow-xl">
            <QrCode className="w-full h-full text-background" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black font-headline text-white uppercase tracking-tighter">Certificado de Higiene</h3>
            <p className="text-xs text-primary/60 font-medium">Escanea para ver el reporte de pureza</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl font-black font-headline text-secondary tracking-tighter">98%</span>
            <div className="text-left">
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Pureza</p>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Validada</p>
            </div>
          </div>
        </div>
        <button className="w-full h-12 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-transform">
          Compartir Reporte
        </button>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Historial de Servicios</h3>
        <div className="space-y-3">
          {services.map((service, i) => (
            <div key={i} className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{service.location}</h4>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{service.date}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-secondary">Completado</p>
                  <p className="text-xs font-black font-headline text-white">{service.score}% Pureza</p>
                </div>
                <ChevronRight className="w-5 h-5 text-primary/40 group-hover:text-white transition-colors" />
              </div>
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
              <Star key={s} className={cn("w-4 h-4", s <= 4 ? "text-tertiary fill-tertiary" : "text-primary/20")} />
            ))}
          </div>
        </div>
        <button className="w-full h-10 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-tertiary/20 flex items-center justify-center gap-2">
          <MessageSquare className="w-3 h-3" /> Enviar Comentario
        </button>
      </section>
    </div>
  );
}
