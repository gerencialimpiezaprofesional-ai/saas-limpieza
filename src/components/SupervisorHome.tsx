import { motion, AnimatePresence } from "framer-motion";
import { Power, ClipboardList, Package, MapPin, Camera, History, ShieldCheck, Truck, ShoppingBag, Loader2, AlertTriangle, Sparkles, MessageSquare, ChevronRight, X, BrainCircuit, Activity, FileText, Phone, Users, Lock, Target, Gift, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { getSupervisorAIAssistant, generateExecutiveSummary } from "../services/gemini";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, addDoc, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../firebase";
import { generateDailyClientReport } from "../services/gemini";
import { sendDailyReportEmail } from "../services/emailService";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function SupervisorHome({ userData }: { userData: any }) {
  const navigate = useNavigate();
  const [showLog, setShowLog] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showGlobalAlertsModal, setShowGlobalAlertsModal] = useState(false);
  const [activeAlertTab, setActiveAlertTab] = useState<'delays' | 'tasks' | 'audits'>('tasks');
  const [clients, setClients] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingReviewTasks, setPendingReviewTasks] = useState<any[]>([]);
  const [pendingAudits, setPendingAudits] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [supervisorTasks, setSupervisorTasks] = useState<any[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [sendingReportToId, setSendingReportToId] = useState<string | null>(null);

  // Manual Trigger for a specific client report
  const handleManualClientReport = async (client: any) => {
    if (!client.email) {
      toast.error(`El cliente ${client.name} no tiene correo configurado.`);
      return;
    }
    setSendingReportToId(client.id);
    const toastId = toast.loading(`Generando y enviando reporte estratégico para ${client.name}...`);
    
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const qTasks = query(
        collection(db, "tasks"),
        where("clientId", "==", client.id),
        where("status", "==", "completed"),
        where("createdAt", ">=", today)
      );
      const tasksSnap = await getDocs(qTasks);
      const todayTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (todayTasks.length === 0) {
        toast.error("No hay tareas completadas hoy para este cliente.", { id: toastId });
        return;
      }

      const aiReport = await generateDailyClientReport(client.name, todayTasks);
      
      // Collect photos for the email
      const taskPhotos = todayTasks
        .filter((t: any) => t.afterPhoto)
        .slice(0, 3)
        .map((t: any) => t.afterPhoto);
      
      const success = await sendDailyReportEmail(client.email, client.name, { ...aiReport, images: taskPhotos });

      if (success) {
        toast.success(`Reporte enviado con éxito a ${client.email}`, { id: toastId });
        
        // Log the manual send
        await addDoc(collection(db, "automation_logs"), {
          tenantId: userData.tenantId,
          date: today.toISOString().split('T')[0],
          type: "manual_client_email",
          clientId: client.id,
          clientName: client.name,
          status: "success",
          createdAt: serverTimestamp()
        });
      } else {
        throw new Error("Failed to send email via API");
      }
    } catch (err) {
      console.error("Manual report error:", err);
      toast.error("Error al enviar el reporte. Verifique la conexión o API Key.", { id: toastId });
    } finally {
      setSendingReportToId(null);
    }
  };

  // Background Automation: Sends daily reports to clients automatically
  const runBackgroundAutomation = async (clientsList: any[]) => {
    if (automationRunning || clientsList.length === 0 || !userData?.tenantId) return;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayDateStr = today.toISOString().split('T')[0];
    
    try {
      const qAuto = query(
        collection(db, "automation_logs"), 
        where("tenantId", "==", userData.tenantId),
        where("date", "==", todayDateStr),
        where("type", "==", "daily_client_email")
      );
      
      const snapAuto = await getDocs(qAuto);
      if (!snapAuto.empty) return; 

      setAutomationRunning(true);
      for (const client of clientsList) {
        if (!client.email) continue;
        const qTasks = query(
          collection(db, "tasks"),
          where("clientId", "==", client.id),
          where("status", "==", "completed"),
          where("createdAt", ">=", today)
        );
        const tasksSnap = await getDocs(qTasks);
        const todayTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (todayTasks.length > 0) {
          const aiReport = await generateDailyClientReport(client.name, todayTasks);
          const taskPhotos = todayTasks
            .filter((t: any) => t.afterPhoto)
            .slice(0, 3)
            .map((t: any) => t.afterPhoto);
          await sendDailyReportEmail(client.email, client.name, { ...aiReport, images: taskPhotos });
        }
      }
      await addDoc(collection(db, "automation_logs"), {
        tenantId: userData.tenantId,
        date: todayDateStr,
        type: "daily_client_email",
        status: "success",
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Automation error:", err);
    } finally {
      setAutomationRunning(false);
    }
  };

  const [vehicleLog, setVehicleLog] = useState({
    mileage: "",
    fuel: "full",
    supplies: ""
  });

  const [auditData, setAuditData] = useState({
    location: "",
    operator: "",
    score: 100,
    notes: "",
    criticalIssue: false
  });

  const [reviewTasks, setReviewTasks] = useState<any[]>([]);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [selectedAuditForReview, setSelectedAuditForReview] = useState<any | null>(null);
  const [isProcessingReview, setIsProcessingReview] = useState(false);

  // Helper to safely format dates from Firestore or strings
  const formatDate = (dateValue: any) => {
    if (!dateValue) return "Fecha no disponible";
    try {
      if (typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString();
      }
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? "Fecha inválida" : d.toLocaleDateString();
    } catch (e) {
      return "Error de fecha";
    }
  };

  useEffect(() => {
    if (!userData?.tenantId) return;

    // Fetch Clients for Audit dropdown
    const qClients = query(collection(db, "clients"), where("tenantId", "==", userData.tenantId));
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      const clientList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientList);
      
      // Trigger daily automation check
      if (clientList.length > 0) {
        runBackgroundAutomation(clientList);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "clients");
    });

    // Fetch operators
    const qTeam = query(collection(db, "users"), where("tenantId", "==", userData.tenantId), where("role", "==", "operator"));
    const unsubscribeTeam = onSnapshot(qTeam, (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    // Fetch past reports
    const qReports = query(collection(db, "reports"), where("tenantId", "==", userData.tenantId), orderBy("createdAt", "desc"), limit(10));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "reports");
    });

    // Fetch audit history
    const qAudits = query(collection(db, "audits"), where("tenantId", "==", userData.tenantId), orderBy("createdAt", "desc"), limit(10));
    const unsubscribeAudits = onSnapshot(qAudits, (snapshot) => {
      setAuditHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "audits");
    });

    // Fetch tasks pending review (DEDICATED QUERY)
    const qPendingReview = query(
      collection(db, "tasks"),
      where("tenantId", "==", userData.tenantId),
      where("status", "==", "pending_review"),
      limit(50)
    );
    const unsubscribePendingReview = onSnapshot(qPendingReview, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("[Audit] Pending tasks count:", tasks.length);
      setPendingReviewTasks(tasks);
    }, (error) => {
      console.error("Error fetching pending reviews:", error);
    });

    // Fetch audits pending review (DEDICATED QUERY for low scores)
    const qPendingAudits = query(
      collection(db, "audits"),
      where("tenantId", "==", userData.tenantId),
      limit(50) 
    );
    const unsubscribePendingAudits = onSnapshot(qPendingAudits, (snapshot) => {
      const allAudits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Sort manually client-side if needed to avoid index issues during audit
      const filtered = allAudits.filter(a => (a.aiAnalysis?.score || 0) < 75 && !a.manualReviewRequested);
      setPendingAudits(filtered);
    }, (error) => {
      console.error("Error fetching pending audits:", error);
    });

    // Fetch all completed tasks for the tenant to monitor quality
    const qAllTasks = query(
      collection(db, "tasks"), 
      where("tenantId", "==", userData.tenantId), 
      where("status", "in", ["completed", "rejected"]),
      orderBy("createdAt", "desc"), 
      limit(20)
    );
    const unsubscribeAllTasks = onSnapshot(qAllTasks, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviewTasks(tasks);
    }, (error) => {
      console.error("Error fetching tasks for review:", error);
    });

    // Fetch supervisor personal tasks
    if (userData.uid) {
      const qSupTasks = query(collection(db, "tasks"), where("tenantId", "==", userData.tenantId), where("operatorId", "==", userData.uid));
      const unsubscribeSupTasks = onSnapshot(qSupTasks, (snapshot) => {
        setSupervisorTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => {
        unsubscribeClients();
        unsubscribeTeam();
        unsubscribeReports();
        unsubscribeAudits();
        unsubscribeSupTasks();
        unsubscribePendingReview();
        unsubscribePendingAudits();
        unsubscribeAllTasks();
      };
    }

    return () => {
      unsubscribeClients();
      unsubscribeTeam();
      unsubscribeReports();
      unsubscribeAudits();
      unsubscribeAllTasks();
      unsubscribePendingReview();
      unsubscribePendingAudits();
      if (userData.uid) {
        // ...
      }
    };
  }, [userData?.tenantId]);

  // Combined alerts: Delay alerts + Low Score alerts
  const delayAlerts = teamMembers.filter(m => {
    if (m.status === 'alert' && m.expected) {
      const [expH, expM] = m.expected.split(':').map(Number);
      const now = new Date();
      const expDate = new Date();
      expDate.setHours(expH, expM, 0);
      const diff = (now.getTime() - expDate.getTime()) / (1000 * 60);
      return diff > 15;
    }
    return false;
  });

  const lowScoreAlerts = [
    ...pendingReviewTasks,
    ...reviewTasks.filter(t => (t.score || 0) < 75 && !t.approvalStatus && t.status !== "pending_review")
  ];
  const lowScoreAudits = pendingAudits;

  const totalAlerts = delayAlerts.length + lowScoreAlerts.length + lowScoreAudits.length;

  const handleMarkAuditAsReviewed = async () => {
    if (!selectedAuditForReview) return;
    try {
      await updateDoc(doc(db, "audits", selectedAuditForReview.id), {
        manualReviewRequested: true, // This hides it from alerts
        reviewedAt: serverTimestamp(),
        reviewedBy: userData.uid,
        reviewNotes: reviewNote
      });
      toast.success("Auditoría marcada como revisada");
      setSelectedAuditForReview(null);
      setReviewNote("");
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `audits/${selectedAuditForReview.id}`);
    }
  };

  const handleApproveTask = async () => {
    if (!selectedTaskForReview) return;
    setIsProcessingReview(true);
    try {
      await updateDoc(doc(db, "tasks", selectedTaskForReview.id), {
        status: "completed",
        approvalStatus: "approved",
        supervisorNote: reviewNote,
        score: 100, // Manual max score when approved by supervisor
        approvedBy: userData.name,
        approvedAt: serverTimestamp(),
      });
      toast.success("Tarea aprobada con éxito");
      setSelectedTaskForReview(null);
      setReviewNote("");
    } catch (error) {
      console.error("Error approving task:", error);
      toast.error("Error al aprobar la tarea");
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleRejectTask = async () => {
    if (!selectedTaskForReview) return;
    setIsProcessingReview(true);
    try {
      await updateDoc(doc(db, "tasks", selectedTaskForReview.id), {
        status: "rejected", 
        approvalStatus: "rejected",
        supervisorNote: reviewNote,
        rejectedAt: serverTimestamp(),
        rejectedBy: userData.name
      });
      
      // Optionally notify operator or create a sub-task for re-do
      toast.warning("Tarea rechazada. El operario deberá realizarla nuevamente.");
      setSelectedTaskForReview(null);
      setReviewNote("");
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast.error("Error al rechazar la tarea");
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleGetAiInsights = async () => {
    setAiLoading(true);
    setShowAiPanel(true);
    try {
      const context = {
        team: teamMembers,
        alerts: { delayCount: delayAlerts.length, lowScoreCount: lowScoreAlerts.length },
        inventory: "Bajo stock en Cloro (5L) y Bolsas (10 pq)",
        currentTime: new Date().toLocaleTimeString(),
        currentDate: new Date().toLocaleDateString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      const insights = await getSupervisorAIAssistant(context);
      setAiInsights(insights);
    } catch (error) {
      toast.error("Error al conectar con la IA");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "vehicle_logs"), {
        tenantId: userData.tenantId,
        supervisorId: userData.uid,
        supervisorName: userData.name,
        mileage: vehicleLog.mileage,
        fuel: vehicleLog.fuel,
        supplies: vehicleLog.supplies,
        createdAt: serverTimestamp()
      });
      setShowLog(false);
      setVehicleLog({ mileage: "", fuel: "full", supplies: "" });
      toast.success("Bitácora de Supervisión guardada con éxito.");
    } catch (error) {
      console.error("Error saving vehicle log:", error);
      toast.error("Error al guardar la bitácora vehicular");
    } finally {
      setLoading(false);
    }
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "audits"), {
        tenantId: userData.tenantId,
        supervisorId: userData.uid,
        supervisorName: userData.name,
        location: auditData.location,
        clientName: auditData.location,
        operator: auditData.operator,
        operatorName: auditData.operator,
        score: auditData.score,
        results: {
          observations: auditData.notes,
          cleanliness: Math.round(auditData.score / 20) // Mapping score to 1-5 scale
        },
        aiAnalysis: {
          score: auditData.score,
          observations: auditData.notes
        },
        criticalIssue: auditData.criticalIssue,
        createdAt: serverTimestamp(),
        type: "random_field_audit"
      });
      setShowAudit(false);
      setAuditData({ location: "", operator: "", score: 100, notes: "", criticalIssue: false });
      toast.success("Auditoría de Supervisión registrada correctamente.");
    } catch (error) {
      console.error("Error saving audit:", error);
      toast.error("Error al registrar la auditoría");
    } finally {
      setLoading(false);
    }
  };

  const [finalizingDay, setFinalizingDay] = useState(false);

  const handleFinalizeDay = async () => {
    setFinalizingDay(true);
    const toastId = toast.loading("Consolidando auditorías del día...");
    try {
      // Fetch today's audits
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const q = query(
        collection(db, "audits"), 
        where("tenantId", "==", userData.tenantId),
        where("createdAt", ">=", today),
        orderBy("createdAt", "desc")
      );
      
      const snap = await getDocs(q);
      const todayAudits = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (todayAudits.length === 0) {
        toast.error("No hay auditorías registradas hoy para generar el reporte.", { id: toastId });
        setFinalizingDay(false);
        return;
      }

      // Generate summary text
      const summaryText = todayAudits.map((a: any, i) => 
        `${i+1}. ${a.clientName}: Score ${a.aiAnalysis?.score || 'N/A'}% - ${a.results?.cleanliness}/5. Obs: ${a.results?.observations || 'Sin obs'}`
      ).join('\n');

      // Generate summary for AI
      const auditDetails = todayAudits.map((a: any) => ({
        client: a.clientName,
        score: a.aiAnalysis?.score || 0,
        observations: a.results?.observations || 'N/A'
      }));

      // In a real app, we'd call Gemini here. For now, let's build a nice HTML summary.
      const aiReport = {
        score: Math.round(auditDetails.reduce((acc, a) => acc + a.score, 0) / auditDetails.length),
        summary: `Se completaron ${todayAudits.length} auditorías hoy con un desempeño promedio del ${Math.round(auditDetails.reduce((acc, a) => acc + a.score, 0) / auditDetails.length)}%.`,
        highlights: auditDetails.map(a => `${a.client}: ${a.score}% - ${a.observations}`),
        recommendations: ["Mantener el estándar en los clientes con score > 90%", "Reforzar capacitación en áreas con observaciones recurrentes."]
      };
      
      const qCeo = query(
        collection(db, "users"),
        where("tenantId", "==", userData.tenantId),
        where("role", "==", "ceo"),
        limit(1)
      );
      const ceoSnap = await getDocs(qCeo);
      const ceoData = ceoSnap.docs.map(d => d.data())[0];
      const ceoEmail = ceoData?.email || "gerencia.limpiezaprofesional@gmail.com"; 

      const success = await sendDailyReportEmail(ceoEmail, "Supervisión Central", { 
        ...aiReport,
        images: todayAudits.slice(0, 3).map((a: any) => a.afterPhoto).filter(Boolean)
      });

      if (success) {
        toast.success(`Reporte estratégico enviado al CEO (${ceoEmail})`, { id: toastId });
      } else {
        // Fallback to mailto if API fails
        const mailtoUrl = `mailto:${ceoEmail}?subject=Reporte Diario de Supervisión - ${new Date().toLocaleDateString()}&body=${encodeURIComponent(aiReport.summary)}`;
        window.location.href = mailtoUrl;
        toast.success("Resumen generado. Se abrió el cliente de correo.", { id: toastId });
      }

      await addDoc(collection(db, "daily_reports"), {
        tenantId: userData.tenantId,
        supervisorId: userData.uid,
        supervisorName: userData.name,
        date: today,
        auditCount: todayAudits.length,
        summary: aiReport.summary,
        kpis: { score: aiReport.score },
        createdAt: serverTimestamp()
      });

      toast.success("Resumen consolidado. Tu cliente de correo se abrirá para el envío.", { id: toastId });
    } catch (error: any) {
      console.error("Error finalizing day:", error);
      handleFirestoreError(error, OperationType.WRITE, "daily_reports");
    } finally {
      setFinalizingDay(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    const toastId = toast.loading("Generando reporte de supervisión formalizado...");
    try {
      // Calculate real operational data from auditHistory
      const today = new Date();
      today.setHours(0,0,0,0);
      
      // Fetch today's vehicle log
      const qVehicle = query(
        collection(db, "vehicle_logs"),
        where("tenantId", "==", userData.tenantId),
        where("createdAt", ">=", today),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const vehicleSnap = await getDocs(qVehicle);
      const todayVehicleLog = vehicleSnap.docs.map(doc => doc.data())[0];

      // Fetch today's tasks for "Novedades de Servicio"
      const qTasks = query(
        collection(db, "tasks"),
        where("tenantId", "==", userData.tenantId),
        where("status", "==", "completed"),
        where("completedAt", ">=", today)
      );
      const tasksSnap = await getDocs(qTasks);
      const todayTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch today's random audits explicitly
      const qAuditsToday = query(
        collection(db, "audits"),
        where("tenantId", "==", userData.tenantId),
        where("createdAt", ">=", today),
        orderBy("createdAt", "desc")
      );
      const auditSnap = await getDocs(qAuditsToday);
      const todayAudits = auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const satisfaction = todayAudits.length > 0 
        ? Math.round((todayAudits.reduce((acc, a: any) => acc + (a.results?.cleanliness || 0), 0) / (todayAudits.length * 5)) * 100)
        : 100;
      
      const aiEfficiency = todayAudits.length > 0
        ? Math.round(todayAudits.reduce((acc, a: any) => acc + (a.aiAnalysis?.score || 0), 0) / todayAudits.length)
        : 100;

      const operationalData = {
        satisfaction,
        aiEfficiency,
        activeServices: todayAudits.length,
        qualityAlerts: totalAlerts,
        criticalSupplies: 4, // Still manual or could be derived
        clients: Array.from(new Set(todayAudits.map((a: any) => a.clientName)))
      };

      const result = await generateExecutiveSummary(operationalData);
      
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      // Formal Minimalist Background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');

      // Top Header Bar
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("IMPECCABLE AI", 20, 30);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("CORPORATE OPERATIONAL AUDIT SYSTEM", 20, 38);
      
      // Document Identification
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("REPORTE DIARIO DE OPERACIONES", 20, 70);
      
      // Data Grid Top
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 75, 190, 75);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("FOLIO:", 20, 85);
      doc.text("FECHA:", 80, 85);
      doc.text("SUPERVISOR:", 130, 85);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(`CF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 20, 92);
      doc.text(new Date().toLocaleDateString(), 80, 92);
      doc.text((userData?.name || "SUPERVISOR").toUpperCase(), 130, 92);
      
      let currentY = 105;

      // Bitácora Vehicular Section
      if (todayVehicleLog) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(20, currentY, 170, 35, 3, 3, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(20, currentY, 170, 35, 3, 3, 'S');
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("BITÁCORA VEHICULAR E INSUMOS", 30, currentY + 10);
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`KILOMETRAJE: ${todayVehicleLog.mileage || 'N/A'} km`, 30, currentY + 18);
        doc.text(`COMBUSTIBLE: ${todayVehicleLog.fuel?.toUpperCase() || 'N/A'}`, 100, currentY + 18);
        
        const suppliesText = doc.splitTextToSize(`INSUMOS: ${todayVehicleLog.supplies || 'Sin registros'}`, 150);
        doc.text(suppliesText, 30, currentY + 24);
        
        currentY += 45;
      }

      // Executive Summary Panel
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(20, currentY, 170, 45, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, currentY, 170, 45, 3, 3, 'S');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text("SÍNTESIS ESTRATÉGICA (GENERADA POR IA)", 30, currentY + 10);
      
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const splitSummary = doc.splitTextToSize(result.summary, 150);
      doc.text(splitSummary, 30, currentY + 18);

      currentY += 55;

      // KPIs Section
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("INDICADORES CLAVE DE DESEMPEÑO (KPIs)", 20, currentY);

      const kpis = [
        { label: "EFICIENCIA OPERATIVA", value: `${operationalData.aiEfficiency}%` },
        { label: "NIVEL DE SATISFACCIÓN", value: `${operationalData.satisfaction}%` },
        { label: "ALERTAS DE CALIDAD", value: `${operationalData.qualityAlerts}` },
        { label: "SERVICIOS HOY", value: `${operationalData.activeServices}` }
      ];

      kpis.forEach((kpi, i) => {
        const x = 20 + (i * 45);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, currentY + 10, 40, 25, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, currentY + 10, 40, 25, 2, 2, 'S');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + 5, currentY + 18);
        
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(kpi.value, x + 5, currentY + 28);
      });

      // NOVEDADES DE SERVICIO Section
      doc.addPage();
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("NOVEDADES DE SERVICIO", 20, 30);
      
      let novY = 45;
      if (todayTasks.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("No se registraron servicios completados hoy.", 20, novY);
      } else {
        todayTasks.forEach((task: any, idx) => {
          if (novY > 260) {
            doc.addPage();
            novY = 30;
          }
          
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.text(`${idx + 1}. ${task.title} - ${task.clientName || 'Propio'}`, 20, novY);
          
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          const novText = doc.splitTextToSize(`NOVEDADES: ${task.supervisorNote || task.aiFeedback || 'Sin novedades relevantes.'}`, 160);
          doc.text(novText, 25, novY + 6);
          
          novY += (novText.length * 4) + 10;
        });
      }

      // Visual Evidence Section
      if (todayAudits.length > 0) {
        doc.addPage();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, 210, 297, 'F');
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("EVIDENCIA FOTOGRÁFICA Y ANÁLISIS IA", 20, 30);
        
        let yPos = 50;
        const auditsWithPhotos = todayAudits.filter((a: any) => a.evidenceData && a.mediaType === 'photo').slice(0, 3);
        
        auditsWithPhotos.forEach((audit: any, idx) => {
          if (yPos > 220) {
            doc.addPage();
            yPos = 30;
          }
          
          doc.setFontSize(12);
          doc.text(`${idx + 1}. CLIENTE: ${audit.clientName}`, 20, yPos);
          
          try {
            // Check if it's a base64 image
            if (audit.evidenceData.startsWith('data:image')) {
              doc.addImage(audit.evidenceData, 'JPEG', 20, yPos + 5, 60, 45);
            }
          } catch (e) {
            console.error("Error adding image to PDF", e);
          }
          
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text(`RESULTADO IA: ${audit.aiAnalysis?.score || 0}%`, 90, yPos + 10);
          const splitObs = doc.splitTextToSize(`COMENTARIO: ${audit.aiAnalysis?.observations || 'Sin observaciones'}`, 100);
          doc.text(splitObs, 90, yPos + 18);
          
          yPos += 65;
        });

        if (auditsWithPhotos.length === 0) {
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text("No se detectaron evidencias fotográficas en las auditorías de hoy.", 20, 50);
        }
      }

      // Digital Validation Footer
      const lastPage = (doc as any).internal.getNumberOfPages();
      doc.setPage(lastPage);
      
      doc.setFillColor(241, 245, 249);
      doc.rect(0, 267, 210, 30, 'F');
      
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text("ESTE DOCUMENTO HA SIDO VALIDADO MEDIANTE PROTOCOLOS DE INTELIGENCIA ARTIFICIAL Y CUENTA CON VALIDEZ OPERATIVA INTERNA.", 105, 280, { align: 'center' });
      doc.text(`Impeccable AI Engine v2.4.0 - Tenant: ${userData.tenantId}`, 105, 285, { align: 'center' });

      // Signature Area
      doc.setDrawColor(15, 23, 42);
      doc.line(70, 255, 140, 255);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text("FIRMA ELECTRÓNICA DEL SUPERVISOR", 105, 260, { align: 'center' });
      
      doc.save(`Impeccable_Informe_${(userData?.name || "Report").replace(/\s/g, '_')}_${new Date().getTime()}.pdf`);
      
      // Save metadata to Firestore
      await addDoc(collection(db, "reports"), {
        tenantId: userData.tenantId,
        supervisorId: userData.uid,
        supervisorName: userData.name,
        createdAt: serverTimestamp(),
        type: "Diario Operativo",
        summary: result.summary,
        kpis: operationalData
      });

      toast.success("Informe ejecutivo formalizado descargado y guardado", { id: toastId });
    } catch (error) {
      console.error("PDF Generate Error:", error);
      toast.error("Error al generar reporte", { id: toastId });
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Welcome Section */}
      <section className="flex flex-col items-center text-center space-y-1">
        <h2 className="text-3xl font-black font-headline text-white tracking-tight uppercase">¡Hola, {userData?.name?.split(' ')[0] || "Supervisor"}!</h2>
        <p className="text-sm text-primary/60 font-medium tracking-[0.2em] uppercase">Supervisión Estratégica en Tiempo Real</p>
      </section>

      {/* Stats Quick Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-secondary/5">
          <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Mis Puntos</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-black text-white">{userData?.points || 0}</span>
            <Gift className="w-4 h-4 text-secondary/40" />
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Team Campo</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-black text-white">{teamMembers.length}</span>
            <Users className="w-4 h-4 text-primary/40" />
          </div>
        </div>
        <button 
          onClick={() => setShowGlobalAlertsModal(true)}
          className="glass-panel p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all text-left w-full group"
        >
          <p className="text-[10px] font-black text-tertiary uppercase tracking-widest">Alertas</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-xl font-black", totalAlerts > 0 ? "text-error" : "text-white")}>{totalAlerts}</span>
            <AlertTriangle className={cn("w-4 h-4 transition-all", totalAlerts > 0 ? "text-error animate-pulse" : "text-primary/40")} />
          </div>
        </button>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Tareas Hoy</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-black text-white">{supervisorTasks.length}</span>
            <Target className="w-4 h-4 text-white/20" />
          </div>
        </div>
      </section>

      {/* Shift Control Center (Real-time Report Overview) */}
      <section className="glass-panel p-8 rounded-[3rem] border border-white/5 space-y-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-secondary animate-pulse" />
              <h2 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">Control de Turno</h2>
            </div>
            <p className="text-[10px] text-primary/40 font-black uppercase tracking-[0.2em]">Consolidación de Operaciones en Tiempo Real</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleFinalizeDay}
              disabled={finalizingDay}
              className="px-6 h-14 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center gap-2"
            >
              {finalizingDay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4 text-secondary" />}
              Reportar a CEO
            </button>
            <button 
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="px-8 h-14 bg-secondary text-on-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generar PDF Diario
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Bitácora Vehicular Preview */}
          <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-secondary" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Estado del Vehículo</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-primary/40 uppercase font-black tracking-tighter">Combustible</span>
                <span className="text-white font-black uppercase tracking-widest bg-secondary/20 px-2 py-0.5 rounded-lg text-[10px]">{vehicleLog.fuel === 'full' ? 'Tanque Lleno' : vehicleLog.fuel === 'half' ? 'Medio' : 'Reserva'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-primary/40 uppercase font-black tracking-tighter">KM Registrado</span>
                <span className="text-white font-black">{vehicleLog.mileage || '0'} km</span>
              </div>
              <button 
                onClick={() => setShowLog(true)}
                className="w-full py-3 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary/40 hover:text-white transition-all border border-dashed border-white/10"
              >
                Actualizar Bitácora
              </button>
            </div>
          </div>

          {/* Pending Reviews Summary Card */}
          <button 
            onClick={() => {
              const element = document.getElementById('critical-alerts');
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="p-6 bg-error/5 rounded-3xl border border-error/10 space-y-4 hover:bg-error/10 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-error" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Revisiones Pendientes</h3>
            </div>
            <div className="flex flex-col items-center justify-center py-2 space-y-1">
              <span className={cn(
                "text-4xl font-black font-headline tracking-tighter transition-all",
                (lowScoreAlerts.length + lowScoreAudits.length) > 0 ? "text-error scale-110" : "text-white/20"
              )}>
                {lowScoreAlerts.length + lowScoreAudits.length}
              </span>
              <p className="text-[8px] font-black uppercase text-primary/40 tracking-widest text-center">Eventos {"<"} 75% esperando tu acción</p>
            </div>
            <div className={cn(
                "w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border text-center",
                (lowScoreAlerts.length + lowScoreAudits.length) > 0 
                  ? "bg-error/20 border-error/30 text-white animate-pulse" 
                  : "bg-white/5 border-dashed border-white/10 text-primary/40"
              )}
            >
              {(lowScoreAlerts.length + lowScoreAudits.length) > 0 ? "ATENDER AHORA" : "Todo bajo control"}
            </div>
          </button>

          {/* Random Audits Preview */}
          <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Auditorías de Hoy</h3>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
              {auditHistory.filter(a => {
                const today = new Date();
                today.setHours(0,0,0,0);
                const aDate = typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
                return aDate >= today;
              }).map((audit, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-white uppercase truncate max-w-[100px]">{audit.clientName}</span>
                  <span className={cn(
                    "text-[8px] font-black px-2 py-0.5 rounded-full",
                    (audit.aiAnalysis?.score || 0) >= 90 ? "bg-secondary/20 text-secondary" : "bg-error/20 text-error"
                  )}>{audit.aiAnalysis?.score || 0}%</span>
                </div>
              ))}
              {auditHistory.length === 0 && (
                <p className="text-[10px] text-primary/20 font-black uppercase tracking-widest text-center py-4">No hay auditorías registradas</p>
              )}
            </div>
            <button 
              onClick={() => setShowAudit(true)}
              className="w-full py-3 bg-secondary/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-secondary hover:bg-secondary/20 transition-all"
            >
              Nueva Auditoría Campo
            </button>
          </div>

          {/* Novedades (News) Preview */}
          <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-secondary" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Novedades del Turno</h3>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
              {reviewTasks.filter(t => t.status === 'completed' && t.supervisorNote).map((task, i) => (
                <div key={i} className="p-2 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest truncate">{task.client}</p>
                  <p className="text-[9px] text-white/60 line-clamp-1 italic">"{task.supervisorNote}"</p>
                </div>
              ))}
              {reviewTasks.filter(t => t.status === 'completed' && t.supervisorNote).length === 0 && (
                <p className="text-[10px] text-primary/20 font-black uppercase tracking-widest text-center py-4">Sin novedades relevantes</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Personal Tasks for Supervisor */}
      <section className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-secondary">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Mis Tareas Designadas</h3>
          <Target className="w-4 h-4 text-secondary/40" />
        </div>
        <div className="space-y-3">
          {supervisorTasks.length === 0 ? (
            <p className="text-[10px] text-white/20 text-center py-4 uppercase font-bold tracking-widest italic">No hay tareas personales hoy</p>
          ) : supervisorTasks.map((task, i) => (
            <div key={task.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-sm font-black text-white uppercase">{task.title}</p>
                   <p className="text-[10px] text-white/40 font-bold uppercase">{task.client || 'Ubicación Variable'}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-secondary group-hover:translate-x-1 transition-all" />
            </div>
          ))}
        </div>
      </section>

      {/* Critical Alerts Section */}
      {(delayAlerts.length > 0 || lowScoreAlerts.length > 0 || lowScoreAudits.length > 0) && (
        <section id="critical-alerts" className="bg-error/10 border border-error/20 p-8 rounded-[3rem] space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-error/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-error">
              <div className="p-2 bg-error/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Alertas Críticas de Calidad</h3>
                <p className="text-[10px] font-bold text-error/60 uppercase tracking-widest">Requieren tu aprobación o rechazo manual para avanzar</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-error/10 rounded-full border border-error/20">
               <span className="w-2 h-2 rounded-full bg-error animate-ping" />
               <span className="text-[10px] font-black text-error uppercase tracking-widest">{lowScoreAlerts.length + lowScoreAudits.length} Pendientes</span>
            </div>
          </div>
          
          <div className="space-y-3">
            {/* Delay Alerts */}
            {delayAlerts.map((alert, i) => (
              <div key={`delay-${i}`} className="flex justify-between items-center bg-error/5 p-4 rounded-2xl border border-error/10 border-dashed">
                <div>
                  <p className="text-xs font-black text-white uppercase">{alert.name}</p>
                  <p className="text-[10px] text-error/60 font-black uppercase tracking-widest">Sin Check-in en {alert.location} (Esperado: {alert.expected})</p>
                </div>
                <button 
                  onClick={() => toast.info(`Llamando a ${alert.name}...`)}
                  className="px-4 py-2 bg-error text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg"
                >
                  Contactar
                </button>
              </div>
            ))}

            {/* Low Score Alerts */}
            {lowScoreAlerts.map((task) => (
              <div key={`low-${task.id}`} className="flex justify-between items-center bg-error/5 p-4 rounded-2xl border border-error/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-error/20 rounded-xl flex flex-col items-center justify-center border border-error/30">
                    <span className="text-xs font-black text-error leading-none">{task.score}%</span>
                    <span className="text-[6px] font-black text-error uppercase">Score</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase">{task.operatorName}</p>
                    <p className="text-[10px] text-error/80 font-black uppercase tracking-widest">
                      Calificación Crítica en {task.areaName || task.clientName}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTaskForReview(task)}
                  className="px-4 py-2 bg-error/20 text-error text-[10px] font-black rounded-xl border border-error/30 uppercase tracking-widest hover:bg-error hover:text-white transition-all shadow-lg"
                >
                  Revisar
                </button>
              </div>
            ))}

            {/* Low Score Audits */}
            {lowScoreAudits.map((audit) => (
              <div key={`baudit-${audit.id}`} className="flex justify-between items-center bg-orange-500/5 p-4 rounded-2xl border border-orange-500/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex flex-col items-center justify-center border border-orange-500/30">
                    <span className="text-xs font-black text-orange-500 leading-none">{audit.aiAnalysis?.score || 0}%</span>
                    <span className="text-[6px] font-black text-orange-500 uppercase">Audit</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase">{audit.clientName}</p>
                    <p className="text-[10px] text-orange-500/80 font-black uppercase tracking-widest">
                      Evidencia de Alta Prioridad
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    id={`btn-review-audit-${audit.id}`}
                    onClick={() => setSelectedAuditForReview(audit)}
                    className="px-4 py-2 bg-orange-500/20 text-orange-500 text-[10px] font-black rounded-xl border border-orange-500/30 uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all shadow-lg"
                  >
                    Atender
                  </button>
                  <button 
                    id={`btn-view-audit-detail-${audit.id}`}
                    onClick={() => navigate("/audit")}
                    className="p-2 bg-white/5 text-primary/40 rounded-xl border border-white/10 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Assistant Button */}
      <section>
        <button 
          onClick={handleGetAiInsights}
          className="w-full glass-panel p-6 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-between group hover:border-primary/40 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-[0_0_20px_rgba(68,221,194,0.3)]">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Asistente Predictivo IA</h3>
              <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">Predicción de ausencias e incidencias</p>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-primary group-hover:scale-125 transition-transform" />
        </button>
      </section>

      {/* Main Action Button */}
      <section className="flex flex-col items-center justify-center py-6 relative">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/checkin")}
          className="relative group"
        >
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-active:bg-primary/40 transition-all duration-500"></div>
          <div className={cn(
            "relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)] transition-colors",
            userData?.status === "active" ? "bg-gradient-to-br from-secondary to-secondary-container" : "bg-gradient-to-br from-primary to-primary/60"
          )}>
            <Power className="w-12 h-12 text-on-primary mb-2" strokeWidth={3} />
            <span className="font-headline font-black text-on-primary text-xl tracking-tighter uppercase leading-none">
              {userData?.status === "active" ? "Validar" : "Iniciar"}
            </span>
            <span className="font-headline font-black text-on-primary text-xl tracking-tighter uppercase">Ruta</span>
          </div>
        </motion.button>
      </section>

      {/* Supervisor Specific Tools */}
      <section className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => navigate("/audit")}
          className="glass-panel p-5 rounded-2xl space-y-3 text-left hover:bg-white/5 transition-all border-l-4 border-primary"
        >
          <ClipboardList className="w-6 h-6 text-primary" />
          <div>
            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Auditoría</p>
            <p className="text-sm font-bold text-white">Supervisión en Campo</p>
          </div>
        </button>

        <button 
          onClick={handleGenerateReport}
          disabled={reportLoading}
          className="glass-panel p-5 rounded-2xl space-y-3 text-left hover:bg-white/5 transition-all border-l-4 border-secondary disabled:opacity-50"
        >
          {reportLoading ? <Loader2 className="w-6 h-6 text-secondary animate-spin" /> : <FileText className="w-6 h-6 text-secondary" />}
          <div>
            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Resultados</p>
            <p className="text-sm font-bold text-white">Generar Reporte Formal</p>
          </div>
        </button>

        <button 
          onClick={handleFinalizeDay}
          disabled={finalizingDay}
          className="glass-panel p-5 rounded-2xl space-y-3 text-left hover:bg-white/5 transition-all border-l-4 border-orange-500 disabled:opacity-50"
        >
          {finalizingDay ? <Loader2 className="w-6 h-6 text-orange-500 animate-spin" /> : <ShieldCheck className="w-6 h-6 text-orange-500" />}
          <div>
            <p className="text-[10px] font-bold text-orange-500/60 uppercase tracking-widest">Cierre</p>
            <p className="text-sm font-bold text-white">Finalizar y Enviar Reporte</p>
          </div>
        </button>

        <button 
          onClick={() => setShowLog(true)}
          className="glass-panel p-5 rounded-2xl space-y-3 text-left hover:bg-white/5 transition-all border-l-4 border-tertiary"
        >
          <Truck className="w-6 h-6 text-tertiary" />
          <div>
            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Unidad</p>
            <p className="text-sm font-bold text-white">Bitácora Vehicular</p>
          </div>
        </button>

        <button 
          onClick={() => navigate("/inventory")}
          className="glass-panel p-5 rounded-2xl space-y-3 text-left hover:bg-white/5 transition-all border-l-4 border-white/20"
        >
          <ShoppingBag className="w-6 h-6 text-white/60" />
          <div>
            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Insumos</p>
            <p className="text-sm font-bold text-white">Requisición Mensual</p>
          </div>
        </button>

        <button 
          onClick={() => navigate("/redemption")}
          className="glass-panel p-5 rounded-2xl space-y-3 text-left hover:bg-white/5 transition-all border-l-4 border-pink-500/40"
        >
          <Gift className="w-6 h-6 text-pink-500" />
          <div>
            <p className="text-[10px] font-bold text-pink-500/60 uppercase tracking-widest">Comunidad</p>
            <p className="text-sm font-bold text-white">Canje de Premios</p>
          </div>
        </button>
      </section>

      {/* Active Team Overview */}
      <section className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Equipo en Campo</h3>
          <span className="px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full">{teamMembers.length} Miembros</span>
        </div>
        <div className="space-y-3">
          {teamMembers.map((member, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {(member.name || "U")[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{member.name}</p>
                  <p className="text-[10px] text-primary/40 uppercase">{member.location} • {member.expected}</p>
                </div>
              </div>
              <div className={cn(
                "w-2 h-2 rounded-full",
                member.status === "cleaning" ? "bg-secondary" : member.status === "checkin" ? "bg-primary" : "bg-error animate-pulse"
              )} />
            </div>
          ))}
        </div>
        <button 
          onClick={() => navigate("/tasks")}
          className="w-full py-3 text-[10px] font-bold text-primary/40 uppercase tracking-widest border-t border-white/5 mt-2"
        >
          Ver Todas las Tareas de Supervisión
        </button>
      </section>

      {/* Global Alerts Modal */}
      <AnimatePresence>
        {showGlobalAlertsModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGlobalAlertsModal(false)}
              className="absolute inset-0 bg-background/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-surface-container rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-error/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-error/20 rounded-2xl">
                    <AlertTriangle className="w-8 h-8 text-error animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
                       Centro de Control de Alertas 
                       <span className="bg-error text-white text-xs px-2 py-0.5 rounded-lg not-italic tracking-normal">{totalAlerts}</span>
                    </h2>
                    <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">Atención inmediata requerida para mantener certificaciones</p>
                  </div>
                </div>
                <button onClick={() => setShowGlobalAlertsModal(false)} className="p-3 hover:bg-white/5 rounded-full border border-white/5">
                  <X className="w-6 h-6 text-primary/40" />
                </button>
              </div>

              <div className="flex bg-white/5 border-b border-white/5 px-8">
                {[
                  { id: 'tasks', label: 'Tareas < 75%', count: lowScoreAlerts.length, icon: ClipboardList },
                  { id: 'audits', label: 'Auditorías IA', count: lowScoreAudits.length, icon: BrainCircuit },
                  { id: 'delays', label: 'Retardos/GPS', count: delayAlerts.length, icon: MapPin },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAlertTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                      activeAlertTab === tab.id 
                        ? "border-error text-error bg-error/5" 
                        : "border-transparent text-primary/40 hover:text-white"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {activeAlertTab === 'tasks' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lowScoreAlerts.length === 0 ? (
                      <p className="col-span-2 text-center py-10 text-primary/20 font-black uppercase italic">Sin tareas críticas pendientes</p>
                    ) : lowScoreAlerts.map(task => (
                      <div key={task.id} className="p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-error/30 transition-all group flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-error/20 rounded-2xl flex flex-col items-center justify-center border border-error/30">
                            <span className="text-lg font-black text-error leading-none">{task.score}%</span>
                            <span className="text-[7px] font-black text-error uppercase">Ref: {task.id.slice(-4)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-white uppercase">{task.operatorName || 'Operario Desconocido'}</p>
                            <p className="text-[10px] text-error font-bold uppercase tracking-widest">{task.areaName || task.clientName || 'General'}</p>
                            <p className="text-[9px] text-primary/40 italic line-clamp-1 mt-1">"{task.aiNotes || 'Sin notas de IA'}"</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedTaskForReview(task);
                            // Modal nested handle needed? No, AnimatePresence handles layers
                          }}
                          className="px-6 py-3 bg-error text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-xl shadow-error/20 hover:scale-105 transition-all"
                        >
                          Examinar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {activeAlertTab === 'audits' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lowScoreAudits.length === 0 ? (
                      <p className="col-span-2 text-center py-10 text-primary/20 font-black uppercase italic">Sin evidencias de auditoría críticas</p>
                    ) : lowScoreAudits.map(audit => (
                      <div key={audit.id} className="p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-orange-500/30 transition-all flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex flex-col items-center justify-center border border-orange-500/30">
                            <span className="text-lg font-black text-orange-500 leading-none">{audit.aiAnalysis?.score || 0}%</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-white uppercase">{audit.clientName}</p>
                            <p className="text-[10px] text-orange-500/80 font-black uppercase tracking-widest">Evidencia Fotográfica</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedAuditForReview(audit)}
                          className="px-6 py-3 bg-orange-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-xl shadow-orange-500/20"
                        >
                          Atender
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeAlertTab === 'delays' && (
                  <div className="space-y-3">
                    {delayAlerts.length === 0 ? (
                      <p className="text-center py-10 text-primary/20 font-black uppercase italic">Puntualidad al 100% hoy</p>
                    ) : delayAlerts.map((alert, i) => (
                      <div key={i} className="p-6 bg-white/5 rounded-[2rem] border border-white/5 flex justify-between items-center bg-error/5">
                        <div className="flex items-center gap-6">
                           <div className="p-4 bg-error/20 rounded-full">
                             <MapPin className="w-6 h-6 text-error" />
                           </div>
                           <div>
                             <p className="text-xl font-black text-white uppercase tracking-tighter">{alert.name}</p>
                             <p className="text-xs text-error/60 font-black uppercase tracking-[0.2em]">Retraso Crítico en {alert.location}</p>
                             <p className="text-[10px] text-primary/40 uppercase font-bold mt-1 tracking-widest">Hora Esperada: {alert.expected} | GPS Report: Offline</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => toast.info(`Llamando a ${alert.name}...`)}
                          className="px-8 py-4 bg-error text-white font-black rounded-2xl uppercase tracking-widest shadow-2xl shadow-error/20 flex items-center gap-2"
                        >
                          <Phone className="w-4 h-4" />
                          Contactar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-white/5 border-t border-white/5 text-center">
                 <p className="text-[8px] font-black uppercase text-primary/20 tracking-[0.5em]">Sistema de Auditoría Milimétrico v2.0</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedTaskForReview && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTaskForReview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass-panel rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tight">Revisión de Auditoría</h3>
                    <p className="text-xs text-primary/60 font-black uppercase tracking-widest">{selectedTaskForReview.operatorName}</p>
                  </div>
                  <div className="w-16 h-16 bg-error/20 rounded-2xl flex flex-col items-center justify-center border border-error/30">
                    <span className="text-xl font-black text-error">{selectedTaskForReview.score}%</span>
                    <span className="text-[8px] font-black text-error uppercase">Score IA</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="aspect-video rounded-3xl overflow-hidden bg-white/5 border border-white/5">
                    <img 
                      src={selectedTaskForReview.afterPhoto} 
                      alt="Evidencia" 
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <BrainCircuit className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Observaciones de IA</span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed italic">
                      "{selectedTaskForReview.aiNotes || selectedTaskForReview.aiFeedback || "Sin observaciones específicas."}"
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Comentario del Supervisor</label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Escribe el motivo de la aprobación o rechazo..."
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-secondary transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5 flex gap-4">
                <button
                  onClick={handleRejectTask}
                  disabled={isProcessingReview || !reviewNote}
                  className="flex-1 h-14 bg-error/20 text-error border border-error/30 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-error hover:text-white transition-all disabled:opacity-50"
                >
                  {isProcessingReview ? "Procesando..." : "Rechazar Tarea"}
                </button>
                <button
                  onClick={handleApproveTask}
                  disabled={isProcessingReview || !reviewNote}
                  className="flex-1 h-14 bg-secondary text-on-secondary rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-secondary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isProcessingReview ? "Procesando..." : "Aprobar Tarea"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audit Review Modal */}
      <AnimatePresence>
        {selectedAuditForReview && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAuditForReview(null)}
              className="absolute inset-0 bg-background/90 backdrop-blur-md z-[140]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl z-[150]"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic text-orange-500">Revisión de Auditoría</h2>
                    <p className="text-xs text-primary/40 font-bold uppercase tracking-widest">{selectedAuditForReview.clientName}</p>
                  </div>
                  <button onClick={() => setSelectedAuditForReview(null)} className="p-2 hover:bg-white/5 rounded-full">
                    <X className="w-6 h-6 text-primary/40" />
                  </button>
                </div>

                <div className="aspect-video rounded-3xl overflow-hidden border border-white/5 bg-black/50 relative">
                  {selectedAuditForReview.capturedImage ? (
                    <img src={selectedAuditForReview.capturedImage} className="w-full h-full object-cover" alt="Evidencia" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-primary/20 space-y-2">
                       <Camera className="w-12 h-12" />
                       <span className="text-[10px] font-black uppercase">Sin imagen de evidencia</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
                    <span className="text-xl font-black text-orange-500">{selectedAuditForReview.aiAnalysis?.score || 0}%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                    <div className="flex items-center gap-2 mb-1">
                      <BrainCircuit className="w-3 h-3 text-orange-500" />
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Análisis Predictivo de IA</p>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-bold italic">
                      "{selectedAuditForReview.aiAnalysis?.observations || "Análisis visual pendiente."}"
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Observaciones Finales del Supervisor</label>
                    <textarea 
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Escribe el veredicto o correcciones necesarias..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:border-orange-500/50 transition-all min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setSelectedAuditForReview(null)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-primary/60 font-black uppercase tracking-widest text-[10px] border border-white/10"
                  >
                    Posponer
                  </button>
                  <button 
                    id="btn-confirm-audit-review"
                    onClick={handleMarkAuditAsReviewed}
                    className="flex-[2] py-4 rounded-2xl bg-orange-500 text-on-primary font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all"
                  >
                    Finalizar Revisión
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recent Audits */}
      <section className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-secondary" />
          <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Auditorías Recientes</h3>
        </div>
        <div className="space-y-3">
          {auditHistory.map((audit, i) => (
            <div key={audit.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-white uppercase">{audit.clientName || audit.location}</p>
                <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">
                  {audit.operatorName || audit.operator} • {formatDate(audit.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-secondary">{audit.score}%</span>
              </div>
            </div>
          ))}
          {auditHistory.length === 0 && (
            <p className="text-[10px] text-primary/40 text-center py-4 uppercase font-bold tracking-widest">No hay auditorías registradas</p>
          )}
        </div>
      </section>

      {/* Client Intelligence Reports Center */}
      <section className="glass-panel p-6 rounded-3xl space-y-6 border-b-4 border-primary">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Centro de Reportes Estratégicos</h3>
          </div>
          <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-md animate-pulse">LIVE AI</span>
        </div>
        
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">{client.name}</p>
                  <p className="text-[10px] text-primary/40 font-bold uppercase">{client.email || 'Sin correo'}</p>
                </div>
              </div>
              
              <button 
                onClick={() => handleManualClientReport(client)}
                disabled={sendingReportToId === client.id}
                className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary text-primary hover:text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {sendingReportToId === client.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {sendingReportToId === client.id ? "Enviando..." : "Enviar Informe"}
              </button>
            </div>
          ))}
          
          {clients.length === 0 && (
            <p className="text-[10px] text-primary/40 text-center py-4 uppercase font-bold tracking-widest italic">Cargando base de clientes...</p>
          )}
        </div>
        
        <div className="pt-2 px-1">
          <p className="text-[9px] text-primary/40 font-medium uppercase leading-relaxed">
            * El informe incluye análisis de pureza por visión artificial, recomendaciones operativas y resumen ejecutivo de la jornada actual.
          </p>
        </div>
      </section>

      {/* Historial de Reportes Consolidados */}
      <section className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-tertiary" />
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Historial de Reportes IA</h3>
        </div>
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-tertiary" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Reporte {report.type}</span>
                </div>
                <span className="text-[10px] font-bold text-primary/40">{formatDate(report.createdAt)}</span>
              </div>
              <p className="text-xs text-primary/60 line-clamp-2 italic">"{report.summary}"</p>
              <div className="flex gap-4 pt-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-primary/40 uppercase">Eficiencia</span>
                  <span className="text-[10px] font-black text-secondary">{report.kpis?.aiEfficiency}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-primary/40 uppercase">Satisfacción</span>
                  <span className="text-[10px] font-black text-primary">{report.kpis?.satisfaction}%</span>
                </div>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="text-[10px] text-primary/40 text-center py-4 uppercase font-bold tracking-widest">No hay reportes generados aún</p>
          )}
        </div>
      </section>

      {/* AI Insights Modal */}
      <AnimatePresence>
        {showAiPanel && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-sm p-8 rounded-[2.5rem] space-y-6 relative border border-primary/20"
            >
              <button 
                onClick={() => setShowAiPanel(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto border border-primary/20">
                  <BrainCircuit className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Predicciones IA</h3>
                <p className="text-xs text-primary/60 font-medium">Análisis de Riesgos y Ausentismo</p>
              </div>

              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 max-h-[40vh] overflow-y-auto scrollbar-hide flex flex-col relative">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Analizando patrones...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary sticky top-0 bg-background/50 backdrop-blur-md py-1 -mt-1 z-10">
                      <Sparkles className="w-4 h-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Insight Generado</p>
                    </div>
                    <p className="text-xs text-primary/80 leading-relaxed whitespace-pre-wrap">
                      {aiInsights}
                    </p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowAiPanel(false)}
                className="w-full h-14 bg-primary text-on-primary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Field Audit Modal */}
      <AnimatePresence>
        {showAudit && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-sm p-8 rounded-3xl space-y-6"
            >
              <div className="text-center space-y-2">
                <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
                <h3 className="text-xl font-black font-headline text-white uppercase tracking-tighter">Auditoría en Campo</h3>
                <p className="text-xs text-primary/60">Inspección aleatoria de punto de servicio</p>
              </div>

              <form onSubmit={handleAuditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Punto de Servicio</label>
                  <select 
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-primary outline-none appearance-none"
                    value={auditData.location}
                    onChange={e => setAuditData({...auditData, location: e.target.value})}
                    required
                  >
                    <option value="" className="bg-[#0f172a]">Seleccionar Cliente...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.name} className="bg-[#0f172a]">{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Personal Auditado</label>
                  <select 
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-primary outline-none appearance-none"
                    value={auditData.operator}
                    onChange={e => setAuditData({...auditData, operator: e.target.value})}
                    required
                  >
                    <option value="" className="bg-[#0f172a]">Seleccionar Operador...</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.name} className="bg-[#0f172a]">{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Calificación Obra: {auditData.score}%</label>
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    className="w-full h-2 bg-white/10 rounded-full appearance-none accent-primary"
                    value={auditData.score}
                    onChange={e => setAuditData({...auditData, score: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Hallazgos y Observaciones</label>
                  <textarea 
                    placeholder="Describa el estado del servicio..."
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-primary outline-none resize-none"
                    value={auditData.notes}
                    onChange={e => setAuditData({...auditData, notes: e.target.value})}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAudit(false)}
                    className="flex-1 h-12 bg-white/5 text-primary/60 rounded-xl text-xs font-bold uppercase"
                  >
                    Cerrar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] h-12 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar Auditoría"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showLog && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-sm p-8 rounded-3xl space-y-6"
            >
              <div className="text-center space-y-2">
                <Truck className="w-10 h-10 text-secondary mx-auto" />
                <h3 className="text-xl font-black font-headline text-white uppercase tracking-tighter">Bitácora de Salida</h3>
                <p className="text-xs text-primary/60">Registra el estado de la unidad e insumos</p>
              </div>

              <form onSubmit={handleLogSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Kilometraje Inicial</label>
                  <input 
                    type="number" 
                    placeholder="Ej: 45200"
                      value={vehicleLog.mileage}
                      onChange={e => setVehicleLog({...vehicleLog, mileage: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Nivel de Combustible</label>
                    <select 
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm focus:border-secondary outline-none"
                      value={vehicleLog.fuel}
                      onChange={e => setVehicleLog({...vehicleLog, fuel: e.target.value})}
                    >
                      <option value="full">Lleno</option>
                      <option value="3/4">3/4</option>
                      <option value="1/2">1/2</option>
                      <option value="1/4">1/4</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest px-1">Insumos Cargados</label>
                    <textarea 
                      placeholder="Ej: 5L Cloro, 10 paquetes bolsas..."
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-secondary outline-none resize-none"
                      value={vehicleLog.supplies}
                      onChange={e => setVehicleLog({...vehicleLog, supplies: e.target.value})}
                      required
                    />
                  </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowLog(false)}
                    className="flex-1 h-12 bg-white/5 text-primary/60 rounded-xl text-xs font-bold uppercase"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] h-12 bg-secondary text-on-secondary rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Registro"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
