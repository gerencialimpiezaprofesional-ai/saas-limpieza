import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { Home, ClipboardList, Star, User, Bell, Menu, LogOut, ChevronRight, Award, ShieldCheck, Zap, Package, UserPlus, Camera, Loader2, Database, X, Building2, Rocket, ShieldAlert, Trash2, Gift, Trophy, Search, Command, Tablet } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./lib/utils";
import OperatorHome from "./components/OperatorHome";
import SupervisorHome from "./components/SupervisorHome";
import Tasks from "./components/Tasks";
import CameraCapture from "./components/CameraCapture";
import Inventory from "./components/Inventory";
import RHModule from "./components/RHModule";
import ClientPortal from "./components/ClientPortal";
import ClientManagement from "./components/ClientManagement";
import MarketingEngine from "./components/MarketingEngine";
import SuperAdminModule from "./components/SuperAdminModule";
import CertificateView from "./components/CertificateView";
import CheckIn from "./components/CheckIn";
import Achievements from "./components/Achievements";
import RedemptionStore from "./components/RedemptionStore";
import AuditForm from "./components/AuditForm";
import SecuritySettings from "./components/SecuritySettings";
import CEODashboard from "./components/CEODashboard";
import Profile from "./components/Profile";
import TotemModule from "./components/TotemModule";
import TotemTabletView from "./components/TotemTabletView";
import { useParams } from "react-router-dom";
import { seedDemoData } from "./services/seedService";
import { generateExecutiveSummary } from "./services/gemini";
import { sendDigitalCertificate } from "./services/messagingService";
import { Toaster, toast } from "sonner";

