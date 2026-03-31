import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Home, ClipboardList, Star, User, Bell, Menu, LogOut, ChevronRight, Award, ShieldCheck, Zap, Package, UserPlus, Camera, Loader2, Database } from "lucide-react";
import { cn } from "./lib/utils";
import OperatorHome from "./components/OperatorHome";
import Tasks from "./components/Tasks";
import CameraCapture from "./components/CameraCapture";
import Inventory from "./components/Inventory";
import RHModule from "./components/RHModule";
import ClientPortal from "./components/ClientPortal";
import { seedDemoData } from "./services/seedService";
import { generateExecutiveSummary } from "./services/gemini";
import { sendDigitalCertificate } from "./services/messagingService";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError("Credenciales inválidas. Prueba con las cuentas demo.");
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      alert("¡Datos demo creados con éxito! Usa las credenciales proporcionadas.");
    } catch (err) {
      alert("Error al crear datos demo. Revisa la consola.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-700 bg-background">
      <div className="text-center space-y-2">
        <div className="w-20 h-20 bg-secondary/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-secondary/40 shadow-[0_0_40px_rgba(68,221,194,0.2)]">
          <ShieldCheck className="w-10 h-10 text-secondary" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-black font-headline tracking-tighter text-white uppercase">CleanFlow AI</h1>
        <p className="text-primary/60 font-medium text-sm tracking-wide">Automatización Total de la Confianza</p>
      </div>

      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <input
            type="email"
            placeholder="Email (ej: ceo@impeccable.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white focus:border-secondary outline-none transition-all"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white focus:border-secondary outline-none transition-all"
            required
          />
        </div>

        {error && <p className="text-error text-xs font-bold text-center">{error}</p>}

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Entrar"}
        </button>
      </form>

      <div className="w-full max-w-sm pt-4 border-t border-white/5">
        <button 
          onClick={handleSeed}
          disabled={seeding}
          className="w-full h-12 bg-white/5 border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-primary/60 hover:text-primary transition-all text-xs font-bold uppercase tracking-widest"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {seeding ? "Creando..." : "Inicializar Datos Demo (IMPECCABLE)"}
        </button>
      </div>

      <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em] text-center">Powered by CleanFlow AI v2.0</p>
    </div>
  );
};

const Profile = ({ userData }: { userData: any }) => {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
    <section className="flex flex-col items-center text-center space-y-4">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-4 border-secondary p-1">
          <img src={`https://picsum.photos/seed/${userData?.email}/200/200`} alt="User" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-secondary rounded-full flex items-center justify-center border-4 border-background">
          <Zap className="w-4 h-4 text-on-secondary fill-on-secondary" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-black font-headline text-white tracking-tight">{userData?.name || "Usuario"}</h2>
        <p className="text-sm text-primary/60 font-medium">{userData?.role?.toUpperCase()} • ID: CF-{userData?.uid?.slice(0,4)}</p>
      </div>
    </section>

    <section className="grid grid-cols-3 gap-2">
      <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">Servicios</p>
        <p className="text-xl font-black font-headline text-white">1,240</p>
      </div>
      <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">Calificación</p>
        <p className="text-xl font-black font-headline text-secondary">4.9</p>
      </div>
      <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">Puntos</p>
        <p className="text-xl font-black font-headline text-tertiary">{userData?.points || 0}</p>
      </div>
    </section>

    <section className="space-y-3">
      <button className="w-full h-14 glass-panel rounded-2xl flex items-center justify-between px-6 hover:bg-white/5 transition-all">
        <div className="flex items-center gap-4">
          <Award className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-white">Mis Logros</span>
        </div>
        <ChevronRight className="w-5 h-5 text-primary/40" />
      </button>
      <button 
        onClick={() => navigate("/inventory")}
        className="w-full h-14 glass-panel rounded-2xl flex items-center justify-between px-6 hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-4">
          <Package className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-white">Inventario</span>
        </div>
        <ChevronRight className="w-5 h-5 text-primary/40" />
      </button>
      <button 
        onClick={() => navigate("/rh")}
        className="w-full h-14 glass-panel rounded-2xl flex items-center justify-between px-6 hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-4">
          <UserPlus className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-white">Talento y RH</span>
        </div>
        <ChevronRight className="w-5 h-5 text-primary/40" />
      </button>
      <button className="w-full h-14 glass-panel rounded-2xl flex items-center justify-between px-6 hover:bg-white/5 transition-all">
        <div className="flex items-center gap-4">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-white">Seguridad y Privacidad</span>
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
      </button>
    </section>
  </div>
  );
};

