import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, ShieldCheck, Brain, FileText, Search, ChevronRight, CheckCircle2, XCircle, Loader2, X, MessageSquare, Award, Mail, Phone, Calendar, Clock, BarChart3, Fingerprint, Users, AlertTriangle, TrendingDown, MapPin, DollarSign, Calculator, History, Check, Gift, Download, Zap, Lock, BookOpen, Play, Activity, Award as AwardIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { getChurnPrediction } from "../services/gemini";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, orderBy, addDoc, deleteDoc } from "firebase/firestore";

interface Redemption {
  id: string;
  userId: string;
  userName: string;
  rewardId: string;
  rewardTitle: string;
  points: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  tenantId: string;
  createdAt: any;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'testing' | 'interview' | 'validated' | 'rejected';
  score: number;
  tests: {
    psychometric: 'pending' | 'sent' | 'completed' | 'failed';
    trust: 'pending' | 'sent' | 'completed' | 'failed';
    background: 'pending' | 'sent' | 'completed' | 'failed';
  };
  date: string;
  clientAssignment?: string;
  documents?: { name: string; status: 'uploaded' | 'pending' }[];
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  joinDate: string;
  avgScore: number;
  delays: number; // in the last 7 days
  clientId?: string;
  phone?: string;
  tempPassword?: string;
  churnRisk?: {
    score: number;
    level: string;
    reasoning: string;
    recommendations: string[];
  };
}

interface AttendanceEntry {
  id: string;
  employee_id: string;
  timestamp: string;
  source: string;
  checkin_method: string;
  evidence_url?: string;
  selfie_verified: boolean;
  geolocation_verified: boolean;
  status: string;
  body?: string;
  employeeName?: string;
}

const INITIAL_STAFF: StaffMember[] = [
  { id: "e1", name: "Carlos Ruiz", role: "Operador", joinDate: "2023-01-10", avgScore: 94, delays: 0, clientId: "c1" },
  { id: "e2", name: "Ana Martínez", role: "Operador", joinDate: "2023-05-15", avgScore: 78, delays: 4, clientId: "c2" },
  { id: "e3", name: "Juan Pérez", role: "Supervisor", joinDate: "2022-11-20", avgScore: 88, delays: 1, clientId: "c1" }
];

const INITIAL_CANDIDATES: Candidate[] = [
  { 
    id: "1", 
    name: "Roberto Gómez", 
    email: "roberto.g@email.com",
    role: "Operador", 
    status: "testing", 
    score: 85,
    tests: { psychometric: 'completed', trust: 'sent', background: 'completed' },
    date: "2024-04-20",
    documents: [{ name: "Identificación Oficial", status: "uploaded" }, { name: "Contrato Firmado", status: "pending" }]
  },
  { 
    id: "2", 
    name: "Lucía Méndez", 
    email: "lucia.m@email.com",
    role: "Supervisor", 
    status: "interview", 
    score: 92,
    tests: { psychometric: 'completed', trust: 'completed', background: 'completed' },
    date: "2024-04-18"
  },
  { 
    id: "3", 
    name: "Andrés Soto", 
    email: "andres.s@email.com",
    role: "Operador", 
    status: "validated", 
    score: 98,
    tests: { psychometric: 'completed', trust: 'completed', background: 'completed' },
    date: "2024-04-15",
    clientAssignment: "c1"
  },
];

const CLIENTS_LIST = [
  { id: "c1", name: "Corporativo Reforma" },
  { id: "c2", name: "Hospital Ángeles" },
  { id: "wildcard", name: "Comodín (Flexible)" },
];