const Login = ({ 
  setIsSeeding, 
  seedStatus, 
  setSeedStatus,
  setUserData
}: { 
  setIsSeeding: (val: boolean) => void,
  seedStatus: string,
  setSeedStatus: (val: string) => void,
  setUserData: (val: UserData | null) => void
}) => {
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
    const loginEmail = email.trim().toLowerCase();
    const loginPassword = password;
    
    console.log(`[LOGIN] Intentando entrar con: ${loginEmail}`);
    
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      console.log("[LOGIN] Éxito.");
    } catch (err: any) {
      console.error("Login error full object:", err);
      const errorCode = err.code || "unknown";
      
      // AUTO-PROVISIÓN: Si es una cuenta demo y no existe, la creamos al vuelo
      const demoConfig: Record<string, Partial<UserData>> = {
        "ceo@impeccable.com": { role: 'ceo', name: "Elena Valdés" },
        "ceo-emmsa@impeccable.com": { role: 'ceo', name: "Elena (EMMSA)", clientId: "ave1" },
        "supervisor.limpiezaprofesional@gmail.com": { role: 'supervisor', name: "Sofía Pérez", clientId: "ave1" },
        "op.limpiezaprofesional@gmail.com": { role: 'operator', name: "Carlos Mendoza", clientId: "ave1" },
        "operador2@impeccable.com": { role: 'operator', name: "Ana López", clientId: "ave1" },
        "operador3@impeccable.com": { role: 'operator', name: "Miguel Ángel", clientId: "ave1" },
        "rh@impeccable.com": { role: 'rh', name: "Roberto Hernández" },
        "cliente@impeccable.com": { role: 'client', name: "Cliente Demo", clientId: "ave1" },
        "totem@impeccable.com": { role: 'totem', name: "Estación de Servicio Ave1", clientId: "ave1" }
      };
      
      if ((errorCode === "auth/user-not-found" || errorCode === "auth/invalid-credential" || errorCode === "auth/invalid-login-credentials") && demoConfig[loginEmail]) {
        try {
          console.log("[LOGIN] Cuenta demo no encontrada. Iniciando auto-provisión...");
          const toastId = toast.loading("Configurando acceso demo...");
          const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, "password123");
          
          // Crear documento Firestore
          const config = demoConfig[loginEmail];
          const newProfile: UserData = {
            uid: userCredential.user.uid,
            email: loginEmail,
            role: (config.role as any) || 'operator',
            name: config.name || "Usuario Demo",
            points: 0,
            status: 'active',
            tenantId: "impeccable-prod-001",
            clientId: config.clientId
          };
          
          await setDoc(doc(db, "users", userCredential.user.uid), newProfile);
          setUserData(newProfile);
          toast.success("Cuenta configurada. ¡Bienvenido!", { id: toastId });
          console.log("[LOGIN] Auto-provisión de Auth y Firestore completada.");
          return;
        } catch (provisionErr: any) {
          console.error("[LOGIN] Falló auto-provisión:", provisionErr);
          if (provisionErr.code === "auth/email-already-in-use") {
             setError("La cuenta existe pero la contraseña no coincide. Usa 'password123'.");
          } else {
             setError(`Error de configuración: ${provisionErr.message}`);
          }
        }
      }

      if (errorCode === "auth/user-not-found" || errorCode === "auth/invalid-credential" || errorCode === "auth/invalid-login-credentials") {
        if (loginEmail === "gerencia.limpiezaprofesional@gmail.com") {
          setError("Cuenta detectada. Debes usar el botón 'Entrar con Google' por seguridad.");
        } else {
          setError("No se pudo validar el acceso. Reintenta o pulsa otro botón demo.");
        }
      } else if (errorCode === "auth/wrong-password") {
        setError("Contraseña incorrecta. Usa: password123");
      } else if (errorCode === "auth/network-request-failed") {
        setError("Error de red: No se pudo conectar con los servidores. Revisa tu internet o intenta refrescar la página.");
      } else {
        setError(`Error: ${errorCode}`);
      }
    } finally {
      // GARANTÍA: Siempre quitamos el cargador, pase lo que pase
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log("[LOGIN] Éxito con Google.");
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setError("Error al entrar con Google. Verifica que las ventanas emergentes estén permitidas.");
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    setIsSeeding(true);
    setSeedStatus("Iniciando...");
    setError("");
    try {
      console.log("Iniciando proceso de creación de cuentas reales en Firebase...");
      const result = await seedDemoData((msg) => setSeedStatus(msg));
      console.log("Resultado del seed:", result);
      
      const userSummary = result.users.map((u: any) => `${u.email}: ${u.status}`).join("\n");
      const globalSummary = `Global: ${result.global}`;
      
      setSeedStatus("¡Completado!");
      toast.success("Datos demo inicializados con éxito");
    } catch (err: any) {
      console.error("Error crítico durante el seed:", err);
      const errorMsg = err.message || JSON.stringify(err);
      setError(`Error al inicializar: ${errorMsg}`);
      setSeedStatus("Error en el proceso");
      toast.error(`Error fatal al crear las cuentas: ${errorMsg}`);
    } finally {
      setSeeding(false);
      setIsSeeding(false);
      setTimeout(() => setSeedStatus(""), 3000);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 xs:p-8 space-y-8 animate-in fade-in duration-700 bg-background overflow-hidden">
      <div className="text-center space-y-2">
        <div className="w-20 h-20 bg-secondary/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-secondary/40 shadow-[0_0_40px_rgba(68,221,194,0.2)]">
          <ShieldCheck className="w-10 h-10 text-secondary" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-black font-headline tracking-tighter text-white uppercase">Impeccable AI</h1>
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
        
        <p className="text-[10px] text-primary/40 text-center font-bold uppercase tracking-widest">Pista: La contraseña es 'password123' (11 caracteres)</p>

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Entrar"}
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-primary/40 leading-none bg-background px-2">o bien</div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl text-white font-bold transition-all flex items-center justify-center gap-3 hover:bg-white/10 active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          <span>Entrar con Google</span>
        </button>
      </form>

      <div className="w-full max-w-sm space-y-3">
        <p className="text-[10px] text-primary/40 text-center font-bold uppercase tracking-widest">Acceso Rápido Demo</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "CEO (Elena)", email: "ceo@impeccable.com", isSpecial: true },
            { label: "Supervisor", email: "supervisor.limpiezaprofesional@gmail.com" },
            { label: "Op: Carlos", email: "op.limpiezaprofesional@gmail.com" },
            { label: "Op: Ana", email: "operador2@impeccable.com" },
            { label: "Op: Miguel", email: "operador3@impeccable.com" },
            { label: "Tótem IA", email: "totem@impeccable.com", isSpecial: true },
            { label: "Talento/RH", email: "rh@impeccable.com", isSpecial: true },
            { label: "Cliente Demo", email: "cliente@impeccable.com", isClient: true },
            { label: "God Mode", email: "gerencia.limpiezaprofesional@gmail.com", isGoogleOnly: true },
          ].map((demo) => (
            <button
              key={demo.email}
              type="button"
              onClick={() => {
                if (demo.isGoogleOnly) {
                  setError("Esta cuenta es VÍA GOOGLE únicamente. Usa el botón 'Entrar con Google'.");
                  toast.info("Usa el botón de Google para esta cuenta");
                  return;
                }
                setEmail(demo.email || "");
                setPassword("password123");
                toast.success(`Datos cargados: ${demo.label}`);
              }}
              className={cn(
                "h-10 border rounded-xl text-[10px] font-bold transition-all uppercase",
                demo.isSpecial 
                  ? "bg-secondary text-on-secondary border-secondary shadow-[0_0_15px_rgba(68,221,194,0.3)] hover:scale-105" 
                  : demo.isClient
                  ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                  : demo.isGoogleOnly
                  ? "bg-white/5 border-white/20 text-primary/40 cursor-help"
                  : "bg-white/5 border-white/10 text-primary/60 hover:text-secondary hover:border-secondary"
              )}
            >
              {demo.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm pt-4 border-t border-white/5">
        <button 
          onClick={handleSeed}
          disabled={seeding}
          className="w-full h-12 bg-white/5 border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-primary/60 hover:text-primary transition-all text-xs font-bold uppercase tracking-widest"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {seeding ? (seedStatus || "Creando...") : "Inicializar Datos Demo (IMPECCABLE)"}
        </button>
      </div>

      <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em] text-center">Powered by Impeccable AI v2.0</p>
    </div>
  );
};
interface UserData {
  uid: string;
  email: string;
  role: 'ceo' | 'rh' | 'supervisor' | 'operator' | 'client' | 'superadmin' | 'totem';
  name?: string;
  status?: string;
  tenantId?: string;
  clientId?: string;
  isInventoryManager?: boolean;
  lastSelfie?: string;
  points?: number;
}

