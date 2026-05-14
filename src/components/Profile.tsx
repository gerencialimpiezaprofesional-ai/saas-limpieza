import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Building, LogOut, ChevronRight, Bell, ShieldCheck } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';

interface UserData {
  name?: string;
  email: string;
  role: string;
  tenantId?: string;
  lastSelfie?: string;
}

export default function Profile({ userData }: { userData: UserData | null }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Sesión cerrada con éxito");
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  if (!userData) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <section className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-primary/20 border-4 border-secondary/40 overflow-hidden mx-auto shadow-2xl">
            <img 
              src={userData.lastSelfie || `https://picsum.photos/seed/${userData.email}/200/200`} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute bottom-1 right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center border-2 border-background">
            <ShieldCheck className="w-3 h-3 text-on-secondary" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-white font-headline uppercase">{userData.name || 'Usuario'}</h2>
          <p className="text-secondary font-black text-[10px] uppercase tracking-widest">{userData.role}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Email</p>
            <p className="text-sm font-medium text-white">{userData.email}</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
            <Building className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Organización</p>
            <p className="text-sm font-medium text-white">{userData.tenantId || 'Impeccable AI Global'}</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Estatus de Cuenta</p>
            <p className="text-sm font-medium text-secondary flex items-center gap-2">
              Validada por IA
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest ml-1">Configuración</p>
        <button 
          className="w-full h-14 glass-panel rounded-2xl flex items-center justify-between px-6 hover:bg-white/5 transition-all border border-white/5"
        >
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-white">Notificaciones</span>
          </div>
          <ChevronRight className="w-5 h-5 text-primary/40" />
        </button>
        <button 
          onClick={handleLogout}
          className="w-full h-14 bg-error/10 border border-error/20 rounded-2xl flex items-center justify-between px-6 hover:bg-error/20 transition-all"
        >
          <div className="flex items-center gap-4">
            <LogOut className="w-5 h-5 text-error" />
            <span className="text-sm font-bold text-error">Cerrar Sesión</span>
          </div>
          <ChevronRight className="w-5 h-5 text-error/40" />
        </button>
      </section>
    </div>
  );
}
