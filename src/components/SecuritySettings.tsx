import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Key, Lock, Eye, EyeOff, Loader2, ChevronLeft, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../firebase";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export default function SecuritySettings({ userData }: { userData: any }) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const user = auth.currentUser;

    if (user && user.email) {
      try {
        // Firebase requiere reautenticación para cambios de contraseña
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        await updatePassword(user, newPassword);
        toast.success("Contraseña actualizada con éxito.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => navigate("/profile"), 1500);
      } catch (error: any) {
        console.error("Error al actualizar contraseña:", error);
        if (error.code === "auth/wrong-password") {
          toast.error("La contraseña actual es incorrecta.");
        } else {
          toast.error("Error al actualizar: " + (error.message || "Intenta de nuevo."));
        }
      } finally {
        setLoading(false);
      }
    } else {
      toast.error("No se detectó una sesión activa.");
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-black font-headline text-white uppercase tracking-tight">Seguridad</h1>
          <p className="text-sm text-primary/60 font-medium tracking-tight">Gestión de Acceso y Privacidad</p>
        </div>
      </section>

      <section className="glass-panel p-6 rounded-3xl space-y-6 relative overflow-hidden border-l-4 border-secondary">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <ShieldCheck className="w-20 h-20 text-secondary" />
        </div>
        
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-secondary" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Cambiar Contraseña</h3>
            </div>
            <p className="text-[10px] text-primary/60 font-medium">Actualiza tus credenciales de acceso para mayor seguridad.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
              <input
                type={showCurrent ? "text" : "password"}
                placeholder="Contraseña Actual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-sm text-white focus:border-secondary outline-none transition-all font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-white transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
              <input
                type={showNew ? "text" : "password"}
                placeholder="Nueva Contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-sm text-white focus:border-secondary outline-none transition-all font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-white transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
              <input
                type="password"
                placeholder="Confirmar Nueva Contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-sm text-white focus:border-secondary outline-none transition-all font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Actualizar Contraseña"}
          </button>
        </form>
      </section>

      {userData?.role !== 'client' && (
        <section className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-primary">
           <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Protección Biométrica</h3>
          </div>
          <div className="flex items-center justify-between">
              <div>
                  <p className="text-sm font-bold text-white">Validación Facial en Check-in</p>
                  <p className="text-[10px] text-primary/60 font-medium">Requerido por protocolos de seguridad de Impeccable AI.</p>
              </div>
              <div className="w-12 h-6 bg-secondary/20 rounded-full relative p-1">
                  <div className="w-4 h-4 bg-secondary rounded-full absolute right-1" />
              </div>
          </div>
        </section>
      )}

      <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest text-center px-10 leading-relaxed">
        Impeccable AI utiliza cifrado de grado militar para proteger tus datos personales y credenciales.
      </p>
    </div>
  );
}