function BottomNav({ userData }: { userData: UserData | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = userData?.role;
  
  const navItems = [
    { icon: ShieldAlert, label: "GOD MODE", path: "/superadmin", roles: ["superadmin"] },
    { icon: Home, label: "Inicio", path: "/", roles: ["ceo", "rh", "supervisor", "operator", "client", "superadmin", "totem"] },
    { icon: ClipboardList, label: "Tareas", path: "/tasks", roles: ["supervisor", "operator", "ceo"] },
    { icon: Trophy, label: "Comunidad", path: "/rewards", roles: ["operator", "supervisor"] },
    { 
      icon: Package, 
      label: "Insumos", 
      path: "/inventory", 
      roles: ["rh", "supervisor", "ceo"],
      condition: (u: any) => (u.role !== 'operator' || u.isInventoryManager === true)
    },
    { icon: User, label: "Perfil", path: "/profile", roles: ["ceo", "rh", "supervisor", "operator", "client", "superadmin", "totem"] },
  ];

  const filteredItems = navItems.filter(item => {
    if (!userData) return (item.roles || []).includes('operator'); // Default to operator view if no data yet
    const roleMatch = userData?.role ? (item.roles || []).includes(userData.role) : false;
    const conditionMatch = !item.condition || item.condition(userData);
    return roleMatch && conditionMatch;
  });

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-surface-container/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 z-50">
      {filteredItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-90",
              isActive ? "text-secondary" : "text-primary/60"
            )}
          >
            <item.icon className={cn("w-6 h-6 mb-1", isActive && "fill-secondary/20")} />
            <span className="text-[9px] font-bold font-headline uppercase tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Header({ userData }: { userData: UserData | null }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const isManagement = ["ceo", "rh", "superadmin"].includes(userData?.role || "");

  const quickActions = [
    { label: "Módulo RH", path: "/rh", keywords: ["rh", "empleados", "nomina", "contrato"] },
    { label: "Inventario", path: "/inventory", keywords: ["insumos", "stock", "pedidos"] },
    { label: "Marketing", path: "/marketing", keywords: ["publicidad", "ads", "crecimiento"] },
    { label: "Clientes", path: "/clients", keywords: ["cartera", "ventas", "empresas"] },
    { label: "Perfil", path: "/profile", keywords: ["mi cuenta", "ajustes"] },
    { label: "Seguridad", path: "/security", keywords: ["password", "2fa"] }
  ];

  const filteredActions = searchQuery ? quickActions.filter(a => 
    a.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.keywords.some(k => k.includes(searchQuery.toLowerCase()))
  ) : [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  useEffect(() => {
    if (!userData?.tenantId || !userData?.role) return;

    const q = query(
      collection(db, "notifications"),
      where("tenantId", "==", userData.tenantId),
      where("targetRoles", "array-contains", userData.role),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notes);
    });

    return () => unsubscribe();
  }, [userData?.tenantId, userData?.role]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full h-16 bg-surface-container/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-4 xs:px-6 z-[100] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-4 text-xl font-black text-primary font-headline tracking-tighter uppercase relative">
          <button onClick={() => setShowMenu(true)} className="flex items-center gap-3 hover:text-secondary transition-all group">
            <div className="p-2 bg-white/5 rounded-xl group-hover:bg-secondary/10 transition-colors">
              <Menu className="w-6 h-6" />
            </div>
            <span className="hidden lg:inline text-white">Impeccable <span className="text-secondary italic">AI</span></span>
          </button>

          {isManagement && (
            <div className="hidden md:flex relative ml-4">
              <div className={cn(
                "flex items-center gap-2 bg-white/5 border rounded-2xl px-4 py-2 transition-all w-64 lg:w-96",
                isSearchFocused ? "border-secondary/50 bg-white/10 ring-4 ring-secondary/5" : "border-white/10"
              )}>
                <Search className={cn("w-4 h-4 transition-colors", isSearchFocused ? "text-secondary" : "text-primary/40")} />
                <input 
                  id="global-search"
                  type="text"
                  placeholder="Buscar módulo o comando..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="bg-transparent border-none outline-none text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white w-full placeholder:text-primary/30"
                />
                <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded-md border border-white/10">
                   <Command className="w-2.5 h-2.5 text-primary/40" />
                   <span className="text-[8px] font-black text-primary/40">K</span>
                </div>
              </div>

              {/* Search Dropdown */}
              <AnimatePresence>
                {isSearchFocused && searchQuery && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 w-full mt-2 glass-panel p-2 rounded-2xl border border-white/10 shadow-2xl z-[110]"
                  >
                    {filteredActions.length > 0 ? (
                      filteredActions.map((action) => (
                        <button
                          key={action.path}
                          onClick={() => {
                            navigate(action.path);
                            setSearchQuery("");
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-secondary/10 rounded-xl transition-all group"
                        >
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{action.label}</span>
                          <ChevronRight className="w-4 h-4 text-primary/20 group-hover:text-secondary group-hover:translate-x-1 transition-all" />
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-[10px] font-bold text-primary/40 uppercase">No se encontraron resultados</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isManagement && (
            <div className="hidden lg:flex items-center gap-6 px-6 border-r border-white/5 mr-4 h-8">
               <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Sistemas OK</span>
                  </div>
                  <span className="text-[8px] text-primary/40 font-black uppercase tracking-tighter">Latencia 12ms</span>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-secondary tracking-[0.1em]">IMPECCABLE PRO</span>
                  <span className="text-[8px] text-primary/40 font-bold uppercase tracking-widest">IA v2.4.0</span>
               </div>
            </div>
          )}

          <div className="hidden xs:flex flex-col items-end mr-2">
            <span className="text-[10px] font-black text-white uppercase leading-none">{userData?.name || 'Usuario'}</span>
            <span className="text-[8px] font-bold text-primary/40 uppercase tracking-widest mt-1">{userData?.role || 'Visitante'}</span>
          </div>

          <div className="relative group">
            <button 
              className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 shadow-sm"
            >
              <Bell className="w-5 h-5 text-primary/60" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface-container shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
            </button>
            <div className="absolute top-full right-0 mt-3 w-80 glass-panel p-5 rounded-[2rem] shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-[60] border border-white/10 translate-y-2 group-hover:translate-y-0">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Notificaciones</h4>
                <button 
                  onClick={() => setNotifications([])}
                  className="text-[9px] font-black text-secondary uppercase tracking-widest hover:underline"
                >
                  Limpiar
                </button>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {notifications.length > 0 ? (
                  notifications.map((note) => (
                    <div key={note.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer">
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-2 h-2 mt-1.5 rounded-full shrink-0",
                          note.type === 'redemption' ? "bg-secondary shadow-[0_0_8px_rgba(68,221,194,0.4)]" : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        )} />
                        <div>
                          <p className="text-[10px] font-black text-white/90 leading-tight uppercase tracking-tight">{note.title}</p>
                          <p className="text-[9px] text-primary/60 leading-tight mt-0.5">{note.message}</p>
                          <p className="text-[7px] text-primary/30 font-bold uppercase mt-2">{new Date(note.createdAt?.seconds * 1000 || Date.now()).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center space-y-2 opacity-40">
                    <Bell className="w-8 h-8 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin alertas nuevas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-[1px] h-8 bg-white/10 mx-1 hidden xs:block" />

          <button 
            onClick={handleLogout}
            title="Cerrar Sesión"
            className="flex items-center gap-3 h-11 bg-error/10 hover:bg-error text-error hover:text-on-error rounded-xl transition-all group px-4 border border-error/20 font-headline shadow-lg active:scale-95"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden xs:inline text-[10px] font-black uppercase tracking-widest">Salir</span>
          </button>

          <button 
            onClick={() => navigate("/profile")}
            className="w-10 h-10 rounded-xl bg-primary/20 border border-secondary/40 overflow-hidden hover:scale-110 transition-all shadow-xl p-0.5 group"
          >
            <img 
              src={userData?.lastSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.email || 'user'}`} 
              alt="User" 
              referrerPolicy="no-referrer" 
              className="w-full h-full object-cover rounded-lg"
            />
          </button>
        </div>
      </header>

      {/* Sidebar Menu Overlay */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-surface-container z-[101] p-8 space-y-8 shadow-[20px_0_60px_rgba(0,0,0,0.5)] flex flex-col border-r border-white/5"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                  <h2 className="text-xl font-black font-headline text-white uppercase tracking-tighter">Panel de Control</h2>
                  <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Sistemas Impeccable AI</span>
                </div>
                <button onClick={() => setShowMenu(false)} className="p-2 bg-white/5 rounded-xl text-primary/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2 -mx-2 px-2">
                {[
                  { icon: ShieldAlert, label: "MODO SÚPER-DIOS", path: "/superadmin", roles: ["superadmin"] },
                  { icon: Home, label: "Tablero Principal", path: "/", roles: ["ceo", "rh", "supervisor", "operator", "client", "superadmin"] },
                  { icon: ClipboardList, label: "Bitácoras y Tareas", path: "/tasks", roles: ["supervisor", "operator", "ceo"] },
                  { icon: Rocket, label: "Motor de Crecimiento", path: "/marketing", roles: ["superadmin", "ceo"] },
                  { icon: Building2, label: "Cartera de Clientes", path: "/clients", roles: ["ceo"] },
                  { icon: Package, label: "Control de Insumos", path: "/inventory", roles: ["rh", "supervisor", "operator", "ceo"], condition: (u: any) => (u.role !== 'operator' || u.isInventoryManager === true) },
                  { icon: UserPlus, label: "Capital Humano", path: "/rh", roles: ["ceo", "rh", "superadmin"] },
                  { icon: ShieldCheck, label: "Validación Offline", path: "/checkin", roles: ["supervisor", "operator"] },
                  { icon: Tablet, label: "Terminal Público (Tótem)", path: "/totem", roles: ["supervisor", "superadmin", "totem"] },
                  { icon: Award, label: "Centro de Canje", path: "/rewards", roles: ["ceo", "superadmin"] },
                  { icon: User, label: "Configuración Perfil", path: "/profile", roles: ["ceo", "rh", "supervisor", "operator", "client", "superadmin"] },
                ].filter(item => {
                  if (!userData) return false;
                  // Restricciones estrictas de negocio
                  if (userData.role === 'client' && (item.path === '/inventory' || item.path === '/rh' || item.path === '/checkin')) return false;
                  if (userData.role === 'supervisor' && (item.path === '/rh' || item.path === '/marketing')) return false;
                  if (userData.role === 'operator' && (item.path === '/rh' || item.path === '/marketing' || item.path === '/clients')) return false;
                  
                  const roleMatch = userData?.role ? (item.roles || []).includes(userData.role) : false;
                  const conditionMatch = !item.condition || item.condition(userData);
                  
                  return roleMatch && conditionMatch;
                }).map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setShowMenu(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group relative overflow-hidden mb-1",
                        isActive ? "bg-primary text-on-primary shadow-lg" : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-on-primary" : "text-primary")} />
                      <span className={cn("text-xs font-black uppercase tracking-tighter", isActive ? "font-headline" : "font-medium")}>{item.label}</span>
                      {isActive && <motion.div layoutId="sidebar-active" className="absolute left-0 w-1 h-8 bg-secondary rounded-r-full" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-8 border-t border-white/5">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-error/10 text-error hover:bg-error transition-all font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Salir del Sistema</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function TotemTabletWrapper() {
  const { clientId } = useParams();
  return clientId ? <TotemTabletView clientId={clientId} /> : <Navigate to="/" />;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState("");

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AUTH] Estado cambiado:", firebaseUser?.email || "null");
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Listener en tiempo real para el documento del usuario
        unsubUser = onSnapshot(doc(db, "users", firebaseUser.uid), async (userDoc) => {
          const userEmail = firebaseUser.email?.toLowerCase();
          const demoConfig: Record<string, Partial<UserData>> = {
            "gerencia.limpiezaprofesional@gmail.com": { role: 'superadmin', name: "Super Administrador (Auto)", tenantId: "impeccable-prod-001" },
            "ceo@impeccable.com": { role: 'ceo', name: "Elena Valdés", tenantId: "impeccable-prod-001" },
            "ceo-emmsa@impeccable.com": { role: 'ceo', name: "Elena (EMMSA)", clientId: "ave1", tenantId: "impeccable-prod-001" },
            "supervisor.limpiezaprofesional@gmail.com": { role: 'supervisor', name: "Sofía Pérez", clientId: "ave1", tenantId: "impeccable-prod-001" },
            "op.limpiezaprofesional@gmail.com": { role: 'operator', name: "Carlos Mendoza", clientId: "ave1", tenantId: "impeccable-prod-001" },
            "operador2@impeccable.com": { role: 'operator', name: "Ana López", clientId: "ave1", tenantId: "impeccable-prod-001" },
            "operador3@impeccable.com": { role: 'operator', name: "Miguel Ángel", clientId: "ave1", tenantId: "impeccable-prod-001" },
            "rh@impeccable.com": { role: 'rh', name: "Roberto Hernández", tenantId: "impeccable-prod-001" },
            "cliente@impeccable.com": { role: 'client', name: "Cliente Demo", clientId: "ave1", tenantId: "impeccable-prod-001" },
            "totem@impeccable.com": { role: 'totem', name: "Estación de Servicio Ave1", clientId: "ave1", tenantId: "impeccable-prod-001" }
          };

          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            console.log(`[AUTH] Usuario cargado: ${userEmail} (Rol: ${data.role}, Client: ${data.clientId})`);
            
            // Check if demo user needs field updates (Auto-Heal) - Force clientId for Totem
            if (userEmail && demoConfig[userEmail]) {
              const config = demoConfig[userEmail];
              const needsUpdate = (config.clientId && data.clientId !== config.clientId) || (data.role !== config.role) || !data.tenantId || !data.email;
              
              if (needsUpdate) {
                console.log(`[AUTH] Actualizando perfil demo para ${userEmail}...`);
                const updatedProfile = {
                  ...data,
                  uid: firebaseUser.uid,
                  email: userEmail,
                  role: config.role as any || data.role,
                  name: data.name || config.name || userEmail.split('@')[0],
                  clientId: config.clientId || data.clientId || "none",
                  tenantId: data.tenantId || "impeccable-prod-001"
                };
                try {
                  await setDoc(doc(db, "users", firebaseUser.uid), updatedProfile);
                } catch (e) {
                  handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
                }
                setUserData(updatedProfile);
                setLoading(false);
                return;
              }

              // ENSURE CLIENT DOCUMENT EXISTS FOR TOTEM
              if (data.role === 'totem' && data.clientId && data.clientId !== 'none') {
                try {
                  const clientRef = doc(db, "clients", data.clientId);
                  const clientSnap = await getDoc(clientRef);
                  if (!clientSnap.exists()) {
                    console.log(`[AUTH] Auto-creando documento de cliente faltante: ${data.clientId}`);
                    await setDoc(clientRef, {
                      id: data.clientId,
                      name: `CLIENTE ${data.clientId.toUpperCase()}`,
                      address: "Ubicación Geográfica Detectada",
                      status: 'active',
                      tenantId: data.tenantId || "impeccable-prod-001",
                      createdAt: serverTimestamp()
                    });
                  }
                } catch (e) {
                  console.warn("[AUTH] No se pudo auto-sanar el documento de cliente:", e);
                }
              }
            }

            // Load tenant config if missing
            if (data.tenantId && !(data as any).tenantConfig) {
              try {
                // Try from server first to force connection check, or normal getDoc
                const tenantDoc = await getDoc(doc(db, "tenants", data.tenantId));
                if (tenantDoc.exists()) {
                  (data as any).tenantConfig = tenantDoc.data();
                }
              } catch (e: any) {
                console.error("[AUTH] Error al cargar tenantConfig:", e);
                if (e.message?.includes("offline")) {
                  toast.error("Error de conexión con Firestore", {
                    description: "Asegúrate de que 'VITE_FIREBASE_DATABASE_ID' sea '(default)' (con paréntesis) o el ID correcto de tu base de datos en el Firebase Console."
                  });
                }
              }
            }
            setUserData(data);
          } else {
            // Document doesn't exist
            if (userEmail && demoConfig[userEmail]) {
              const config = demoConfig[userEmail];
              const newProfile: UserData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || userEmail,
                role: (config.role as any) || 'operator',
                name: config.name || userEmail.split('@')[0],
                points: 0,
                status: 'active',
                tenantId: "impeccable-prod-001",
                clientId: config.clientId || "none"
              };
              try {
                await setDoc(doc(db, "users", firebaseUser.uid), newProfile, { merge: true });
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
              }
              setUserData(newProfile);
            } else {
              setUserData(null);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("[AUTH] Error en snapshot de usuario:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setUserData(null);
        if (unsubUser) unsubUser();
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Separate effect for navigation to avoid issues with navigate during auth state change
  useEffect(() => {
    if (userData && (userData.role === 'operator' || userData.role === 'supervisor') && userData.status !== 'active') {
      const path = window.location.pathname;
      if (path !== '/checkin' && path !== '/profile' && path !== '/' && path !== '/login') {
        // We allow the home page so they can click the big button
      }
    }
  }, [userData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background space-y-4">
      <Loader2 className="w-10 h-10 text-secondary animate-spin" />
      <p className="text-primary/40 font-bold uppercase tracking-widest text-xs">Sincronizando con la Nube...</p>
    </div>
  );

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors theme="dark" closeButton />
      <Routes>
        <Route path="/certificate/:id" element={<CertificateView />} />
        <Route path="/cert/:id" element={<CertificateView />} />
        <Route path="/tablet/:clientId" element={<TotemTabletWrapper />} />
        <Route path="/login" element={(!user || isSeeding) ? <Login setIsSeeding={setIsSeeding} seedStatus={seedStatus} setSeedStatus={setSeedStatus} setUserData={setUserData} /> : <Navigate to="/" />} />
        <Route path="*" element={
          user ? (
            <div className="min-h-[100dvh] bg-background text-white flex flex-col">
              <Header userData={userData} />
              <main className="flex-1 pt-20 pb-24 px-4 max-w-7xl mx-auto w-full overflow-x-hidden overflow-y-auto">
                <Routes>
                  <Route path="/" element={
                    !userData ? (
                      <div className="flex flex-col items-center justify-center p-10 space-y-6">
                        <Loader2 className="w-12 h-12 text-secondary animate-spin" />
                        <div className="text-center space-y-2">
                           <p className="text-primary/60 font-medium">Cargando perfil corporativo...</p>
                           <p className="text-[10px] text-primary/30 uppercase tracking-widest font-bold">Verificando credenciales en la nube</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button 
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-secondary text-on-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                          >
                            Refrescar Página
                          </button>
                          <button 
                            onClick={() => signOut(auth)}
                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-error transition-all"
                          >
                            Cerrar Sesión (Re-iniciar)
                          </button>
                        </div>
                      </div>
                    ) : (
                      userData.role === 'superadmin' ? <SuperAdminModule userData={userData} /> :
                      userData.role === 'ceo' ? <CEODashboard userData={userData} /> : 
                      userData.role === 'rh' ? <RHModule userData={userData} /> :
                      userData.role === 'supervisor' ? <SupervisorHome userData={userData} /> :
                      userData.role === 'client' ? <ClientPortal userData={userData} /> :
                      userData.role === 'totem' ? <Navigate to={`/tablet/${userData.clientId}`} /> :
                      <OperatorHome userData={userData} />
                    )
                  } />
                  
                  <Route path="/tasks" element={userData ? <Tasks userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/audit" element={userData?.role === 'supervisor' ? <AuditForm userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/checkin" element={(userData?.role === 'supervisor' || userData?.role === 'operator') ? <CheckIn userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/points" element={userData?.role === 'operator' ? <RedemptionStore userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/achievements" element={userData?.role === 'operator' ? <Achievements /> : <Navigate to="/" />} />
                  <Route path="/security" element={<SecuritySettings userData={userData} />} />
                  <Route path="/profile" element={<Profile userData={userData} />} />
                  <Route path="/ceo" element={(userData?.role === 'ceo' || userData?.role === 'superadmin') ? <CEODashboard userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/superadmin" element={userData?.role === 'superadmin' ? <SuperAdminModule userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/camera/:taskId?" element={(userData?.role === 'supervisor' || userData?.role === 'operator') ? <CameraCapture userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/inventory" element={userData ? <Inventory userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/rewards" element={(userData?.role === 'ceo' || userData?.role === 'superadmin' || userData?.role === 'operator') ? <RedemptionStore userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/rh" element={(userData?.role === 'rh' || userData?.role === 'ceo' || userData?.role === 'superadmin') ? <RHModule userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/clients" element={(userData?.role === 'superadmin' || userData?.role === 'ceo') ? <ClientManagement userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/marketing" element={(userData?.role === 'superadmin' || userData?.role === 'ceo') ? <MarketingEngine /> : <Navigate to="/" />} />
                  <Route path="/client" element={(userData?.role === 'client' || userData?.role === 'superadmin') ? <ClientPortal userData={userData} /> : <Navigate to="/" />} />
                  <Route path="/totem" element={(userData?.role === 'totem' || userData?.role === 'supervisor' || userData?.role === 'superadmin') ? <TotemModule userData={userData} /> : <Navigate to="/" />} />
                </Routes>
              </main>
              <BottomNav userData={userData} />
            </div>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}