const Points = () => (
  <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
    <section className="text-center space-y-2">
      <h1 className="text-3xl font-black font-headline text-white tracking-tight uppercase">Tienda de Canje</h1>
      <p className="text-sm text-primary/60 font-medium">Tus puntos valen dinero real</p>
    </section>

    <div className="glass-panel p-6 rounded-3xl flex items-center justify-between shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full -mr-16 -mt-16 blur-3xl" />
      <div className="space-y-1">
        <p className="text-xs font-bold text-primary/60 uppercase tracking-widest">Saldo Actual</p>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black font-headline text-white">12,450</span>
          <span className="text-sm font-bold text-secondary uppercase">Pts</span>
        </div>
      </div>
      <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center border border-secondary/40">
        <Star className="w-8 h-8 text-secondary fill-secondary" />
      </div>
    </div>

    <section className="space-y-4">
      <h3 className="text-xs font-bold text-primary/60 uppercase tracking-[0.2em]">Recompensas Disponibles</h3>
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: "Bono $50 USD", pts: "5,000", img: "https://picsum.photos/seed/bonus1/200/200" },
          { title: "Día Libre", pts: "8,000", img: "https://picsum.photos/seed/bonus2/200/200" },
          { title: "Gift Card Amazon", pts: "3,000", img: "https://picsum.photos/seed/bonus3/200/200" },
          { title: "Kit Limpieza Pro", pts: "2,500", img: "https://picsum.photos/seed/bonus4/200/200" },
        ].map((item, i) => (
          <div key={i} className="glass-panel rounded-2xl overflow-hidden group">
            <div className="aspect-video relative">
              <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            </div>
            <div className="p-4 space-y-1">
              <h4 className="text-sm font-bold text-white">{item.title}</h4>
              <p className="text-xs font-bold text-secondary">{item.pts} Pts</p>
              <button className="w-full mt-3 h-8 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">Canjear</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

const CEODashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const operationalData = {
        satisfaction: 98.4,
        aiEfficiency: 92.1,
        activeServices: 42,
        qualityAlerts: 3,
        criticalSupplies: 12,
        clients: ["Emmsa", "Casa Lumbre", "Engrane"]
      };
      const result = await generateExecutiveSummary(operationalData);
      setSummary(result);
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black font-headline text-white tracking-tight">Panel Ejecutivo</h1>
          <p className="text-sm text-primary/60 font-medium">Estado General de la Operación</p>
        </div>
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <Bell className="w-5 h-5" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-2 border-l-4 border-secondary">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Satisfacción</p>
          <p className="text-3xl font-black font-headline text-white">98.4%</p>
          <p className="text-[10px] text-secondary font-bold">+2.1% vs mes anterior</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl space-y-2 border-l-4 border-tertiary">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Eficiencia IA</p>
          <p className="text-3xl font-black font-headline text-white">92.1%</p>
          <p className="text-[10px] text-tertiary font-bold">Validación automática</p>
        </div>
      </div>

      {summary && (
        <section className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-primary animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary fill-primary/20" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Resumen Ejecutivo IA</h3>
          </div>
          <p className="text-sm text-white/80 leading-relaxed italic">"{summary.summary}"</p>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Recomendaciones Estratégicas</p>
            <ul className="space-y-1">
              {summary.recommendations.map((rec: string, i: number) => (
                <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                  <span className="text-primary">•</span> {rec}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="glass-panel p-6 rounded-3xl space-y-6">
        <h3 className="text-xs font-bold text-primary/60 uppercase tracking-[0.2em]">Salud Operativa</h3>
        <div className="space-y-4">
          {[
            { label: "Servicios en curso", val: "42", color: "bg-secondary" },
            { label: "Alertas de Calidad", val: "3", color: "bg-error" },
            { label: "Insumos Críticos", val: "12", color: "bg-tertiary" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]", item.color === "bg-secondary" ? "text-secondary" : item.color === "bg-error" ? "text-error" : "text-tertiary", item.color)} />
                <span className="text-sm font-medium text-primary/80">{item.label}</span>
              </div>
              <span className="text-lg font-black font-headline text-white">{item.val}</span>
            </div>
          ))}
        </div>
      </section>

      <button 
        onClick={handleGenerateSummary}
        disabled={loading}
        className="w-full h-14 bg-gradient-to-r from-primary to-primary/60 rounded-2xl text-on-primary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Generar Reporte Mensual con IA"}
      </button>
    </div>
  );
};

function BottomNav({ role }: { role?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const navItems = [
    { icon: Home, label: "Inicio", path: "/", roles: ["ceo", "rh", "supervisor", "operator"] },
    { icon: ClipboardList, label: "Tareas", path: "/tasks", roles: ["supervisor", "operator"] },
    { icon: Package, label: "Insumos", path: "/inventory", roles: ["ceo", "supervisor"] },
    { icon: Star, label: "Puntos", path: "/points", roles: ["operator"] },
    { icon: User, label: "Perfil", path: "/profile", roles: ["ceo", "rh", "supervisor", "operator"] },
  ];

  const filteredItems = navItems.filter(item => !role || item.roles.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 w-full h-20 bg-surface-container/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-4 pb-4 z-50">
      {filteredItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-200 active:scale-90",
              isActive ? "text-secondary" : "text-primary/60"
            )}
          >
            <item.icon className={cn("w-6 h-6 mb-1", isActive && "fill-secondary/20")} />
            <span className="text-[10px] font-medium font-headline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Header() {
  return (
    <header className="fixed top-0 w-full h-16 bg-surface-container/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 z-50">
      <div className="flex items-center gap-2 text-xl font-black text-primary font-headline tracking-tight">
        <Menu className="w-6 h-6 text-primary" />
        <span>CleanFlow AI</span>
      </div>
      <div className="flex items-center gap-4">
        <Bell className="w-6 h-6 text-primary/60" />
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 overflow-hidden">
          <img src="https://picsum.photos/seed/user/100/100" alt="User" referrerPolicy="no-referrer" />
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background space-y-4">
      <Loader2 className="w-10 h-10 text-secondary animate-spin" />
      <p className="text-primary/40 font-bold uppercase tracking-widest text-xs">Sincronizando con la Nube...</p>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="*" element={
          user ? (
            <div className="min-h-screen bg-background text-white pb-24">
              <Header />
              <main className="pt-20 px-4 max-w-lg mx-auto">
                <Routes>
                  <Route path="/" element={
                    userData?.role === 'ceo' ? <CEODashboard /> : 
                    userData?.role === 'rh' ? <RHModule /> :
                    userData?.role === 'supervisor' ? <Tasks /> :
                    <OperatorHome userData={userData} />
                  } />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/points" element={<Points />} />
                  <Route path="/profile" element={<Profile userData={userData} />} />
                  <Route path="/ceo" element={<CEODashboard />} />
                  <Route path="/camera" element={<CameraCapture />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/rh" element={<RHModule />} />
                  <Route path="/client" element={<ClientPortal />} />
                </Routes>
              </main>
              <BottomNav role={userData?.role} />
            </div>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}
