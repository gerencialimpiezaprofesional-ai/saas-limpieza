import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Wallet, 
  TrendingUp, 
  Target, 
  Settings, 
  Plus, 
  Building2,
  DollarSign, 
  CreditCard, 
  Facebook, 
  Globe, 
  Rocket,
  Sparkles, 
  Loader2, 
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Database,
  Zap,
  Award,
  Star,
  X,
  Camera,
  Save
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { db, auth } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, setDoc, getDoc } from "firebase/firestore";
import { generateAIResponse } from "../services/gemini";

const ColossusLaunchChecklist = () => {
  const [steps, setSteps] = useState([
    { id: 1, label: "Configurar Stripe para LATAM", done: false, icon: Database },
    { id: 2, label: "Activar Alertas WhatsApp 'Modo Guerra'", done: true, icon: Zap },
    { id: 3, label: "Lanzar Campaña Blitz-Growth", done: false, icon: Rocket },
    { id: 4, label: "Llegar a los primeros 10 clientes", done: false, icon: Award },
  ]);

  const toggleStep = (id: number) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  return (
    <section className="glass-panel p-6 rounded-[2rem] space-y-4 border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-5 h-5 text-secondary" />
        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Checklist de Lanzamiento Colossus</h3>
      </div>
      <div className="space-y-3">
        {steps.map((step) => (
          <button 
            key={step.id} 
            onClick={() => toggleStep(step.id)}
            className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <step.icon className={cn("w-4 h-4", step.done ? "text-secondary" : "text-primary/40")} />
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", step.done ? "text-secondary line-through opacity-50" : "text-white/80")}>
                {step.label}
              </span>
            </div>
            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", step.done ? "bg-secondary border-secondary" : "border-white/20 group-hover:border-primary/40")}>
              {step.done && <Star className="w-2.5 h-2.5 text-on-secondary" fill="currentColor" />}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default function SuperAdminModule({ userData }: { userData: any }) {
  const [activeTab, setActiveTab] = useState<"billing" | "marketing" | "tenants" | "system">("billing");
  const [balance, setBalance] = useState(8.42); // Simulación de saldo en USD
  const [loading, setLoading] = useState(false);
  const [adHistory, setAdHistory] = useState<any[]>([]);
  const [targetCountry, setTargetCountry] = useState("México");
  const [tenants, setTenants] = useState<any[]>([]);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenantData, setNewTenantData] = useState({ name: "", plan: "Plan Estándar", contactEmail: "" });
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantData.name) {
      toast.error("El nombre del tenant es obligatorio");
      return;
    }
    setIsCreatingTenant(true);
    try {
      const tenantRef = await addDoc(collection(db, "tenants"), {
        name: newTenantData.name,
        plan: newTenantData.plan,
        contactEmail: newTenantData.contactEmail,
        status: 'active',
        createdAt: serverTimestamp(),
        budget: 0,
        warMode: false,
        aiStrictness: 'standard',
        rewards: []
      });

      // Auto-provision CEO profile if email provided
      if (newTenantData.contactEmail) {
        const ceoUid = `ceo_${tenantRef.id.slice(0, 8)}`; // Placeholder UID or handled by login later
        // We look for a doc with that email or create a placeholder
        // More robust: Add to a 'pending_setup' or just create the user doc by email
        await addDoc(collection(db, "users"), {
          email: newTenantData.contactEmail.toLowerCase(),
          name: `CEO ${newTenantData.name}`,
          role: 'ceo',
          tenantId: tenantRef.id,
          status: 'active',
          createdAt: serverTimestamp()
        });
      }
      
      toast.success(`Tenant ${newTenantData.name} creado. CEO pendiente de activación.`);
      setShowAddTenant(false);
      setNewTenantData({ name: "", plan: "Plan Estándar", contactEmail: "" });
    } catch (error: any) {
      toast.error("Error al crear tenant: " + error.message);
    } finally {
      setIsCreatingTenant(false);
    }
  };
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [newLogoUrl, setNewLogoUrl] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tenants"), (snap) => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const seedDemoData = async () => {
    if (!selectedTenant || !db) {
      toast.error("Seleccione un tenant primero");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Desplegando ecosistema demo completo...");
    try {
      const currentUid = auth.currentUser?.uid;
      const currentName = userData?.name || "Usuario Demo";
      const tenantId = selectedTenant.id;

      // 1. Create Diverse Demo Clients
      const clientNames = ["Corporativo Reforma 222", "Hospital Ángeles Pedregal", "Planta Industrial Engrane", "Cinepolis Mítikah", "Hotel Ritz CDMX", "Plaza Antara"];
      const clientIds = [];
      
      for (const name of clientNames) {
        const clientDoc = await addDoc(collection(db, "clients"), {
          name: name,
          tenantId,
          address: `Av. Ejercito Nacional ${Math.floor(Math.random() * 900)}, CDMX`,
          status: "active",
          type: name.includes("Hospital") ? "hospitality" : name.includes("Hotel") ? "hospitality" : "industrial",
          createdAt: serverTimestamp()
        });
        clientIds.push(clientDoc.id);
      }

      // 2. Create Diverse Roles in 'users'
      const mockUsers = [
        { role: 'supervisor', name: 'Carlos Vigilante', email: `supervisor.${Date.now()}@demo.ai`, points: 4500 },
        { role: 'operator', name: 'Julia Limpia', email: `ope1.${Date.now()}@demo.ai`, points: 1800 },
        { role: 'operator', name: 'Marcos Orden', email: `ope2.${Date.now()}@demo.ai`, points: 950 },
        { role: 'rh', name: 'Ana Talento', email: `rh.${Date.now()}@demo.ai`, points: 500 }
      ];

      for (const u of mockUsers) {
        const uid = `demo_${u.role}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, "users", uid), {
          uid,
          ...u,
          tenantId,
          clientId: clientIds[0],
          status: 'active',
          psychometricScore: 88,
          reliabilityScore: 95,
          createdAt: serverTimestamp()
        });
      }

      // 3. Create 'staff' for RH Module (Detailed records)
      const staffMembers = [
        { name: "Pedro Infante", role: "Supervisor", avgScore: 94, delays: 0, clientId: clientIds[0] },
        { name: "Maria Felix", role: "Operador", avgScore: 78, delays: 4, clientId: clientIds[1] },
        { name: "Jorge Negrete", role: "Operador", avgScore: 88, delays: 1, clientId: clientIds[2] },
        { name: "Dolores del Rio", role: "Operador", avgScore: 99, delays: 0, clientId: clientIds[3] },
        { name: "Cantinflas Moreno", role: "Operador", avgScore: 82, delays: 2, clientId: clientIds[4] }
      ];

      for (const member of staffMembers) {
        await addDoc(collection(db, "staff"), {
          tenantId,
          ...member,
          joinDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          phone: "+521234567890",
          status: 'active',
          tempPassword: "demo-password-123"
        });
      }

      // 4. Create 'candidates' for RH Module
      const candidates = [
        { name: "Roberto Gómez", role: "Operador", status: "testing", score: 85 },
        { name: "Lucía Méndez", role: "Operador", status: "interview", score: 92 },
        { name: "Juan Gabriel", role: "Supervisor", status: "background_check", score: 89 }
      ];
      for (const c of candidates) {
        await addDoc(collection(db, "candidates"), {
          tenantId,
          ...c,
          email: `${c.name.toLowerCase().replace(' ', '.')}@demo.com`,
          date: new Date().toISOString().split('T')[0],
          tests: { 
            psychometric: 'completed', 
            trust: c.status === 'testing' ? 'sent' : 'completed', 
            background: c.status === 'background_check' ? 'pending' : 'completed' 
          }
        });
      }

      // 5. Create 'inventory' (Supplies)
      const supplies = [
        { name: "Cloro Industrial", stock: 2, min: 10, unit: "Bidones", category: "Químicos" },
        { name: "Sanitizante Quirúrgico", stock: 12, min: 5, unit: "Litros", category: "Químicos" },
        { name: "Jabón de Manos", stock: 45, min: 20, unit: "Litros", category: "Higiene" },
        { name: "Toallas Interdobladas", stock: 5, min: 20, unit: "Cajas", category: "Papelería" },
        { name: "Bolsa Jumbo Negra", stock: 10, min: 15, unit: "Rollos", category: "Accesorios" }
      ];
      for (const s of supplies) {
        await addDoc(collection(db, "inventory"), {
          ...s,
          tenantId,
          lastRefill: serverTimestamp(),
          price: 150 + Math.random() * 300
        });
      }

      // 6. Create 'tasks' (OPERATIONS) - ASSIGNED TO CURRENT USER SO YOU CAN TEST IMMEDIATELY
      const taskPool = [
        { title: "Desinfección Quirófano A", area: "Piso 4 - Hospital", type: "deep", clientIdx: 1 },
        { title: "Limpieza de Cristales Lobby", area: "Entrada Principal - Corporativo", type: "standard", clientIdx: 0 },
        { title: "Pulido de Pisos Pasillo 2", area: "Planta Baja - Antara", type: "deep", clientIdx: 5 },
        { title: "Sanitización Baños Públicos", area: "Sector C - Mítikah", type: "recurring", clientIdx: 3 },
        { title: "Mantenimiento Áreas Comunes", area: "Lobby Principal", type: "standard", clientIdx: 0 },
        { title: "Limpieza profunda de Baños", area: "Nivel 2 - Corporativo", type: "standard", clientIdx: 0 }
      ];

      for (let i = 0; i < taskPool.length; i++) {
        const t = taskPool[i];
        const status = i < 2 ? "completed" : i < 4 ? "in_progress" : "pending";
        const score = status === "completed" ? 85 + Math.floor(Math.random() * 15) : null;
        
        await addDoc(collection(db, "tasks"), {
          title: t.title,
          areaName: t.area,
          clientName: clientNames[t.clientIdx],
          clientId: clientIds[t.clientIdx],
          tenantId,
          operatorId: currentUid || "demo_op_user",
          operatorName: currentName,
          status,
          score,
          aiNotes: status === "completed" ? "Validación IA exitosa. Superficies despejadas, sin residuos de polvo ni manchas visibles. Estándar de brillo cumplido." : null,
          createdAt: serverTimestamp(),
          completedAt: status === "completed" ? serverTimestamp() : null
        });
      }

      // 7. Create 'redemptions' (RH / Rewards Showcase)
      const mockRedemptions = [
        { userName: "Julia Limpia", rewardTitle: "Bono Despensa $500", points: 2000, status: 'pending' },
        { userName: "Marcos Orden", rewardTitle: "Tarjeta Regalo Amazon", points: 1500, status: 'approved' }
      ];
      for (const r of mockRedemptions) {
        await addDoc(collection(db, "redemptions"), {
          ...r,
          tenantId,
          userId: `demo_user_${Math.random().toString(36).substr(2, 5)}`,
          createdAt: serverTimestamp()
        });
      }

      // 8. Update 'tenants' settings (Showcase features)
      await updateDoc(doc(db, "tenants", tenantId), {
        aiStrictness: 'standard',
        warMode: false,
        active: true,
        updatedAt: serverTimestamp(),
        rewards: [
          { id: "r1", title: "Bono Despensa $500", pts: 2000, img: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400" },
          { id: "r2", title: "Día de Descanso Extra", pts: 5000, img: "https://images.unsplash.com/photo-1540555700478-4be289fbecee?auto=format&fit=crop&q=80&w=400" },
          { id: "r3", title: "Kit de Limpieza Pro", pts: 1000, img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400" }
        ]
      });

      // 9. Create 'kpis' for CEO Dashboard
      await setDoc(doc(db, "kpis", tenantId), {
        tenantId,
        efficiencyRate: 94.2,
        satisfactionIndex: 4.8,
        retentionRate: 98.7,
        aiAccuracy: 99.4,
        monthlyRevenue: 345800,
        completedTasks: 2150,
        pendingTasks: 38,
        operationalSafety: 99.9,
        updatedAt: serverTimestamp()
      });

      toast.success("🚀 ECOSISTEMA DEMO DESPLEGADO COMPLETO (CEO, RH, OPS, INV)", { id: toastId });
    } catch (e: any) {
      console.error("Seeding error:", e);
      toast.error(`Error al sembrar datos: ${e.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const updateTenantLogo = async () => {
    if (!selectedTenant || !newLogoUrl) return;
    try {
      await updateDoc(doc(db, "tenants", selectedTenant.id), {
        logo: newLogoUrl,
        updatedAt: serverTimestamp()
      });
      toast.success("Logo actualizado correctamente");
      setNewLogoUrl("");
      setSelectedTenant(null);
    } catch (e) {
      toast.error("Error al actualizar logo");
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await updateDoc(doc(db, "tenants", tenantId), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Tenant ${nextStatus === 'active' ? 'reactivado' : 'suspendido'} exitosamente`);
    } catch (e) {
      toast.error("Error al actualizar estado del tenant");
    }
  };

  // Mock global financial data
  const globalFinance = {
    totalRevenue: 124500.00,
    totalExpenses: 45200.00,
    activeTenants: 12,
    pendingPayments: 3
  };

  const LATAM_COUNTRIES = [
    { name: "México", terms: "Facility Managers, Directores de Operaciones", cities: "CDMX, Monterrey, Guadalajara" },
    { name: "Colombia", terms: "Administradores de Propiedad Horizontal, Jefes de SSG", cities: "Bogotá, Medellín, Cali" },
    { name: "Chile", terms: "Administradores de Edificios, Gerentes de Mantenimiento", cities: "Santiago, Valparaíso, Concepción" },
    { name: "Argentina", terms: "Gerentes de Servicios Generales, Administradores de Consorcios", cities: "Buenos Aires, Córdoba, Rosario" },
    { name: "Perú", terms: "Jefes de Mantenimiento, Administradores de Locales", cities: "Lima, Arequipa, Trujillo" }
  ];

  // 10 USD GLOBAL LIMIT
  const GLOBAL_LIMIT = 10;
  const usedAmount = 10 - balance;

  const handleAddFunds = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Procesando recarga de fondos para APIs...',
        success: () => {
          setBalance(prev => Math.min(prev + 5, GLOBAL_LIMIT));
          return 'Fondos añadidos exitosamente. APIs de Google/Firebase operativas.';
        },
        error: 'Error en la pasarela de pago.',
      }
    );
  };

  const generateMasterCampaign = async () => {
    setLoading(true);
    try {
      const countryData = LATAM_COUNTRIES.find(c => c.name === targetCountry) || LATAM_COUNTRIES[0];
      const prompt = `Actúa como un Master en Growth Marketing para SaaS. 
      Crea una estructura de campaña completa para promocionar "Impeccable AI" (ERP de Limpieza con IA).
      País Objetivo: ${countryData.name}.
      Segmentación Específica: Perfiles de ${countryData.terms} en ciudades principales como ${countryData.cities}.
      Crea 1 Campaña de Facebook Ads y 1 de Google Search.
      Incluye:
      1. Nombre de Campaña.
      2. 2 Grupos de Anuncios con segmentación detallada.
      3. Copys de anuncios adaptados al modismo y cultura de negocios de ${countryData.name}.
      4. Recomendación de presupuesto diario.
      Devuelve un JSON estructurado. Devuelve SOLO el JSON sin markdown.`;

      const text = await generateAIResponse(prompt, "Master en Growth Marketing para SaaS.", true);
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

      const data = JSON.parse(cleaned);
      setAdHistory(prev => [data, ...prev]);
      toast.success("Campaña Maestra generada y lista para despliegue");
    } catch (error: any) {
      console.error("Marketing error:", error);
      toast.error("Fallo al conectar con el motor de marketing: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      <header className="flex flex-col space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-error/20 rounded-xl flex items-center justify-center text-error border border-error/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black font-headline text-white tracking-tighter uppercase">GOD MODE / SUPER ADMIN</h1>
        </div>
        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.3em]">Control Global de Infraestructura y Crecimiento</p>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 overflow-x-auto scrollbar-hide">
        {[
          { id: "billing", label: "Finanzas Master", icon: Wallet },
          { id: "tenants", label: "Gestión Tenants", icon: Building2 },
          { id: "marketing", label: "Blitz Growth", icon: Rocket },
          { id: "system", label: "Core System", icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-w-[140px]",
              activeTab === tab.id ? "bg-secondary text-on-secondary shadow-lg" : "text-primary/60 hover:text-white"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "billing" && (
          <motion.div
            key="billing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <ColossusLaunchChecklist />

            {/* Global Budget Card */}
            <div className="glass-panel p-8 rounded-[2.5rem] border-2 border-secondary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-[100px] -mr-32 -mt-32 transition-all group-hover:scale-110" />
              
              <div className="relative space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">Fondeo Consolidado (Cloud/IA)</p>
                    <h2 className="text-6xl font-black font-headline text-white">${balance.toFixed(2)} <span className="text-xl text-primary/40">USD</span></h2>
                  </div>
                  <div className="p-4 bg-secondary/20 rounded-2xl border border-secondary/30">
                    <DollarSign className="w-8 h-8 text-secondary" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Gasto Mensual Global (Límite $10)</p>
                    <p className="text-sm font-black text-white">{((usedAmount/GLOBAL_LIMIT)*100).toFixed(1)}%</p>
                  </div>
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(usedAmount/GLOBAL_LIMIT)*100}%` }}
                      className={cn(
                        "h-full rounded-full transition-all",
                        usedAmount > 8 ? "bg-error" : "bg-gradient-to-r from-secondary to-tertiary"
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold text-primary/40 uppercase tracking-widest">
                    <span>$0 USD</span>
                    <span>Límite Crítico: $10.00 USD</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleAddFunds}
                    className="flex-1 h-14 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-5 h-5 shadow-inner" />
                    Añadir Fondos
                  </button>
                  <button className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center text-primary/60 border border-white/10">
                    <CreditCard className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Global Distribution Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-3xl space-y-4 border border-secondary/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest text-primary/60">Ingresos Totales (SaaS)</h3>
                  <TrendingUp className="w-4 h-4 text-secondary" />
                </div>
                <p className="text-4xl font-black font-headline text-white">${globalFinance.totalRevenue.toLocaleString()} <span className="text-xs text-primary/40">USD</span></p>
                <div className="flex items-center gap-2 text-secondary">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">+12.4% este mes</span>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-3xl space-y-4 border border-error/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest text-primary/60">Gastos Totales (OPEX)</h3>
                  <TrendingUp className="w-4 h-4 text-error rotate-180" />
                </div>
                <p className="text-4xl font-black font-headline text-white">${globalFinance.totalExpenses.toLocaleString()} <span className="text-xs text-primary/40">USD</span></p>
                <div className="flex items-center gap-2 text-error">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">Incluye Marketing & Cloud</span>
                </div>
              </div>
            </div>

            {/* Distribution Card */}
            <div className="glass-panel p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Distribución de Consumo</h3>
              <div className="space-y-4">
                {[
                  { label: "Gemini 1.5 Flash (IA Ops)", amount: 1.20, color: "bg-primary" },
                  { label: "Firebase Storage (Audit Images)", amount: 0.15, color: "bg-tertiary" },
                  { label: "Google Maps (Geoservices)", amount: 0.23, color: "bg-secondary" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", item.color)} />
                      <span className="text-xs font-bold text-primary/60 uppercase">{item.label}</span>
                    </div>
                    <span className="text-sm font-black text-white">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "marketing" && (
          <motion.div
            key="marketing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="glass-panel p-8 rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Growth Master IA</h3>
                  <p className="text-xs font-bold text-primary/60 uppercase">Estrategias de Autopromoción</p>
                </div>
              </div>

              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Crea campañas industriales para promocionar Impeccable ERP. Gemini configurará los grupos de anuncios, copys y segmentación con maestría.
              </p>

              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Seleccionar Mercado Objetivo</p>
                  <div className="flex flex-wrap gap-2">
                    {LATAM_COUNTRIES.map(country => (
                      <button
                        key={country.name}
                        onClick={() => setTargetCountry(country.name)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          targetCountry === country.name ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-primary/40"
                        )}
                      >
                        {country.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateMasterCampaign}
                  disabled={loading}
                  className="w-full h-16 bg-white text-black rounded-2xl font-black font-headline uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                  Lanzar Growth en {targetCountry}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-[10px] font-black text-primary/40 uppercase tracking-[.3em]">Cuentas Vinculadas</h4>
                <button className="text-secondary text-[10px] font-black uppercase underline">Vincular Nueva</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-3 border border-white/5">
                  <Facebook className="w-5 h-5 text-[#1877F2]" />
                  <div>
                    <p className="text-[10px] font-black text-white uppercase">Meta Ads</p>
                    <p className="text-[8px] text-secondary font-bold uppercase tracking-widest">Activa • ID: ...542</p>
                  </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-3 border border-white/5">
                  <Globe className="w-5 h-5 text-tertiary" />
                  <div>
                    <p className="text-[10px] font-black text-white uppercase">Google Ads</p>
                    <p className="text-[8px] text-secondary font-bold uppercase tracking-widest">Activa • ID: ...911</p>
                  </div>
                </div>
              </div>
            </div>

            {adHistory.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary/40 uppercase tracking-[.3em]">Estructuras Generadas</h4>
                {adHistory.map((item, idx) => (
                  <div key={idx} className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-secondary rounded-full animate-pulse" />
                        <span className="text-xs font-black text-white uppercase">Campaña: {item.campaignName || "Launch Colossus 2024"}</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-primary/40" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {Object.entries(item).filter(([k]) => k && (k.toString().includes('AdGroup') || k === 'adGroups' || k === 'meta' || k === 'google')).map(([key, val]: any, i) => (
                        <div key={i} className="bg-white/5 p-4 rounded-2xl space-y-3">
                          <div className="flex items-center gap-2 text-primary/60">
                            <Target className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase">{key}</span>
                          </div>
                          <div className="space-y-2">
                             {typeof val === 'string' ? (
                               <p className="text-xs text-white/80">{val}</p>
                             ) : (
                               <pre className="text-[10px] text-white/60 whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button className="w-full py-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-[10px] font-black uppercase tracking-widest">
                      Desplegar en Facebook & Google vía API
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

          {activeTab === "tenants" && (
            <motion.div
              key="tenants"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Logo Management Interface */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="glass-panel p-8 rounded-[2.5rem] space-y-6 border border-white/5 bg-surface-container/30">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Gestión de Tenants (God Mode)</h3>
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest mt-1">Sincronización de Identidad Visual</p>
                      </div>
                      <Camera className="w-5 h-5 text-secondary" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {tenants.map((tenant) => (
                        <div 
                          key={tenant.id} 
                          className={cn(
                            "p-4 rounded-2xl border transition-all flex items-center justify-between group",
                            selectedTenant?.id === tenant.id ? "bg-secondary/10 border-secondary" : "bg-white/5 border-white/5 hover:bg-white/10"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-black/40 rounded-xl flex items-center justify-center overflow-hidden border border-white/5 p-2 shadow-inner">
                               {tenant.logo ? (
                                 <img src={tenant.logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                               ) : (
                                 <Building2 className="w-6 h-6 text-primary/20" />
                               )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-white uppercase">{tenant.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[8px] px-1.5 py-0.5 bg-white/10 rounded text-primary/40 font-black uppercase">ID: {tenant.id}</span>
                                <span className={cn(
                                  "text-[8px] px-1.5 py-0.5 rounded font-black uppercase",
                                  tenant.status === 'suspended' ? "bg-error text-white" : "bg-secondary/10 text-secondary"
                                )}>
                                  {tenant.status || 'active'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setNewLogoUrl(tenant.logo || "");
                            }}
                            className={cn(
                              "p-3 rounded-xl transition-all",
                              selectedTenant?.id === tenant.id ? "bg-secondary text-on-secondary" : "bg-white/5 text-primary/40 group-hover:bg-white/20 group-hover:text-white"
                            )}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedTenant ? (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="glass-panel p-8 rounded-[2.5rem] border-2 border-secondary/20 bg-surface-container/40 space-y-8 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Sparkles className="w-32 h-32 text-secondary rotate-12" />
                      </div>
                      
                      <div className="flex items-center justify-between relative">
                         <h4 className="text-sm font-black text-white uppercase tracking-widest">Editor: {selectedTenant.name}</h4>
                         <button onClick={() => setSelectedTenant(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                           <X className="w-4 h-4" />
                         </button>
                      </div>

                      <div className="space-y-6 relative">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-secondary uppercase tracking-widest block px-1">URL Identidad (PNG/SVG)</label>
                          <input 
                            type="text" 
                            value={newLogoUrl}
                            onChange={(e) => setNewLogoUrl(e.target.value)}
                            placeholder="https://cloud.cdn/tenant-logo.png"
                            className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white font-mono text-xs focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all shadow-inner"
                          />
                        </div>
                        
                        <div className="aspect-square bg-black/40 rounded-3xl border border-white/5 flex flex-col items-center justify-center p-8 relative group">
                          <div className="absolute top-3 left-3 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
                             <span className="text-[8px] font-black text-white/20 uppercase">Previsualización Real-Time</span>
                          </div>
                          {newLogoUrl ? (
                            <img src={newLogoUrl} alt="" className="max-w-full max-h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="text-center space-y-3 opacity-10">
                              <Building2 className="w-12 h-12 mx-auto" />
                              <p className="text-[10px] font-black uppercase">Cargar Identidad</p>
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={updateTenantLogo}
                          className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-secondary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Rocket className="w-4 h-4" />
                          Desplegar Branding a Producción
                        </button>

                        <div className="pt-4 border-t border-white/5">
                          <button 
                            onClick={seedDemoData}
                            disabled={loading}
                            className="w-full h-12 bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2"
                          >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                            {loading ? "Desplegando..." : "Sembrar Datos Demo"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center text-center space-y-6 bg-white/5">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center ring-4 ring-white/5">
                      <Building2 className="w-10 h-10 text-white/10" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">Seleccionador de Operaciones</h4>
                      <p className="text-[10px] text-white/30 font-bold uppercase leading-relaxed max-w-[200px]">Seleccione un tenant para gestionar su jerarquía y branding corporativo.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Section (Original) */}
              <div className="space-y-4">
                <div className="flex flex-col space-y-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Esquemas de Suscripción (B2B)</h3>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">Psicología de precios aplicada para Latam (+ IVA)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { 
                      name: "Plan Esencial", 
                      price: "247", 
                      original: "249", 
                      features: ["Gestión Operativa", "Auditoría IA", "Reportes Básicos"],
                      storage: "30 días de retención",
                      color: "border-white/10"
                    },
                    { 
                      name: "Plan Estándar", 
                      price: "497", 
                      original: "499", 
                      features: ["Gamificación Total", "API de Mensajería", "Soporte Prioritario"],
                      storage: "90 días de retención",
                      color: "border-secondary/40 shadow-[0_0_20px_rgba(68,221,194,0.1)]",
                      popular: true
                    },
                    { 
                      name: "Plan Gold", 
                      price: "997", 
                      original: "999", 
                      features: ["Almacenamiento Premium", "Custom White-label", "Multi-Tenant Pro"],
                      storage: "365 días + Backup Premium",
                      color: "border-tertiary/40 shadow-[0_0_20px_rgba(255,167,38,0.1)]"
                    },
                  ].map((plan, i) => (
                    <div key={i} className={cn("glass-panel p-6 rounded-3xl flex flex-col space-y-6 relative border transition-all hover:scale-[1.02]", plan.color)}>
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-on-secondary px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                          Recomendado
                        </div>
                      )}
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">{plan.name}</h4>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-white">${plan.price}</span>
                          <span className="text-[10px] font-bold text-primary/40 uppercase">USD/mes</span>
                        </div>
                        <p className="text-[10px] text-error line-through font-bold decoration-2 opacity-50">${plan.original} USD</p>
                      </div>

                      <div className="space-y-3 flex-1">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-secondary" />
                            <span className="text-[10px] font-bold text-primary/60 uppercase">{f}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <Clock className="w-3 h-3 text-tertiary" />
                          <span className="text-[10px] font-black text-tertiary uppercase">{plan.storage}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedTenant({ name: plan.name }); // Contextual select
                          toast.success(`Iniciando configuración de suscripción: ${plan.name}`);
                        }}
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] hover:bg-white/10 transition-colors"
                      >
                        Configurar Plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Tenants Section */}
              <div className="glass-panel p-6 rounded-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Ecosistema de Tenants (SaaS Clients)</h3>
                  <button 
                    onClick={() => setShowAddTenant(true)}
                    className="text-[10px] font-black text-secondary uppercase bg-secondary/10 px-3 py-1.5 rounded-lg border border-secondary/20 transition-all hover:bg-secondary/20"
                  >
                    Agregar Tenant
                  </button>
                </div>

                <div className="space-y-4">
                  {tenants.map((tenant) => (
                    <div key={tenant.id} className={cn(
                      "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border transition-all gap-4",
                      tenant.status === 'suspended' ? "bg-error/5 border-error/20 grayscale-[0.5]" : "bg-white/5 border-white/10"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center font-black relative shadow-lg overflow-hidden",
                          tenant.status === 'suspended' ? "bg-error/20 text-error" : "bg-primary/20 text-primary"
                        )}>
                          {tenant.logo ? (
                            <img src={tenant.logo} className="w-full h-full object-contain p-2" alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-xl">{tenant.name ? tenant.name[0] : "?"}</span>
                          )}
                          {tenant.status === 'suspended' && (
                            <div className="absolute inset-0 bg-error/20 flex items-center justify-center backdrop-blur-[1px]">
                              <Lock className="w-5 h-5 text-error" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-white">{tenant.name || "Tenant Sin Nombre"}</p>
                            <span className={cn(
                              "text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                              tenant.status === 'suspended' ? "bg-error text-white" : "bg-secondary text-on-secondary"
                            )}>
                              {tenant.status || 'active'}
                            </span>
                          </div>
                          <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest leading-none mt-1">ID: {tenant.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black text-white uppercase font-headline tracking-tighter">{tenant.plan || "Plan Estándar"}</p>
                          <p className="text-[8px] text-primary/40 font-bold uppercase tracking-widest">Billing: 30D</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => toggleTenantStatus(tenant.id, tenant.status || 'active')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm active:scale-95",
                              tenant.status === 'suspended' ? "bg-secondary text-on-secondary border-secondary" : "bg-error/10 text-error border-error/20 hover:bg-error hover:text-white"
                            )}
                          >
                            {tenant.status === 'suspended' ? "Reactivar" : "Suspender"}
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setActiveTab("system");
                              toast.info(`Configurando sistema para ${tenant.name}`);
                            }}
                            className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/10 shadow-sm"
                          >
                            <Settings className="w-4 h-4 text-primary" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {tenants.length === 0 && (
                    <div className="py-12 text-center text-primary/40 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
                       No hay Tenants registrados en el Core
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "system" && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                  <div className="glass-panel p-8 rounded-[2.5rem] space-y-6 border border-white/5 text-center bg-surface-container/30 shadow-2xl">
                    <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-secondary/5 relative">
                      <Database className="w-10 h-10 text-secondary" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-secondary text-on-secondary rounded-full flex items-center justify-center text-[10px] font-black animate-bounce shadow-lg">IA</div>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Estatus de Núcleo</h3>
                      <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest mt-1">Infraestructura Colossus B2B</p>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                      {[
                        { label: "Uptime Firebase", val: "99.99%", status: "online" },
                        { label: "Latencia Gemini", val: "1.2s", status: "online" },
                        { label: "Capacidad Multi-Tenant", val: "10k READY", status: "online" }
                      ].map((stat, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-2xl border border-white/5 group hover:border-secondary/20 transition-all">
                          <span className="text-[10px] font-bold text-primary/60 uppercase">{stat.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-white">{stat.val}</span>
                            <div className={cn("w-2 h-2 rounded-full", stat.status === 'online' ? "bg-secondary animate-pulse" : "bg-error")} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-[2rem] border-l-4 border-secondary space-y-4 bg-secondary/5 group transition-all hover:bg-secondary/10">
                     <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-secondary" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Escalabilidad Validada</h4>
                     </div>
                     <p className="text-[10px] text-primary/60 font-medium leading-relaxed italic">
                       "Arquitectura serverless optimizada para 10,000 tenants y 100,000 usuarios concurrentes. Gemini Flash 1.5 procesando auditorías en paralelo."
                     </p>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-8 bg-surface-container/20 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none scale-150">
                      <Rocket className="w-64 h-64 text-white" />
                    </div>
                    
                    <div className="flex items-center justify-between relative">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Inspector de Jerarquías</h3>
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest mt-1">Validación de Lógica Multi-Tenant Interna</p>
                      </div>
                      <Lock className="w-8 h-8 text-secondary/40" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                       <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4 shadow-inner">
                          <div className="flex items-center gap-2 mb-2">
                             <Target className="w-4 h-4 text-tertiary" />
                             <p className="text-[10px] font-black text-white uppercase tracking-widest font-headline">Sectores de Operación Activos</p>
                          </div>
                          <div className="space-y-2">
                             {["Industrial Prime", "Sanidad Hospitalaria", "Mantenimiento Corporativo"].map((s, i) => (
                               <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:border-tertiary/20 transition-all">
                                  <span className="text-[10px] font-black text-primary/40 uppercase group-hover:text-white transition-colors">{s}</span>
                                  <CheckCircle2 className="w-3 h-3 text-secondary" />
                               </div>
                             ))}
                          </div>
                       </div>
                       <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4 shadow-inner">
                          <div className="flex items-center gap-2 mb-2">
                             <Clock className="w-4 h-4 text-secondary" />
                             <p className="text-[10px] font-black text-white uppercase tracking-widest font-headline">Logs Globales en Tiempo Real</p>
                          </div>
                          <div className="space-y-3 font-mono text-[8px]">
                             <div className="flex items-center gap-2 text-secondary/60">
                               <div className="w-1 h-1 bg-secondary rounded-full" />
                               <span>[{new Date().toLocaleTimeString()}] AUTH_TENANT_SUCCESS_v2</span>
                             </div>
                             <div className="flex items-center gap-2 text-secondary/60">
                               <div className="w-1 h-1 bg-secondary rounded-full" />
                               <span>[{new Date().toLocaleTimeString()}] PROVISION_ERP_LOGO_SYNC</span>
                             </div>
                             <div className="flex items-center gap-2 text-secondary/60">
                               <div className="w-1 h-1 bg-secondary rounded-full" />
                               <span>[{new Date().toLocaleTimeString()}] IA_AUDIT_STREAMING_ACTIVE</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="p-8 bg-secondary/5 rounded-[2rem] border border-secondary/20 border-dashed text-center space-y-4 relative group hover:bg-secondary/10 transition-all">
                       <Settings className="w-10 h-10 text-secondary/20 mx-auto animate-spin-slow" />
                       <div>
                         <h4 className="text-xs font-black text-white uppercase tracking-widest">Auditoría de Integridad Global</h4>
                         <p className="text-[10px] text-primary/40 font-bold uppercase max-w-md mx-auto mt-2 leading-relaxed">
                            La lógica multitenant garantiza aislamiento kryptográfico entre bases de datos. El acceso a este panel requiere token de Nivel 5.
                         </p>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-6 glass-panel rounded-3xl border border-error/30 bg-error/5 flex items-center justify-between group hover:bg-error/10 transition-all">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-error/60 uppercase tracking-widest">Estado Crítico</p>
                          <p className="text-xl font-black text-white uppercase tracking-tighter">Modo Guerra</p>
                       </div>
                       <button className="px-6 h-12 bg-error text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-error/20 active:scale-95 transition-all">
                          ACTIVAR GLOBAL
                       </button>
                    </div>
                    <div className="p-6 glass-panel rounded-3xl border border-secondary/30 bg-secondary/5 flex items-center justify-between group hover:bg-secondary/10 transition-all">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-secondary/60 uppercase tracking-widest">Sistema Operativo</p>
                          <p className="text-xl font-black text-white uppercase tracking-tighter">Producción OK</p>
                       </div>
                       <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20 ring-4 ring-secondary/5">
                          <Zap className="w-6 h-6" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Add Tenant Modal */}
      <AnimatePresence>
        {showAddTenant && (
          <div className="fixed inset-0 bg-background/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-8 relative my-auto border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowAddTenant(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary mx-auto border border-secondary/20">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Nuevo Tenant SaaS</h3>
                <p className="text-xs text-primary/60 font-medium">Registra una nueva empresa de limpieza</p>
              </div>

              <form onSubmit={handleCreateTenant} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Nombre Comercial</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Limpieza Pro Internacional"
                      value={newTenantData.name}
                      onChange={(e) => setNewTenantData({...newTenantData, name: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Email de Contacto CEO</label>
                    <input 
                      type="email" 
                      placeholder="ceo@empresa.com"
                      value={newTenantData.contactEmail}
                      onChange={(e) => setNewTenantData({...newTenantData, contactEmail: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Plan de Suscripción</label>
                    <select 
                      value={newTenantData.plan}
                      onChange={(e) => setNewTenantData({...newTenantData, plan: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                    >
                      <option value="Plan Básico">Plan Básico ($297/mo)</option>
                      <option value="Plan Estándar">Plan Estándar ($497/mo)</option>
                      <option value="Plan Gold">Plan Gold ($997/mo)</option>
                    </select>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isCreatingTenant}
                  className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(68,221,194,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isCreatingTenant ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <Save className="w-6 h-6" />
                      <span>Provisionar Tenant</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