export default function RHModule({ userData }: { userData?: any }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceEntry[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'candidates' | 'staff' | 'tests' | 'trust' | 'payroll' | 'alerts' | 'training' | 'attendance'>('staff');
  const [showCertificateGallery, setShowCertificateGallery] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<any | null>(null);

  useEffect(() => {
    if (!userData?.tenantId) return;

    const candidatesQuery = query(
      collection(db, "candidates"),
      where("tenantId", "==", userData.tenantId),
      orderBy("date", "desc")
    );

    const unsubscribeCandidates = onSnapshot(candidatesQuery, (snapshot) => {
      setCandidates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate)));
    });

    const staffQuery = query(
      collection(db, "staff"),
      where("tenantId", "==", userData.tenantId),
      orderBy("joinDate", "desc")
    );

    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember)));
    });

    const attQuery = query(
      collection(db, "attendance"),
      where("tenantId", "==", userData.tenantId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribeAttendance = onSnapshot(attQuery, (snapshot) => {
      setAttendanceLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry)));
    });

    const q = query(
      collection(db, "redemptions"),
      where("tenantId", "==", userData.tenantId),
      orderBy("createdAt", "desc")
    );

    const unsubscribeRedemptions = onSnapshot(q, (snapshot) => {
      const redemptionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Redemption[];
      setRedemptions(redemptionsData);
      setLoading(false);
    });

    const reqQuery = query(
      collection(db, "requisitions"),
      where("tenantId", "==", userData.tenantId),
      where("type", "==", "monthly_requisition"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeReqs = onSnapshot(reqQuery, (snapshot) => {
      setRequisitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeCandidates();
      unsubscribeStaff();
      unsubscribeRedemptions();
      unsubscribeReqs();
      unsubscribeAttendance();
    };
  }, [userData?.tenantId]);
  const [showPayrollDetails, setShowPayrollDetails] = useState(false);
  const [showTrustDetails, setShowTrustDetails] = useState<{title: string, content: string} | null>(null);
  const [showTestResultDetail, setShowTestResultDetail] = useState<{testName: string, candidateName: string, score: number, analysis: string} | null>(null);
  const [showDocumentView, setShowDocumentView] = useState<{title: string, type: 'credential' | 'contract'} | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const downloadDocument = async (type: 'credential' | 'contract', member: StaffMember) => {
    setLoading(true);
    const toastId = toast.loading(`Generando ${type === 'credential' ? 'Credencial Digital' : 'Contrato Laboral'}...`);
    
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      if (type === 'credential') {
        // Credential Design
        doc.setFillColor(68, 221, 194); // Primary color
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("IMPECCABLE AI - CREDENCIAL", 105, 25, { align: 'center' });
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text(`${member.name}`, 105, 60, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Puesto: ${member.role}`, 105, 70, { align: 'center' });
        doc.text(`ID Empleado: ${member.id}`, 105, 80, { align: 'center' });
        doc.text(`Fecha de Ingreso: ${member.joinDate}`, 105, 90, { align: 'center' });
        
        // Mock QR/Avatar area
        doc.setDrawColor(200, 200, 200);
        doc.rect(75, 100, 60, 60);
        doc.setFontSize(8);
        doc.text("VALIDADO CON IA IMPECCABLE", 105, 155, { align: 'center' });
        
        doc.save(`Credencial_${member.name.replace(/\s/g, '_')}.pdf`);
      } else {
        // Contract Design
        doc.setFontSize(18);
        doc.text("CONTRATO INDIVIDUAL DE TRABAJO", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        let y = 40;
        const text = `En la ciudad de México, a ${new Date().toLocaleDateString()}, se celebra el presente contrato entre IMPECCABLE AI (en adelante "El Patrón") y ${member.name} (en adelante "El Trabajador").\n\n` +
          `PRIMERA. PUESTO Y FUNCIONES: El trabajador se obliga a prestar sus servicios como ${member.role}, realizando las actividades inherentes a dicho cargo con la calidad exigida por los estándares de limpieza e higiene de la empresa.\n\n` +
          `SEGUNDA. DURACIÓN: El presente contrato es por tiempo indeterminado a partir de la fecha de firma.\n\n` +
          `TERCERA. JORNADA: La jornada de trabajo será la pactada según el rol asignado.\n\n` +
          `QUARTA. SALARIO: El trabajador percibirá el salario correspondiente a su categoría, pagadero de manera semanal.\n\n` +
          `QUINTA. CONFIDENCIALIDAD: El trabajador se obliga a mantener absoluta reserva sobre los procesos, clientes y tecnología de IMPECCABLE AI.\n\n` +
          `Leído que fue el presente contrato por las partes, lo firman de conformidad.`;
        
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 15, y);
        
        doc.text("__________________________", 50, 250);
        doc.text("FIRMA DEL TRABAJADOR", 50, 255);
        
        doc.text("__________________________", 130, 250);
        doc.text("FIRMA DEL PATRÓN", 130, 255);
        
        doc.save(`Contrato_${member.name.replace(/\s/g, '_')}.pdf`);
      }
      
      toast.success(`${type === 'credential' ? 'Credencial' : 'Contrato'} descargado con éxito`, { id: toastId });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el documento", { id: toastId });
    } finally {
      setLoading(false);
    }
  };



  const handleUpdateRedemptionStatus = async (redemptionId: string, newStatus: 'approved' | 'rejected' | 'applied') => {
    if (!redemptionId || !db) return;
    try {
      await updateDoc(doc(db, "redemptions", redemptionId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Canje actualizado a: ${newStatus === 'applied' ? 'Aplicado en Nómina' : newStatus === 'approved' ? 'Aprobado' : 'Rechazado'}`);
    } catch (error) {
      console.error("Error updating redemption:", error);
      toast.error("Error al actualizar el estado del canje.");
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [targetClient, setTargetClient] = useState("wildcard");

  const analyzeChurn = async (member: StaffMember) => {
    setAnalyzing(true);
    try {
      const prediction = await getChurnPrediction({
        name: member.name,
        role: member.role,
        avgScore: member.avgScore,
        delaysLastWeek: member.delays,
        antiquityMonths: 12
      });
      
      setStaff(prev => prev.map(s => 
        s.id === member.id ? { ...s, churnRisk: prediction } : s
      ));
      setSelectedStaff(prev => prev?.id === member.id ? { ...member, churnRisk: prediction } : prev);
      toast.success(`Análisis de retención completado para ${member.name}`);
    } catch (error) {
      toast.error("Error al realizar el análisis predictivo");
    } finally {
      setAnalyzing(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "operator",
    initiateTests: true,
    tests: {
      psychometric: true,
      trust: true,
      background: true
    }
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.tenantId) return;
    setLoading(true);
    
    try {
      const newCandidateData = {
        tenantId: userData.tenantId,
        name: formData.name,
        email: formData.email,
        role: formData.role === 'operator' ? 'Operador' : formData.role === 'supervisor' ? 'Supervisor' : 'Admin',
        status: formData.initiateTests ? 'testing' : 'pending',
        score: 0,
        tests: {
          psychometric: formData.tests.psychometric ? 'sent' : 'pending',
          trust: formData.tests.trust ? 'sent' : 'pending',
          background: formData.tests.background ? 'sent' : 'pending',
        },
        date: new Date().toISOString().split('T')[0],
        documents: [
          { name: "INE / Identificación", status: "pending" },
          { name: "Comprobante Domicilio", status: "pending" },
          { name: "Certificado Salud", status: "pending" }
        ]
      };

      await addDoc(collection(db, "candidates"), newCandidateData);
      
      setShowAddUser(false);
      setFormData({
        name: "",
        email: "",
        role: "operator",
        initiateTests: true,
        tests: { psychometric: true, trust: true, background: true }
      });
      
      if (formData.initiateTests) {
        toast.success(`Candidato ${formData.name} registrado. Pruebas enviadas correctamente.`);
      } else {
        toast.success(`Candidato ${formData.name} registrado con éxito.`);
      }
    } catch (error) {
      console.error("Error adding candidate:", error);
      toast.error("Error al registrar candidato.");
    } finally {
      setLoading(false);
    }
  };

  const validateCandidate = async (candidate: Candidate) => {
    if (!userData?.tenantId || !db || !candidate?.id) return;
    setLoading(true);
    try {
      const newMemberData = {
        tenantId: userData.tenantId,
        name: candidate.name,
        role: candidate.role,
        joinDate: new Date().toISOString().split('T')[0],
        avgScore: candidate.score || 100,
        delays: 0,
        clientId: targetClient
      };

      await addDoc(collection(db, "staff"), newMemberData);
      await deleteDoc(doc(db, "candidates", candidate.id));

      setSelectedCandidate(null);
      toast.success(`${candidate.name} ahora es parte de la plantilla. Credencial activa y contrato generado.`);
    } catch (error) {
      console.error("Error validating candidate:", error);
      toast.error("Error al validar candidato.");
    } finally {
      setLoading(false);
    }
  };

  const rejectCandidate = async (candidateId: string) => {
    if (!candidateId || !db) return;
    try {
      await updateDoc(doc(db, "candidates", candidateId), {
        status: 'rejected'
      });
      setSelectedCandidate(null);
      toast.error("Candidato rechazado. Se ha notificado vía automatización.");
    } catch (error) {
      toast.error("Error al rechazar candidato.");
    }
  };

  const startTest = async (candidateId: string, testType: keyof Candidate['tests']) => {
    if (!candidateId || !db) return;
    try {
      await updateDoc(doc(db, "candidates", candidateId), {
        status: 'testing',
        [`tests.${testType}`]: 'sent'
      });
      toast.info(`Prueba de ${testType === 'psychometric' ? 'Psicometría' : testType === 'trust' ? 'Confianza' : 'Antecedentes'} enviada.`);
    } catch (error) {
      toast.error("Error al iniciar prueba.");
    }
  };

  const filteredCandidates = candidates.filter(c => 
    (c.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
    (c.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <section className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Talento Impeccable</h1>
            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">Gestión de Personal y Plantilla Activa</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-6 h-12 bg-primary text-on-primary rounded-2xl font-black font-headline uppercase tracking-widest shadow-[0_0_30px_rgba(68,221,194,0.4)] hover:scale-105 active:scale-95 transition-all"
        >
          <UserPlus className="w-5 h-5" />
          <span className="text-xs">Nuevo Registro</span>
        </button>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-surface-container rounded-2xl border border-white/5 overflow-x-auto">
        {[
          { id: 'candidates', label: 'Candidatos', icon: FileText, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'staff', label: 'Plantilla', icon: Users, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'payroll', label: 'Prenómina', icon: Calculator, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'training', label: 'Entrenamiento', icon: BookOpen, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'alerts', label: 'Alertas IA', icon: Zap, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'attendance', label: 'Asistencia WhatsApp', icon: Clock, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'tests', label: 'Psicometría', icon: Brain, roles: ['ceo', 'superadmin', 'rh'] },
          { id: 'trust', label: 'Confianza', icon: ShieldCheck, roles: ['ceo', 'superadmin', 'rh'] },
        ].filter(tab => !tab.roles || tab.roles.includes(userData?.role || 'ceo')).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all min-w-fit",
              activeTab === tab.id ? "bg-primary text-on-primary shadow-lg" : "text-primary/40 hover:text-primary hover:bg-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.id === 'alerts' && requisitions.length > 0 && (
              <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'candidates' && (
        <section className="space-y-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, correo o puesto..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 bg-surface-container-low border border-white/5 rounded-2xl pl-12 pr-6 text-sm text-white focus:border-primary outline-none transition-all"
              />
            </div>
            <button className="w-14 h-14 bg-surface-container-low border border-white/5 rounded-2xl flex items-center justify-center text-primary/40 hover:text-primary transition-all">
              <BarChart3 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {filteredCandidates.map((candidate) => (
              <motion.div 
                layoutId={candidate.id}
                key={candidate.id} 
                onClick={() => setSelectedCandidate(candidate)}
                className="glass-panel p-5 rounded-3xl flex items-center justify-between group hover:bg-white/5 transition-all cursor-pointer border border-white/5 hover:border-primary/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-black text-lg border border-primary/10">
                    {candidate.name[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{candidate.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold text-primary/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">{candidate.role}</span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md",
                        candidate.status === 'validated' ? "bg-secondary/10 text-secondary" :
                        candidate.status === 'testing' ? "bg-tertiary/10 text-tertiary" :
                        "bg-white/5 text-primary/40"
                      )}>
                        {candidate.status === 'testing' ? 'En Pruebas' : 
                         candidate.status === 'validated' ? 'Validado' : 
                         candidate.status === 'interview' ? 'Entrevista' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden md:flex gap-2">
                    <div className={cn("w-2 h-2 rounded-full", candidate.tests.psychometric === 'completed' ? "bg-secondary" : candidate.tests.psychometric === 'sent' ? "bg-tertiary animate-pulse" : "bg-white/10")} title="Psicometría" />
                    <div className={cn("w-2 h-2 rounded-full", candidate.tests.trust === 'completed' ? "bg-secondary" : candidate.tests.trust === 'sent' ? "bg-tertiary animate-pulse" : "bg-white/10")} title="Confianza" />
                    <div className={cn("w-2 h-2 rounded-full", candidate.tests.background === 'completed' ? "bg-secondary" : candidate.tests.background === 'sent' ? "bg-tertiary animate-pulse" : "bg-white/10")} title="Antecedentes" />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black font-headline text-secondary tracking-tighter">{candidate.score > 0 ? `${candidate.score}%` : '--'}</p>
                    <p className="text-[8px] text-primary/40 uppercase font-black tracking-widest">Match IA</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'staff' && (
        <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* IA Quality Leaders Ranking */}
          <section className="bg-secondary/5 rounded-[2rem] p-6 border border-secondary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Award className="w-24 h-24 text-secondary rotate-12" />
            </div>
            <div className="flex items-center gap-3 mb-6 relative">
              <Zap className="w-5 h-5 text-secondary" />
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Rendimiento Éliti (IA Score)</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
              {staff
                .slice()
                .sort((a: any, b: any) => (b.avgScore || 0) - (a.avgScore || 0))
                .slice(0, 3)
                .map((leader, i) => (
                  <div key={leader.id} className="bg-surface-container-low/50 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-xl">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0",
                      i === 0 ? "bg-secondary text-on-secondary" : "bg-white/10 text-white/40"
                    )}>
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase truncate w-24">{leader.name}</p>
                      <p className="text-lg font-black text-secondary">{leader.avgScore || 0}%</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
              <input 
                type="text" 
                placeholder="Buscar empleados..." 
                className="w-full h-14 bg-surface-container-low border border-white/5 rounded-2xl pl-12 pr-6 text-sm text-white focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <h4 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] px-1">Colaboradores</h4>
              {staff.map((member) => (
                <div 
                  key={member.id}
                  onClick={() => setSelectedStaff(member)}
                  className={cn(
                    "p-4 rounded-3xl border transition-all cursor-pointer group",
                    selectedStaff?.id === member.id ? "bg-primary/10 border-primary/40" : "bg-white/5 border-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs">
                        {member.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white uppercase">{member.name}</p>
                        <p className="text-[8px] text-primary/40 font-bold uppercase">{member.role}</p>
                      </div>
                    </div>
                    {member.churnRisk && (
                      <div className={cn(
                        "w-2 h-2 rounded-full shadow-[0_0_8px]",
                        member.churnRisk.level === 'crítico' ? "bg-error shadow-error/50" :
                        member.churnRisk.level === 'alto' ? "bg-orange-500 shadow-orange-500/50" :
                        "bg-secondary shadow-secondary/50"
                      )} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="md:col-span-2">
              <AnimatePresence mode="wait">
                {selectedStaff ? (
                  <motion.div 
                    key={selectedStaff.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass-panel p-8 rounded-[2.5rem] border border-white/10 h-full space-y-8"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary font-black text-2xl">
                          {selectedStaff.name[0]}
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedStaff.name}</h3>
                          <p className="text-xs text-primary/40 font-bold uppercase tracking-widest">{selectedStaff.role} • Ingreso: {selectedStaff.joinDate}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => analyzeChurn(selectedStaff)}
                        disabled={analyzing}
                        className="flex items-center gap-2 px-6 h-12 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all disabled:opacity-50"
                      >
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4 text-secondary" />}
                        Analizar Retención IA
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Award className="w-3 h-3 text-secondary" />
                          <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">Score de Calidad</p>
                        </div>
                        <p className="text-xl font-black text-white">{selectedStaff.avgScore}%</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-3 h-3 text-primary/40" />
                          <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">Destino</p>
                        </div>
                        <p className="text-xl font-black text-white uppercase tracking-tighter">
                          {CLIENTS_LIST.find(c => c.id === selectedStaff.clientId)?.name || "Sin Asignar"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em] border-b border-white/5 pb-2">Expediente Digital</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div 
                          onClick={() => setShowDocumentView({ title: 'Credencial Digital Impeccable', type: 'credential' })}
                          className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 group hover:border-secondary/30 transition-all cursor-pointer"
                        >
                          <Fingerprint className="w-6 h-6 text-secondary" />
                          <div>
                            <p className="text-[10px] font-black text-white uppercase">Credencial Digital</p>
                            <p className="text-[8px] text-primary/40 font-bold uppercase">Código QR Activo</p>
                          </div>
                        </div>
                        <div 
                          onClick={() => setShowDocumentView({ title: 'Contrato Laboral Impeccable', type: 'contract' })}
                          className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 group hover:border-secondary/30 transition-all cursor-pointer"
                        >
                          <FileText className="w-6 h-6 text-secondary" />
                          <div>
                            <p className="text-[10px] font-black text-white uppercase">Contrato Laboral</p>
                            <p className="text-[8px] text-primary/40 font-bold uppercase">Vigente • PDF</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em] border-b border-white/5 pb-2">Credenciales y Soporte</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Contraseña Inicial</p>
                              <Lock className="w-3 h-3 text-secondary" />
                           </div>
                           <div className="flex items-center justify-between">
                              <p className="text-sm font-mono text-white bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                                {selectedStaff.tempPassword || "password123"}
                              </p>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedStaff.tempPassword || "password123");
                                  toast.success("Copiado al portapapeles");
                                }}
                                className="text-[10px] text-secondary font-black uppercase"
                              >
                                Copiar
                              </button>
                           </div>
                        </div>
                        <div className="flex gap-2 h-full">
                           <a 
                             href={`https://wa.me/${selectedStaff.phone || '521'}?text=Hola%20${selectedStaff.name},%20tus%20credenciales%20para%20Impeccable%20son:%20Usuario:%20${selectedStaff.id}%20Pass:%20${selectedStaff.tempPassword || 'password123'}`}
                             target="_blank"
                             rel="noreferrer"
                             className="flex-1 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-[#25D366]/20 transition-all group"
                           >
                              <MessageSquare className="w-5 h-5 text-[#25D366]" />
                              <span className="text-[8px] font-black text-white uppercase tracking-widest">WhatsApp</span>
                           </a>
                           <a 
                             href={`sms:${selectedStaff.phone || ''}?body=Hola%20${selectedStaff.name},%20tus%20credenciales%20Impeccable:%20Pass:%20${selectedStaff.tempPassword || 'password123'}`}
                             className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all"
                           >
                              <Phone className="w-5 h-5 text-secondary" />
                              <span className="text-[8px] font-black text-white uppercase tracking-widest">SMS</span>
                           </a>
                        </div>
                      </div>
                    </div>

                    {selectedStaff.churnRisk && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "p-6 rounded-3xl border-l-4 space-y-4",
                          selectedStaff.churnRisk.level === 'crítico' || selectedStaff.churnRisk.level === 'alto' 
                            ? "bg-error/5 border-error" : "bg-secondary/5 border-secondary"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <TrendingDown className={cn("w-4 h-4", selectedStaff.churnRisk.score > 50 ? "text-error" : "text-secondary")} />
                            <h4 className="text-xs font-black text-white uppercase tracking-widest">Predicción de Deserción</h4>
                          </div>
                          <span className={cn(
                            "text-sm font-black font-headline uppercase",
                            selectedStaff.churnRisk.score > 50 ? "text-error" : "text-secondary"
                          )}>
                            Riesgo: {selectedStaff.churnRisk.score}%
                          </span>
                        </div>
                        <p className="text-xs text-primary/70 leading-relaxed italic">
                          "{selectedStaff.churnRisk.reasoning}"
                        </p>
                        <div className="space-y-2">
                          <p className="text-[8px] font-black text-primary/40 uppercase tracking-widest">Recomendaciones de Retención</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedStaff.churnRisk.recommendations.map((rec, i) => (
                              <span key={i} className="text-[9px] font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-white/80">
                                • {rec}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-primary/20 space-y-4 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                    <Users className="w-12 h-12" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Selecciona un colaborador para analizar</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'payroll' && (
        <section className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border-l-4 border-secondary flex items-center justify-between shadow-xl">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Prenómina Operativa</h3>
                  <p className="text-xs text-primary/60 font-medium tracking-tight">Cierre de Periodo: Quincena 2 - Mayo 2024</p>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-right">
                      <p className="text-xs font-bold text-primary/40 uppercase tracking-widest">Total Beneficios</p>
                      <p className="text-2xl font-black font-headline text-secondary tracking-tighter">
                        ${redemptions.filter(r => r.status === 'approved').reduce((acc, r) => acc + (r.points / 100), 0).toFixed(2)}
                      </p>
                   </div>
                   <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
                      <Calculator className="w-6 h-6" />
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Canjes Pendientes de Validación</h4>
                  <span className="text-[10px] text-tertiary bg-tertiary/10 px-2 py-1 rounded-lg border border-tertiary/20 uppercase font-bold">
                    {redemptions.filter(r => r.status === 'pending').length} Pendientes
                  </span>
                </div>

                <div className="space-y-3">
                  {redemptions.length > 0 ? (
                    redemptions.map((redemption) => (
                      <div key={redemption.id} className="glass-panel p-5 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border",
                            redemption.status === 'pending' ? "bg-tertiary/10 border-tertiary/20 text-tertiary" :
                            redemption.status === 'approved' ? "bg-secondary/10 border-secondary/20 text-secondary" :
                            redemption.status === 'applied' ? "bg-primary/10 border-primary/20 text-primary" :
                            "bg-error/10 border-error/20 text-error"
                          )}>
                            {redemption.status === 'pending' ? <Clock className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{redemption.userName}</h4>
                            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest mt-0.5">
                              {redemption.rewardTitle} • {redemption.points} Puntos
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {redemption.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleUpdateRedemptionStatus(redemption.id, 'rejected')}
                                className="w-10 h-10 rounded-xl bg-error/10 text-error hover:bg-error hover:text-on-error transition-all flex items-center justify-center border border-error/20"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleUpdateRedemptionStatus(redemption.id, 'approved')}
                                className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary hover:text-on-secondary transition-all flex items-center justify-center border border-secondary/20"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {redemption.status === 'approved' && (
                            <button 
                              onClick={() => handleUpdateRedemptionStatus(redemption.id, 'applied')}
                              className="px-4 h-10 rounded-xl bg-primary text-on-primary font-black font-headline text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg"
                            >
                              <Check className="w-4 h-4" />
                              Aplicar en Nómina
                            </button>
                          )}
                          {redemption.status === 'applied' && (
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                              Aplicado ✅
                            </span>
                          )}
                          {redemption.status === 'rejected' && (
                            <span className="text-[10px] font-black text-error uppercase tracking-widest bg-error/10 px-3 py-1.5 rounded-lg border border-error/20">
                              Rechazado ❌
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 glass-panel rounded-[2rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center space-y-4">
                      <History className="w-12 h-12 text-primary/20" />
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-tight">No hay canjes registrados</p>
                        <p className="text-[10px] text-primary/40 font-medium">Los canjes de operadores aparecerán aquí para validación.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-container-low rounded-3xl border border-white/5 space-y-4">
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em] border-b border-white/5 pb-2">Canjes de Puntos en Periodo</h4>
            <div className="space-y-3">
              {redemptions.length > 0 ? (
                redemptions.map((redemption) => (
                  <div key={redemption.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                       <Gift className="w-4 h-4 text-secondary" />
                       <div>
                         <p className="text-xs font-black text-white uppercase">{redemption.userName}</p>
                         <p className="text-[9px] text-primary/40 font-bold uppercase">{redemption.rewardTitle} • {redemption.points} pts</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={cn(
                         "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded",
                         redemption.status === 'applied' ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"
                       )}>
                         {redemption.status === 'applied' ? 'Aplicado' : 'Pendiente'}
                       </span>
                       <p className="text-xs font-black font-headline text-white">${(redemption.points/100).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-[10px] text-primary/40 font-bold uppercase">No hay canjes en este periodo</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
                <h4 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] px-1">Resumen de Plantilla</h4>
                <div className="space-y-3">
                  {staff.slice(0, 5).map(member => (
                    <div key={member.id} className="p-3 bg-white/5 rounded-2xl flex items-center justify-between border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">
                          {member.name[0]}
                        </div>
                        <p className="text-xs font-black text-white uppercase tracking-tighter line-clamp-1">{member.name}</p>
                      </div>
                      <p className="text-xs font-black font-headline text-secondary">${(Math.random() * 500 + 1500).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setShowPayrollDetails(true)}
                  className="w-full h-12 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black text-primary/60 uppercase tracking-widest transition-all border border-white/5"
                >
                  Ver Detalles de Nómina
                </button>
              </div>

              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-primary/10 to-transparent">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-black text-white uppercase tracking-tight">IA Payroll Insight</h4>
                </div>
                <p className="text-[10px] text-primary/60 leading-relaxed font-medium">
                  El sistema detectó un incremento del 12% en bonos por puntualidad este periodo. 
                  Se recomienda programar el desembolso para el viernes 24 de Mayo.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'training' && (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-end px-1">
             <div className="space-y-1">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Academia Impeccable</h3>
                <p className="text-white text-sm font-black uppercase tracking-tight">Cursos y Capacitación Certificada</p>
             </div>
             <button className="h-10 px-4 bg-tertiary text-on-secondary rounded-xl text-[10px] font-black uppercase tracking-widest">+ Crear Curso</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 't1', title: 'Técnicas de Desinfectado Quirúrgico', duration: '45 min', difficulty: 'Avanzado', progress: 85, icon: ShieldCheck },
              { id: 't2', title: 'Seguridad en el Manejo de Químicos', duration: '30 min', difficulty: 'Básico', progress: 100, icon: AlertTriangle },
              { id: 't3', title: 'Atención al Cliente y Protocolo Estelar', duration: '20 min', difficulty: 'Intermedio', progress: 40, icon: MessageSquare },
              { id: 't4', title: 'Ergonomía y Cuidado Postural', duration: '15 min', difficulty: 'Básico', progress: 0, icon: Activity }
            ].map((course) => (
              <div key={course.id} className="glass-panel p-6 rounded-[2rem] border border-white/5 space-y-4 hover:border-secondary transition-all group">
                <div className="flex justify-between items-start">
                   <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", 
                     course.progress === 100 ? "bg-secondary/10 text-secondary" : "bg-white/5 text-white/40"
                   )}>
                      <course.icon className="w-6 h-6" />
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black uppercase tracking-widest text-primary/40">{course.difficulty}</span>
                      <span className="text-[8px] font-bold text-white/20">{course.duration}</span>
                   </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-black text-white uppercase leading-tight group-hover:text-secondary transition-colors">{course.title}</h4>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                      <span className="text-primary/40">Progreso Global</span>
                      <span className="text-white">{course.progress}%</span>
                   </div>
                   <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${course.progress}%` }}
                        className={cn("h-full", course.progress === 100 ? "bg-secondary shadow-[0_0_10px_#44DDC2]" : "bg-primary")}
                      />
                   </div>
                </div>

                <button className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                  <Play className="w-3 h-3 text-secondary" />
                  {course.progress === 0 ? "Empezar" : course.progress === 100 ? "Repasar" : "Continuar"}
                </button>
              </div>
            ))}
          </div>

          <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-primary/5 to-transparent">
             <div className="w-20 h-20 bg-secondary/10 rounded-[2rem] flex items-center justify-center text-secondary shrink-0 border border-secondary/20 shadow-2xl">
                <AwardIcon className="w-10 h-10" />
             </div>
             <div className="flex-1 space-y-2 text-center md:text-left">
                <h4 className="text-xl font-headline font-black text-white uppercase tracking-tight">Certificación Impeccable Excellence</h4>
                <p className="text-xs text-primary/60 font-medium leading-relaxed">
                  Tus colaboradores reciben certificados automáticos firmados por IA al completar el 100% de la academia. 
                  Esto eleva el valor de tu servicio ante clientes corporativos.
                </p>
             </div>
             <button 
                onClick={() => setShowCertificateGallery(true)}
                className="h-14 px-8 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
             >
                Ver Certificados
             </button>
          </div>

          <AnimatePresence>
            {showCertificateGallery && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex flex-col p-6 overflow-y-auto"
              >
                <div className="max-w-6xl mx-auto w-full space-y-8">
                  <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
                         <AwardIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Galería de Certificaciones IA</h3>
                        <p className="text-[10px] text-secondary font-bold uppercase tracking-widest leading-none">Validadas por Impeccable Excellence</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowCertificateGallery(false)}
                      className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[
                      { id: 'c1', name: 'Carlos Ruiz', course: 'Desinfectado Quirúrgico Avanzado', date: '28 Abril 2024', hash: 'CF-992384-HQ' },
                      { id: 'c2', name: 'Ana Martínez', course: 'Seguridad Química y Biológica', date: '25 Abril 2024', hash: 'CF-882731-SQ' },
                      { id: 'c3', name: 'Juan Pérez', course: 'Protocolo Estelar de Atención', date: '20 Abril 2024', hash: 'CF-771239-PE' },
                      { id: 'c4', name: 'Rosa Elena', course: 'Ergonomía y Salud Ocupacional', date: '15 Abril 2024', hash: 'CF-661283-ES' },
                    ].map((cert) => (
                      <motion.div 
                        key={cert.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -10 }}
                        onClick={() => setSelectedCertificate(cert)}
                        className="relative group cursor-pointer"
                      >
                         {/* Certificate Card Mini */}
                         <div className="aspect-[1.4/1] bg-white rounded-lg p-6 shadow-2xl border-4 border-double border-primary/20 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
                            <div className="absolute inset-0 border-8 border-primary/5 opacity-50"></div>
                            <AwardIcon className="w-12 h-12 text-primary opacity-20" />
                            <div className="space-y-1">
                               <h5 className="text-[10px] font-bold text-black uppercase tracking-tighter">{cert.name}</h5>
                               <p className="text-[7px] text-gray-500 font-medium leading-none">{cert.course}</p>
                            </div>
                            <div className="pt-4 border-t border-gray-100 w-full">
                               <p className="text-[6px] text-gray-300 font-mono">{cert.hash}</p>
                            </div>

                            <div className="absolute inset-0 bg-secondary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                               <p className="text-on-secondary text-[10px] font-black uppercase tracking-widest">Ampliar Certificado</p>
                            </div>
                         </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Empty Slate for new certs */}
                  <div className="h-64 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-primary/10">
                     <BookOpen className="w-12 h-12 mb-4" />
                     <p className="text-[10px] font-black uppercase tracking-widest">Los nuevos certificados aparecerán aquí</p>
                  </div>
                </div>

                {/* Expanded View */}
                <AnimatePresence>
                  {selectedCertificate && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90"
                      onClick={() => setSelectedCertificate(null)}
                    >
                      <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
                        <div className="bg-white rounded-sm p-12 shadow-[0_0_100px_rgba(68,221,194,0.3)] border-[12px] border-double border-[#D4AF37]/30 relative overflow-hidden text-black font-serif">
                           {/* Decorative background elements */}
                           <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full -mr-32 -mt-32"></div>
                           <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full -ml-32 -mb-32"></div>
                           
                           {/* Content */}
                           <div className="relative z-10 space-y-12 text-center">
                              <div className="flex flex-col items-center gap-4">
                                 <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                                   <AwardIcon className="w-12 h-12 text-primary" />
                                 </div>
                                 <div className="space-y-1">
                                    <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-[#2C3E50]">Certificado de Logro</h2>
                                    <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.4em] ml-2">Impeccable AI Academy</p>
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <p className="text-lg italic text-[#7F8C8D]">Este documento certifica que</p>
                                 <h1 className="text-5xl font-black text-[#2C3E50] underline decoration-[#D4AF37] underline-offset-8 uppercase tracking-tight">{selectedCertificate.name}</h1>
                                 <p className="text-lg italic text-[#7F8C8D]">ha completado satisfactoriamente el curso de formación técnica:</p>
                                 <h3 className="text-2xl font-bold text-primary uppercase tracking-wide">{selectedCertificate.course}</h3>
                              </div>

                              <div className="grid grid-cols-2 gap-20 pt-12">
                                 <div className="space-y-2 border-t border-[#D4AF37]/20 pt-4">
                                    <p className="text-xs font-bold text-[#2C3E50] uppercase tracking-widest">Director General</p>
                                    <p className="text-[10px] text-gray-400 italic">Impeccable Professional AI</p>
                                 </div>
                                 <div className="space-y-2 border-t border-[#D4AF37]/20 pt-4 relative">
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-30">
                                       <ShieldCheck className="w-20 h-20 text-secondary" />
                                    </div>
                                    <p className="text-xs font-bold text-[#2C3E50] uppercase tracking-widest">Auditor de IA</p>
                                    <p className="text-[10px] text-gray-400 italic">Validación Blockchain</p>
                                 </div>
                              </div>

                              <div className="pt-8 flex justify-between items-end border-t border-gray-100">
                                 <div className="text-left space-y-1">
                                    <p className="text-[8px] font-bold text-gray-300 uppercase">ID de Certificación</p>
                                    <p className="text-[10px] font-mono text-gray-500">{selectedCertificate.hash}</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[8px] font-bold text-gray-300 uppercase">Emitido el</p>
                                    <p className="text-[10px] font-bold text-[#2C3E50]">{selectedCertificate.date}</p>
                                 </div>
                              </div>
                           </div>

                           {/* Seal */}
                           <div className="absolute top-12 right-12 w-24 h-24 rotate-12 opacity-80 pointer-events-none">
                              <svg viewBox="0 0 100 100" className="w-full h-full text-[#D4AF37]">
                                 <path id="circlePath" d="M 20, 50 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0" fill="none" />
                                 <text className="text-[8px] font-black uppercase fill-current">
                                    <textPath href="#circlePath">ESTÁNDAR DE EXCELENCIA IMPECCABLE • </textPath>
                                 </text>
                                 <circle cx="50" cy="50" r="22" className="fill-current opacity-10" />
                                 <AwardIcon className="x-50 y-50 w-8 h-8 fill-current" />
                              </svg>
                           </div>
                        </div>

                        <div className="mt-8 flex justify-center gap-4">
                           <button 
                             onClick={() => setSelectedCertificate(null)}
                             className="h-12 px-8 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                           >
                              Cerrar
                           </button>
                           <button 
                             className="h-12 px-8 bg-secondary text-on-secondary rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-2"
                             onClick={() => toast.success("Iniciando descarga de certificado de alta resolución...")}
                           >
                              <Download className="w-4 h-4" />
                              Descargar PDF
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {activeTab === 'alerts' && (
        <section className="space-y-6 animate-in fade-in duration-500">
           <div className="flex items-center gap-4 bg-error/5 p-6 rounded-3xl border border-error/20">
              <div className="w-12 h-12 bg-error/20 rounded-2xl flex items-center justify-center text-error border border-error/20">
                 <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                 <h2 className="text-xl font-black text-white uppercase">Requisiciones Críticas RH</h2>
                 <p className="text-[10px] text-error/60 font-bold uppercase tracking-widest">Solicitudes Mensuales de Insumos vía Supervisores</p>
              </div>
           </div>

           <div className="space-y-4">
              {requisitions.length > 0 ? (
                requisitions.map((req) => (
                  <div key={req.id} className="glass-panel p-6 rounded-[2rem] border border-white/5 space-y-4">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-surface-container rounded-xl flex items-center justify-center">
                              <History className="w-6 h-6 text-primary/40" />
                           </div>
                           <div>
                              <h4 className="text-sm font-black text-white uppercase">{req.supervisorName || 'Supervisor'}</h4>
                              <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">Sucursal: {req.clientName || 'General'}</p>
                           </div>
                        </div>
                        <span className="px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[8px] font-black uppercase">Mensual</span>
                     </div>
                     
                     <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-primary/40 uppercase mb-2">Lista de Insumos</p>
                        <div className="grid grid-cols-2 gap-2">
                           {req.items?.map((item: any, i: number) => (
                             <div key={i} className="flex justify-between text-[10px] text-white/80">
                                <span>{item.name}</span>
                                <span className="font-bold">{item.quantity} {item.unit}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     <div className="flex gap-3">
                        <button 
                          onClick={() => toast.success("Orden capturada y enviada a compras")}
                          className="flex-1 h-12 bg-secondary text-on-secondary rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all"
                        >
                          Aprobar y Enviar a Compras
                        </button>
                        <button className="px-4 h-12 bg-white/5 border border-white/10 rounded-xl text-primary/40 hover:text-white transition-all">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-primary/20 space-y-4 border-2 border-dashed border-white/5 rounded-[3rem]">
                   <CheckCircle2 className="w-12 h-12" />
                   <p className="text-[10px] font-black uppercase tracking-widest">No hay requisiciones pendientes para este mes</p>
                </div>
              )}
           </div>
        </section>
      )}

      {activeTab === 'attendance' && (
        <section className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center gap-4 bg-primary/5 p-6 rounded-3xl border border-primary/20">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Logs de Asistencia OpenClaw</h2>
              <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">Validación de Check-ins vía WhatsApp e IA</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1 space-y-4">
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-2">
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Total Check-ins Hoy</p>
                <p className="text-3xl font-black text-white font-headline">{attendanceLogs.length}</p>
                <div className="flex items-center gap-2 text-secondary text-[10px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>Sincronizado con ERP</span>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-2">
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Selfies Validadas</p>
                <p className="text-3xl font-black text-secondary font-headline">100%</p>
              </div>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Timeline de Recién Llegados</h4>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span className="text-[8px] font-black text-secondary uppercase tracking-widest">Live Monitoring</span>
                </div>
              </div>

              {attendanceLogs.length > 0 ? (
                <div className="space-y-3">
                  {attendanceLogs.map((log) => (
                    <div key={log.id} className="glass-panel p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/5 transition-all">
                      <div className="flex items-center gap-4">
                        {log.evidence_url ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 ring-2 ring-secondary/20">
                            <img src={log.evidence_url} alt="Selfie" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-primary/40 italic text-[8px] font-bold">
                            NODATA
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">
                              {staff.find(s => s.id === log.employee_id)?.name || log.employee_id}
                            </h4>
                            <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                              {log.source}
                            </span>
                          </div>
                          <p className="text-[9px] text-primary/40 font-bold uppercase tracking-widest mt-1">
                            {new Date(log.timestamp).toLocaleString()} • {log.checkin_method}
                          </p>
                          {log.body && (
                            <p className="text-[10px] text-white/60 italic mt-1 font-medium">"{log.body}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <ShieldCheck className="w-3 h-3 text-secondary" />
                            <span className="text-[8px] font-black text-secondary uppercase">Verified</span>
                          </div>
                          <p className="text-[10px] font-black text-white uppercase">{log.status}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary/20 group-hover:bg-secondary/10 group-hover:text-secondary transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                   <Users className="w-12 h-12 mx-auto text-primary/10" />
                   <p className="text-[10px] font-black text-primary/20 uppercase tracking-widest">No se han recibido check-ins en las últimas 24 horas</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'tests' && (
        <section className="space-y-6">
          <div className="glass-panel p-8 rounded-[2rem] border-l-4 border-secondary space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="flex items-center gap-3 relative">
              <Brain className="w-6 h-6 text-secondary" />
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                {selectedCandidate ? `Psicometría: ${selectedCandidate.name}` : "Batería de Pruebas IA"}
              </h3>
            </div>
            <p className="text-sm text-primary/60 leading-relaxed max-w-md relative">
              {selectedCandidate 
                ? `Análisis detallado de aptitudes y perfiles conductuales para ${selectedCandidate.name}.` 
                : "Nuestra IA analiza patrones de respuesta, tiempos de reacción y consistencia para determinar estabilidad emocional y aptitud operativa."}
            </p>
            {!selectedCandidate && (
              <div className="grid grid-cols-2 gap-4 relative">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Pruebas Enviadas</p>
                  <p className="text-3xl font-black font-headline text-white">{candidates.filter(c => c.tests?.psychometric !== 'pending').length}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Completadas</p>
                  <p className="text-3xl font-black font-headline text-secondary">{candidates.filter(c => c.tests?.psychometric === 'completed').length}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] px-1">
              {selectedCandidate ? "Resultados de Pruebas" : "Clasificación por Candidato"}
            </h4>
            
            {selectedCandidate ? (
              // Individual candidate tests
              <div className="space-y-3">
                {[
                  { name: "Estabilidad Emocional", score: (selectedCandidate.score || 85) - 5, analysis: "Presenta una alta capacidad de control emocional bajo presión. Apto para entornos de alta demanda." },
                  { name: "Honestidad y Valores", score: Math.min(100, (selectedCandidate.score || 85) + 5), analysis: "Resultados sobresalientes en la escala de integridad. Alineado con los valores corporativos." },
                  { name: "Aptitud Operativa", score: selectedCandidate.score || 85, analysis: "Demuestra comprensión clara de los protocolos de limpieza y seguridad operativa." }
                ].map((test, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      setShowTestResultDetail({
                        testName: test.name,
                        candidateName: selectedCandidate.name,
                        score: test.score,
                        analysis: test.analysis
                      });
                    }}
                    className="flex items-center justify-between p-5 bg-surface-container-low rounded-3xl border border-white/5 hover:border-secondary/20 hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">{test.name}</p>
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">IA Evaluator • Completado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="text-sm font-black text-secondary">{test.score}%</span>
                       <ChevronRight className="w-4 h-4 text-primary/40" />
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setSelectedCandidate(null)}
                  className="w-full py-4 text-[10px] font-black text-primary/40 uppercase tracking-widest hover:text-primary transition-all"
                >
                  Regresar a la lista completa
                </button>
              </div>
            ) : (
              // Grouped Candidates
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                <input 
                  type="text" 
                  placeholder="Filtrar candidatos por nombre..." 
                  className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl pl-10 pr-4 text-xs text-white focus:border-primary outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button className="px-4 h-12 glass-panel rounded-2xl text-[10px] font-black uppercase text-secondary">Aptos</button>
                <button className="px-4 h-12 glass-panel rounded-2xl text-[10px] font-black uppercase text-error/60">No Aptos</button>
              </div>
            </div>

            {candidates.length > 0 ? (
              candidates.filter(c => (c.name?.toLowerCase() || "").includes(searchQuery.toLowerCase())).map((candidate) => (
                <div 
                  key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={cn(
                        "flex items-center justify-between p-5 bg-surface-container-low rounded-3xl border border-white/5 hover:border-primary/20 hover:bg-white/5 cursor-pointer transition-all",
                        candidate.tests?.psychometric === 'pending' && "opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black uppercase text-lg",
                          candidate.tests?.psychometric === 'completed' ? "bg-secondary text-on-secondary shadow-[0_0_15px_rgba(68,221,194,0.3)]" : "bg-white/5 text-primary"
                        )}>
                          {candidate.name[0]}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{candidate.name}</h4>
                          <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">
                            {candidate.role} • {candidate.tests?.psychometric === 'completed' ? 'Resultados Listos' : 'Pruebas en Espera'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {candidate.tests?.psychometric === 'completed' ? (
                          <div className="text-right">
                            <p className="text-lg font-black font-headline text-secondary tracking-tighter">{candidate.score || 85}%</p>
                            <p className="text-[8px] text-primary/40 uppercase font-black tracking-widest">Match Promedio</p>
                          </div>
                        ) : (
                          <div className="px-3 py-1 bg-tertiary/10 text-tertiary text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">
                            Pendiente
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-primary/40" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-primary/20 space-y-4 rounded-[2.5rem] border-2 border-dashed border-white/5">
                    <Brain className="w-12 h-12 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No hay candidatos registrados</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'trust' && (
        <section className="space-y-6">
          <div className="glass-panel p-8 rounded-[2rem] border-l-4 border-error space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-error/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="flex items-center gap-3 relative">
              <ShieldCheck className="w-6 h-6 text-error" />
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                {selectedCandidate ? `Validación: ${selectedCandidate.name}` : "Filtros de Confianza"}
              </h3>
            </div>
            <p className="text-sm text-primary/60 leading-relaxed max-w-md relative">
              {selectedCandidate 
                ? `Estatus de filtros de seguridad para ${selectedCandidate.name}.`
                : "Validación exhaustiva de antecedentes, referencias y pruebas de integridad mediante análisis biométrico y de micro-expresiones."}
            </p>
          </div>

          <div className="space-y-4">
            {(selectedCandidate ? [
              { type: "Antecedentes Penales", candidateId: selectedCandidate.id, status: selectedCandidate.tests?.background === 'completed' ? "Validado" : "Pendiente", icon: CheckCircle2, color: selectedCandidate.tests?.background === 'completed' ? "text-secondary" : "text-error", desc: "Verificación de antecedentes criminales y registros legales." },
              { type: "Referencias Laborales", candidateId: selectedCandidate.id, status: "Verificado", icon: CheckCircle2, color: "text-secondary", desc: "Confirmación de historial laboral con 3 empleadores previos." },
              { type: "Prueba de Integridad", candidateId: selectedCandidate.id, status: selectedCandidate.tests?.trust === 'completed' ? "Apto" : "Pendiente", icon: ShieldCheck, color: selectedCandidate.tests?.trust === 'completed' ? "text-secondary" : "text-error", desc: "Análisis de lealtad y valores institucionales." },
            ] : [
              { type: "Antecedentes Penales", candidateId: "1", status: "Validado", icon: CheckCircle2, color: "text-secondary", desc: "Sin registros negativos en bases de datos nacionales." },
              { type: "Referencias Laborales", candidateId: "2", status: "En Proceso", icon: Loader2, color: "text-primary", desc: "Contactando a empleadores previos para validación de desempeño." },
              { type: "Prueba de Integridad", candidateId: "3", status: "Pendiente", icon: XCircle, color: "text-error", desc: "Evaluación de honestidad y ética profesional pendiente." },
            ]).map((filter, i) => (
              <div 
                key={i} 
                onClick={() => {
                  if (filter.type === "Referencias Laborales") {
                    setShowTrustDetails({ title: filter.type, content: "Ref 1: Excelente desempeño en limpieza industrial.\nRef 2: Muy puntual y responsable.\nRef 3: Recomendado ampliamente." });
                  } else if (filter.type === "Antecedentes Penales") {
                    setShowTrustDetails({ title: filter.type, content: "Búsqueda en bases de datos estatales y federales: 0 resultados.\nNo presenta mandamientos judiciales pendientes." });
                  } else {
                    setSelectedCandidate(candidates.find(c => c.id === filter.candidateId) || null);
                  }
                }}
                className="p-6 bg-surface-container-low rounded-3xl border border-white/5 space-y-3 hover:border-primary/20 hover:bg-white/5 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/5", filter.color)}>
                      <filter.icon className={cn("w-5 h-5", filter.icon === Loader2 && "animate-spin")} />
                    </div>
                    <span className="text-sm font-black text-white uppercase tracking-tight">{filter.type}</span>
                  </div>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/5", filter.color)}>
                    {filter.status}
                  </span>
                </div>
                <p className="text-xs text-primary/40 font-medium leading-relaxed">{filter.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-8 relative my-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
            >
              <button 
                onClick={() => setShowAddUser(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto border border-primary/20">
                  <UserPlus className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Nuevo Candidato</h3>
                <p className="text-xs text-primary/60 font-medium">Inicia el proceso de reclutamiento IA de alta precisión</p>
              </div>

              <form onSubmit={handleAddUser} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Información Básica</label>
                    <div className="space-y-3">
                      <div className="relative">
                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                        <input 
                          type="text" 
                          placeholder="Nombre Completo"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-12 text-white text-sm focus:border-primary outline-none transition-all"
                          required
                        />
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                        <input 
                          type="email" 
                          placeholder="Correo Electrónico"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-12 text-white text-sm focus:border-primary outline-none transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Puesto Asignado</label>
                    <select 
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-4 text-white text-sm focus:border-primary outline-none appearance-none transition-all"
                    >
                      <option value="operator">Operador de Limpieza</option>
                      <option value="supervisor">Supervisor de Zona</option>
                      <option value="admin">Administrativo</option>
                    </select>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">Iniciar Pruebas IA</label>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, initiateTests: !formData.initiateTests})}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          formData.initiateTests ? "bg-primary" : "bg-white/10"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          formData.initiateTests ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {formData.initiateTests && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          {[
                            { id: 'psychometric', label: 'Batería Psicométrica', icon: Brain },
                            { id: 'trust', label: 'Prueba de Confianza', icon: ShieldCheck },
                            { id: 'background', label: 'Antecedentes Penales', icon: FileText },
                          ].map((test) => (
                            <button
                              key={test.id}
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                tests: { ...formData.tests, [test.id]: !formData.tests[test.id as keyof typeof formData.tests] }
                              })}
                              className={cn(
                                "w-full p-4 rounded-2xl border flex items-center justify-between transition-all group",
                                formData.tests[test.id as keyof typeof formData.tests] 
                                  ? "bg-primary/10 border-primary/40 text-primary" 
                                  : "bg-white/5 border-white/5 text-primary/40"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <test.icon className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-widest">{test.label}</span>
                              </div>
                              {formData.tests[test.id as keyof typeof formData.tests] && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-primary text-on-primary rounded-2xl font-black font-headline uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(68,221,194,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Finalizar Registro</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Candidate Detail Modal */}
      <AnimatePresence>
        {selectedCandidate && activeTab === 'candidates' && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              layoutId={selectedCandidate.id}
              className="glass-panel w-full max-w-2xl p-8 rounded-[2.5rem] space-y-8 relative my-auto shadow-2xl border border-white/10"
            >
              <button 
                onClick={() => setSelectedCandidate(null)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="space-y-6 flex-1">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center text-primary font-black text-3xl border border-primary/20">
                      {selectedCandidate.name[0]}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedCandidate.name}</h3>
                      <p className="text-sm text-primary/40 font-bold uppercase tracking-widest">{selectedCandidate.role}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <Mail className="w-5 h-5 text-primary/40" />
                      <div>
                        <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">Correo</p>
                        <p className="text-xs font-bold text-white">{selectedCandidate.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <Calendar className="w-5 h-5 text-primary/40" />
                      <div>
                        <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">Fecha Registro</p>
                        <p className="text-xs font-bold text-white">{selectedCandidate.date}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-secondary/10 rounded-3xl border border-secondary/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Match Predictivo IA</p>
                      <span className="text-2xl font-black text-secondary font-headline">{selectedCandidate.score}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedCandidate.score}%` }}
                        className="h-full bg-secondary shadow-[0_0_15px_rgba(68,221,194,0.5)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                       <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Documentación Requerida</h4>
                       <label className="cursor-pointer text-[10px] font-black text-secondary uppercase hover:underline">
                         Adjuntar +
                         <input type="file" className="hidden" onChange={() => toast.success("Documento adjuntado correctamente.")} />
                       </label>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {selectedCandidate.documents?.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-primary/40" />
                            <span className="text-[10px] font-bold text-white uppercase">{doc.name}</span>
                          </div>
                          {doc.status === 'uploaded' ? (
                            <span className="text-[8px] font-black bg-secondary/10 text-secondary px-2 py-1 rounded uppercase tracking-widest">Cargado</span>
                          ) : (
                            <button className="text-[8px] font-black bg-primary text-on-primary px-2 py-1 rounded uppercase tracking-widest hover:scale-105 transition-all">Subir</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] border-b border-white/5 pb-2">Estado de Pruebas</h4>
                  <div className="space-y-3">
                    {[
                      { id: 'psychometric', label: 'Psicometría', icon: Brain },
                      { id: 'trust', label: 'Confianza', icon: ShieldCheck },
                      { id: 'background', label: 'Antecedentes', icon: FileText },
                    ].map((test) => {
                      const status = selectedCandidate.tests[test.id as keyof Candidate['tests']];
                      return (
                        <div 
                          key={test.id} 
                          onClick={() => {
                            if (status === 'completed') {
                              if (test.id === 'psychometric') {
                                setActiveTab('tests');
                              } else {
                                setActiveTab('trust');
                              }
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all",
                            status === 'completed' && "hover:bg-white/10 cursor-pointer border-secondary/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <test.icon className="w-4 h-4 text-primary/40" />
                            <span className="text-xs font-bold text-white uppercase tracking-tight">{test.label}</span>
                          </div>
                          {status === 'pending' ? (
                            <button 
                              onClick={() => startTest(selectedCandidate.id, test.id as any)}
                              className="px-3 py-1 bg-primary text-on-primary text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-all"
                            >
                              Iniciar
                            </button>
                          ) : (
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                              status === 'completed' ? "bg-secondary/10 text-secondary" :
                              status === 'sent' ? "bg-tertiary/10 text-tertiary animate-pulse" :
                              "bg-error/10 text-error"
                            )}>
                              {status === 'completed' ? 'Completado' : status === 'sent' ? 'Enviado' : 'Fallido'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] border-b border-white/5 pb-2">Asignación Operativa</h4>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Cliente / Destino</p>
                      <select 
                        value={targetClient}
                        onChange={(e) => setTargetClient(e.target.value)}
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white focus:border-secondary outline-none transition-all appearance-none"
                      >
                        {CLIENTS_LIST.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => rejectCandidate(selectedCandidate.id)}
                      className="flex-1 h-12 bg-white/5 hover:bg-error/10 hover:text-error hover:border-error/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all border border-white/5"
                    >
                      Rechazar
                    </button>
                    <button 
                      onClick={() => validateCandidate(selectedCandidate)}
                      disabled={loading}
                      className="flex-1 h-12 bg-secondary text-on-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Validar y Contratar"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document View Modal */}
      <AnimatePresence>
        {showDocumentView && selectedStaff && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-lg p-8 rounded-[2.5rem] space-y-6 relative border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowDocumentView(null)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4 border border-primary/20">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{showDocumentView.title}</h3>
                <p className="text-xs text-primary/60 font-medium">Vista previa y descarga de documento oficial</p>
              </div>

              <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Colaborador</p>
                  <p className="text-sm font-black text-white">{selectedStaff.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Estado</p>
                  <p className="text-xs font-bold text-secondary uppercase tracking-tight flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Validado por IA Impeccable
                  </p>
                </div>
                {showDocumentView.type === 'contract' && (
                  <div className="pt-4 border-t border-white/10 space-y-4">
                    <p className="text-[10px] text-primary/40 italic leading-relaxed">
                      Este contrato ha sido pre-llenado con la información del colaborador y está listo para firma digital o descarga.
                    </p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                      <input 
                        type="checkbox" 
                        id="sign" 
                        checked={isSigning} 
                        onChange={(e) => setIsSigning(e.target.checked)}
                        className="accent-primary"
                      />
                      <label htmlFor="sign" className="text-[10px] font-bold text-white uppercase cursor-pointer">
                        Acepto términos y condiciones para firma digital
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => downloadDocument(showDocumentView.type, selectedStaff)}
                  disabled={loading || (showDocumentView.type === 'contract' && !isSigning)}
                  className="flex-1 h-14 bg-primary text-on-primary rounded-2xl font-black font-headline uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  <span>Descargar PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payroll Details Modal */}
      <AnimatePresence>
        {showPayrollDetails && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-lg p-8 rounded-[2.5rem] space-y-6 relative border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowPayrollDetails(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Desglose de Nómina</h3>
                <div className="space-y-3">
                  {[
                    { label: "Sueldo Base", value: "$1,800.00" },
                    { label: "Bonos Puntualidad", value: "$250.00" },
                    { label: "Canjes Aplicados", value: `$${redemptions.filter(r => r.status === 'applied').reduce((acc, r) => acc + (r.points/100), 0).toFixed(2)}` },
                    { label: "Retenciones", value: "-$125.00" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-xs font-bold text-primary/40 uppercase tracking-widest">{item.label}</span>
                      <span className="text-sm font-black text-white">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-white/10 flex justify-between">
                    <span className="text-sm font-black text-white uppercase tracking-widest">Neto a Recibir</span>
                    <span className="text-xl font-black text-secondary font-headline">$1,925.00</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test Result Detail Modal */}
      <AnimatePresence>
        {showTestResultDetail && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-6 relative border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowTestResultDetail(null)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary mx-auto mb-4 border border-secondary/20">
                    <Brain className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">{showTestResultDetail.testName}</h3>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{showTestResultDetail.candidateName}</p>
                </div>

                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex justify-between items-center mb-2">
                     <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Calificación</p>
                     <span className="text-2xl font-black text-secondary">{showTestResultDetail.score}%</span>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Análisis Detallado IA</p>
                      <p className="text-xs text-primary/60 leading-relaxed font-bold italic">
                        "{showTestResultDetail.analysis}"
                      </p>
                   </div>
                </div>

                <div className="flex items-center gap-2 text-secondary bg-secondary/10 p-3 rounded-xl border border-secondary/20">
                   <ShieldCheck className="w-5 h-5" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Certificado por Impeccable IA</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trust Details Modal */}
      <AnimatePresence>
        {showTrustDetails && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-6 relative border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowTrustDetails(null)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{showTrustDetails.title}</h3>
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-xs text-primary/60 leading-relaxed font-medium whitespace-pre-line">
                     {showTrustDetails.content}
                   </p>
                </div>
                <div className="flex items-center gap-2 text-secondary bg-secondary/10 p-3 rounded-xl border border-secondary/20">
                   <CheckCircle2 className="w-5 h-5" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Validado con IA Impeccable</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
