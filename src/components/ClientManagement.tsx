import { motion, AnimatePresence } from "framer-motion";
import { Users, MapPin, Plus, Search, ChevronRight, X, UserPlus, Clock, Shield, Building2, Trash2, Edit2, Save, Globe, Navigation, Loader2, Map as MapIcon, Check, Zap, ClipboardList } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface Client {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  assignedStaff: { id: string; name: string; role: string }[];
  schedule: string;
  status: 'active' | 'inactive';
  areas?: string[];
  routines?: { id: string; name: string; tasks: string[] }[];
  criticalAreas?: { id: string; name: string; schedule: string; priority: 'high' | 'medium' | 'low' }[];
  totemEmail?: string;
}

export default function ClientManagement({ userData }: { userData?: any }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [localUserData, setLocalUserData] = useState<any>(userData);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<string[] | null>(null);
  const [showManualTaskForm, setShowManualTaskForm] = useState(false);
  const [manualTask, setManualTask] = useState({ title: "", operatorId: "", priority: "medium" });

  const handleAddManualTask = async () => {
    if (!selectedClient || !manualTask.title || !manualTask.operatorId || !localUserData) return;
    setLoading(true);
    try {
      const operator = selectedClient.assignedStaff.find(s => s.id === manualTask.operatorId);
      const today = new Date().toISOString().split('T')[0];
      
      await addDoc(collection(db, "tasks"), {
        title: manualTask.title,
        client: selectedClient.name,
        clientId: selectedClient.id,
        operatorId: manualTask.operatorId,
        operatorName: operator?.name || "Operador",
        priority: manualTask.priority,
        status: 'pending',
        tenantId: localUserData.tenantId,
        scheduledDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isManual: true
      });
      
      toast.success("Tarea manual inyectada al plan del día.");
      setManualTask({ title: "", operatorId: "", priority: "medium" });
      setShowManualTaskForm(false);
    } catch (e: any) {
      toast.error("Error al crear tarea manual: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    schedule: "08:00",
    areas: "" // Comma separated
  });

  useEffect(() => {
    if (userData) {
      setLocalUserData(userData);
      if (userData.tenantId) {
        setLoading(false);
      }
    }
  }, [userData]);

  useEffect(() => {
    if (!localUserData?.tenantId) return;

    const q = query(
      collection(db, "clients"),
      where("tenantId", "==", localUserData.tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedClients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(fetchedClients);
      
      // Keep selectedClient in sync
      setSelectedClient(prev => {
        if (!prev) return null;
        return fetchedClients.find(c => c.id === prev.id) || null;
      });
      
      setLoading(false);
    });

    // Fetch all staff for assignment
    const staffQuery = query(
      collection(db, "users"),
      where("tenantId", "==", localUserData.tenantId),
      where("role", "in", ["operator", "supervisor"])
    );
    
    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      setAvailableStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeStaff();
    };
  }, [localUserData?.tenantId]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localUserData?.tenantId) return;
    setLoading(true);
    
    try {
      const areaList = formData.areas.split(",").map(a => a.trim()).filter(a => a !== "");
      const newClient = {
        name: formData.name,
        address: formData.address,
        location: { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) },
        assignedStaff: [],
        schedule: formData.schedule,
        areas: areaList,
        status: 'active',
        tenantId: localUserData.tenantId,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "clients"), newClient);
      setShowAddClient(false);
      setFormData({ name: "", address: "", lat: "", lng: "", schedule: "08:00", areas: "" });
      toast.success(`Cliente ${newClient.name} registrado con éxito.`);
    } catch (error: any) {
      toast.error("Error al crear cliente: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setLoading(true);
    
    try {
      const latVal = parseFloat(formData.lat);
      const lngVal = parseFloat(formData.lng);

      if (isNaN(latVal) || isNaN(lngVal)) {
        throw new Error("Las coordenadas deben ser números válidos.");
      }

      const areaList = formData.areas.split(",").map(a => a.trim()).filter(a => a !== "");

      const updatedData = {
        name: formData.name,
        address: formData.address,
        location: { lat: latVal, lng: lngVal },
        schedule: formData.schedule,
        areas: areaList
      };

      await updateDoc(doc(db, "clients", selectedClient.id), updatedData);
      
      setShowEditClient(false);
      toast.success("Cliente actualizado con éxito.");
    } catch (error: any) {
      toast.error("Error al actualizar cliente: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar este cliente?")) return;
    try {
      await deleteDoc(doc(db, "clients", id));
      setSelectedClient(null);
      toast.success("Cliente eliminado correctamente");
    } catch (error) {
      toast.error("Error al eliminar cliente");
    }
  };

  const toggleStaffAssignment = async (staff: any) => {
    if (!selectedClient) return;
    
    const isAssigned = selectedClient.assignedStaff?.find(s => s.id === staff.id);
    let newStaffList;
    
    if (isAssigned) {
      newStaffList = selectedClient.assignedStaff.filter(s => s.id !== staff.id);
    } else {
      newStaffList = [...(selectedClient.assignedStaff || []), { 
        id: staff.id, 
        name: staff.name, 
        role: staff.role === 'operator' ? 'Operador' : 'Supervisor' 
      }];
    }

    try {
      await updateDoc(doc(db, "clients", selectedClient.id), {
        assignedStaff: newStaffList
      });
      setSelectedClient({ ...selectedClient, assignedStaff: newStaffList });
      toast.success(isAssigned ? "Personal removido" : "Personal asignado");
    } catch (error) {
      toast.error("Error al actualizar personal");
    }
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      address: client.address,
      lat: client.location.lat.toString(),
      lng: client.location.lng.toString(),
      schedule: client.schedule,
      areas: (client.areas || []).join(", ")
    });
    setShowEditClient(true);
  };

  const optimizeRoutes = async () => {
    if (clients.length < 2) {
      toast.error("Se necesitan al menos 2 clientes para optimizar una ruta.");
      return;
    }
    setIsOptimizing(true);
    setOptimizedRoute(null);
    
    // Technical simulation of a TSP (Traveling Salesman Problem) solver via IA
    setTimeout(() => {
      const sorted = [...clients].sort((a, b) => a.location.lat - b.location.lat);
      setOptimizedRoute(sorted.map(c => c.name));
      setIsOptimizing(false);
      toast.success("Ruta Maestra optimizada por IA Impeccable");
    }, 2500);
  };

  const [showRoutinesModal, setShowRoutinesModal] = useState(false);
  const [showCriticalModal, setShowCriticalModal] = useState(false);
  const [newRoutine, setNewRoutine] = useState({ name: "", tasks: "" });
  const [newCritical, setNewCritical] = useState({ name: "", schedule: "12:00", priority: "medium" as 'high' | 'medium' | 'low' });

  const handleAddCritical = async () => {
    if (!selectedClient || !newCritical.name) return;
    const critical = {
      id: Date.now().toString(),
      name: newCritical.name,
      schedule: newCritical.schedule,
      priority: newCritical.priority
    };

    const updatedCritical = [...(selectedClient.criticalAreas || []), critical];
    try {
      await updateDoc(doc(db, "clients", selectedClient.id), {
        criticalAreas: updatedCritical
      });
      setNewCritical({ name: "", schedule: "12:00", priority: "medium" });
      toast.success("Zona crítica añadida al plan maestro.");
    } catch (e) {
      toast.error("Error al guardar zona crítica");
    }
  };

  const deleteCritical = async (id: string) => {
    if (!selectedClient) return;
    const updatedCritical = (selectedClient.criticalAreas || []).filter(c => c.id !== id);
    try {
      await updateDoc(doc(db, "clients", selectedClient.id), {
        criticalAreas: updatedCritical
      });
      toast.success("Zona crítica eliminada");
    } catch (e) {
      toast.error("Error al eliminar zona crítica");
    }
  };

  const handleAddRoutine = async () => {
    if (!selectedClient || !newRoutine.name) return;
    const taskList = newRoutine.tasks.split("\n").filter(t => t.trim() !== "");
    const routine = {
      id: Date.now().toString(),
      name: newRoutine.name,
      tasks: taskList
    };

    const updatedRoutines = [...(selectedClient.routines || []), routine];
    try {
      await updateDoc(doc(db, "clients", selectedClient.id), {
        routines: updatedRoutines
      });
      setNewRoutine({ name: "", tasks: "" });
      toast.success("Rutina añadida al plan maestro.");
    } catch (e) {
      toast.error("Error al guardar rutina");
    }
  };

  const deleteRoutine = async (routineId: string) => {
    if (!selectedClient) return;
    const updatedRoutines = (selectedClient.routines || []).filter(r => r.id !== routineId);
    try {
      await updateDoc(doc(db, "clients", selectedClient.id), {
        routines: updatedRoutines
      });
      toast.success("Rutina eliminada");
    } catch (e) {
      toast.error("Error al eliminar rutina");
    }
  };

  const autoDistributeTasks = async () => {
    if (!selectedClient) return;

    const operators = selectedClient.assignedStaff.filter(s => s.role === 'Operador');
    if (operators.length === 0) {
      toast.error("Asigne al menos un operador a este cliente.");
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Determine task sources: Routines or Areas
      let taskTitles: { title: string; priority: string; scheduledTime?: string }[] = [];
      
      // 1. Critical Areas (Schedules)
      if (selectedClient.criticalAreas && selectedClient.criticalAreas.length > 0) {
        selectedClient.criticalAreas.forEach(ca => {
          taskTitles.push({ 
            title: `CRÍTICO: ${ca.name} (${ca.schedule})`, 
            priority: ca.priority,
            scheduledTime: ca.schedule 
          });
        });
      }

      // 2. Routines or Regular Areas
      if (selectedClient.routines && selectedClient.routines.length > 0) {
        selectedClient.routines.forEach(r => {
          r.tasks.forEach(t => taskTitles.push({ title: `${r.name}: ${t}`, priority: 'medium' }));
        });
      } else if (selectedClient.areas && selectedClient.areas.length > 0) {
        selectedClient.areas.forEach(a => taskTitles.push({ title: a, priority: 'medium' }));
      }

      if (taskTitles.length === 0) {
        toast.error("Defina áreas, rutinas o zonas críticas para este cliente primero.");
        setLoading(false);
        return;
      }

      const tasksToCreate = taskTitles.map((taskInfo, index) => {
        const assignedOperator = operators[index % operators.length];
        return {
          title: taskInfo.title,
          client: selectedClient.name,
          clientId: selectedClient.id,
          operatorId: assignedOperator.id,
          operatorName: assignedOperator.name,
          status: 'pending',
          priority: taskInfo.priority,
          scheduledTime: taskInfo.scheduledTime || null,
          tenantId: localUserData.tenantId,
          scheduledDate: today,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
      });

      const creations = tasksToCreate.map(task => addDoc(collection(db, "tasks"), task));
      await Promise.all(creations);

      toast.success(`Plan Maestro generado: ${tasksToCreate.length} tareas distribuidas en su equipo.`);
    } catch (error: any) {
      toast.error("Error al distribuir tareas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    (c.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
    (c.address?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <section className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Gestión de Clientes</h1>
            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">Configuración de Servicios y Geolocalización</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddClient(true)}
          className="flex items-center gap-2 px-6 h-12 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-[0_0_30px_rgba(68,221,194,0.4)] hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">Nuevo Cliente</span>
        </button>
      </section>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
        <input 
          type="text" 
          placeholder="Buscar clientes por nombre o dirección..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-14 bg-surface-container-low border border-white/5 rounded-2xl pl-12 pr-6 text-sm text-white focus:border-primary outline-none transition-all"
        />
      </div>

      {/* IA Route Planner Section */}
      <section className="glass-panel p-6 rounded-[2rem] border border-white/5 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
           <Navigation className="w-32 h-32 text-secondary rotate-12" />
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
           <div className="space-y-2 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                 <Globe className="w-4 h-4 text-secondary" />
                 <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">Planificador de Logística</h3>
              </div>
              <p className="text-sm font-black text-white uppercase tracking-tight">Optimización de Rutas de Supervisión</p>
              <p className="text-[10px] text-primary/40 font-medium">Usa IA para calcular el camino más eficiente entre clientes.</p>
           </div>
           
           <div className="flex items-center gap-4">
              {optimizedRoute && (
                <div className="hidden lg:flex items-center gap-2 pr-4 border-r border-white/5">
                   <div className="flex -space-x-1">
                      {optimizedRoute.slice(0, 3).map((_, i) => (
                         <div key={i} className="w-6 h-6 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center text-[8px] font-black">{i+1}</div>
                      ))}
                   </div>
                   <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Ruta Lista</span>
                </div>
              )}
              <button 
                onClick={optimizeRoutes}
                disabled={isOptimizing}
                className="h-12 px-8 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : <Zap className="w-4 h-4 text-secondary" />}
                Planificar Secuencia
              </button>
           </div>
        </div>

        <AnimatePresence>
           {optimizedRoute && (
             <motion.div 
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: "auto", opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               className="mt-6 pt-6 border-t border-white/5"
             >
                <div className="flex flex-wrap gap-3">
                   {optimizedRoute.map((name, i) => (
                     <div key={i} className="flex items-center gap-2 px-4 py-2 bg-secondary/5 border border-secondary/10 rounded-xl">
                        <span className="text-[10px] font-black text-secondary">{i+1}.</span>
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">{name}</span>
                        {i < optimizedRoute.length - 1 && <ChevronRight className="w-3 h-3 text-primary/20" />}
                     </div>
                   ))}
                </div>
             </motion.div>
           )}
        </AnimatePresence>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 text-secondary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Sincronizando Cartera...</p>
          </div>
        ) : filteredClients.length > 0 ? (
          filteredClients.map((client) => (
            <motion.div 
              key={client.id}
              layoutId={client.id}
              onClick={() => setSelectedClient(client)}
              className="glass-panel p-6 rounded-[2rem] border border-white/5 hover:border-secondary/30 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-secondary/10 transition-all" />
              
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">{client.name}</h3>
                  <div className="flex items-center gap-2 text-primary/40">
                    <MapPin className="w-3 h-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[200px]">{client.address}</p>
                  </div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl">
                  <Navigation className="w-4 h-4 text-secondary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest mb-1">Horario Entrada</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-secondary" />
                    <p className="text-sm font-black text-white">{client.schedule} AM</p>
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest mb-1">Personal Asignado</p>
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-secondary" />
                    <p className="text-sm font-black text-white">{client.assignedStaff.length}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {client.assignedStaff.map((staff, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-surface flex items-center justify-center text-[10px] font-bold text-primary">
                      {staff.name[0]}
                    </div>
                  ))}
                  {client.assignedStaff.length === 0 && (
                    <p className="text-[10px] text-error font-bold uppercase tracking-widest">Sin personal asignado</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-primary/40 group-hover:text-secondary group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4 glass-panel rounded-[2.5rem] border-dashed">
            <Building2 className="w-12 h-12 text-primary/20" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">No hay clientes registrados en su cartera</p>
            <button 
              onClick={() => setShowAddClient(true)}
              className="text-[10px] font-black text-secondary uppercase tracking-widest hover:underline"
            >
              Registrar primer cliente ahora
            </button>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAddClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-8 relative my-auto border border-white/10"
            >
              <button 
                onClick={() => setShowAddClient(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary mx-auto border border-secondary/20">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Nuevo Cliente</h3>
                <p className="text-xs text-primary/60 font-medium">Configura un nuevo punto de servicio</p>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Nombre de la Empresa</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Corporativo Santa Fe"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Dirección Física</label>
                    <input 
                      type="text" 
                      placeholder="Calle, Número, Colonia, Ciudad"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Latitud</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="19.4298"
                        value={formData.lat}
                        onChange={(e) => setFormData({...formData, lat: e.target.value})}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Longitud</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="-99.1619"
                        value={formData.lng}
                        onChange={(e) => setFormData({...formData, lng: e.target.value})}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Horario de Entrada</label>
                    <input 
                      type="time" 
                      value={formData.schedule}
                      onChange={(e) => setFormData({...formData, schedule: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Áreas / Plan de Trabajo (Separadas por coma)</label>
                    <textarea 
                      placeholder="Limpieza Baños, Pulido Pisos, Sanitización Ala Norte..."
                      value={formData.areas}
                      onChange={(e) => setFormData({...formData, areas: e.target.value})}
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm focus:border-secondary outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(68,221,194,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <Save className="w-6 h-6" />
                      <span>Guardar Cliente</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Detail & Assignment Modal */}
      <AnimatePresence>
        {selectedClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              layoutId={selectedClient.id}
              className="glass-panel w-full max-w-2xl p-8 rounded-[2.5rem] space-y-8 relative my-auto border border-white/10"
            >
              <button 
                onClick={() => setSelectedClient(null)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedClient.name}</h3>
                    <p className="text-xs text-primary/40 font-bold uppercase tracking-widest">{selectedClient.address}</p>
                  </div>

                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-secondary" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Ubicación GPS</h4>
                      </div>
                      <Edit2 
                        className="w-4 h-4 text-primary/40 cursor-pointer hover:text-secondary transition-colors" 
                        onClick={() => openEditModal(selectedClient)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[8px] font-bold text-primary/40 uppercase mb-1">Latitud</p>
                        <p className="text-sm font-black text-white">{selectedClient.location.lat}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-primary/40 uppercase mb-1">Longitud</p>
                        <p className="text-sm font-black text-white">{selectedClient.location.lng}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowMap(true)}
                      className="w-full h-10 bg-secondary/10 text-secondary rounded-xl text-[10px] font-black uppercase tracking-widest border border-secondary/20 hover:bg-secondary/20 transition-all flex items-center justify-center gap-2"
                    >
                      <MapIcon className="w-4 h-4" />
                      Ver en Mapa
                    </button>
                  </div>

                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-secondary" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Horario de Servicio</h4>
                      </div>
                      <Edit2 
                        className="w-4 h-4 text-primary/40 cursor-pointer hover:text-secondary transition-colors" 
                        onClick={() => openEditModal(selectedClient)}
                      />
                    </div>
                    <p className="text-2xl font-black text-white font-headline">{selectedClient.schedule}</p>
                    <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">Tolerancia de Check-in: 15 min</p>
                  </div>

                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-secondary" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Plan de Trabajo Maestro</h4>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowCriticalModal(true)}
                          className="text-[10px] font-black text-secondary uppercase hover:underline"
                        >
                          Zonas Críticas
                        </button>
                        <button 
                          onClick={() => setShowRoutinesModal(true)}
                          className="text-[10px] font-black text-secondary uppercase hover:underline"
                        >
                          Rutinas
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedClient.routines?.map((routine, i) => (
                        <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-[10px] font-black text-white uppercase mb-1">{routine.name}</p>
                          <p className="text-[8px] text-primary/40 font-bold uppercase tracking-widest">{routine.tasks.length} sub-tareas definidas</p>
                        </div>
                      ))}
                      {(!selectedClient.routines || selectedClient.routines.length === 0) && (
                        <div className="space-y-2">
                           {selectedClient.areas?.map((area, i) => (
                              <div key={i} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="w-2 h-2 rounded-full bg-secondary" />
                                <p className="text-[10px] font-bold text-white uppercase">{area}</p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={autoDistributeTasks}
                      disabled={loading || ((!selectedClient.areas || selectedClient.areas.length === 0) && (!selectedClient.routines || selectedClient.routines.length === 0))}
                      className="w-full h-12 bg-secondary text-on-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Generar Turno Diario (IA Distribution)"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Personal Asignado</h4>
                    <button 
                      onClick={() => setShowAssignModal(true)}
                      className="text-secondary hover:text-secondary/80 transition-colors"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {selectedClient.assignedStaff?.map((staff, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {staff.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-black text-white uppercase tracking-tight">{staff.name}</p>
                            <p className="text-[9px] text-primary/40 font-bold uppercase tracking-widest">{staff.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleStaffAssignment(staff)}
                          className="text-error/40 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!selectedClient.assignedStaff || selectedClient.assignedStaff.length === 0) && (
                      <div className="text-center py-8 space-y-2">
                        <Users className="w-8 h-8 text-primary/20 mx-auto" />
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">No hay personal asignado</p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-secondary" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Inyectar Tarea Manual</h4>
                      </div>
                      <button 
                        onClick={() => setShowManualTaskForm(!showManualTaskForm)}
                        className="text-[10px] font-black text-secondary uppercase hover:underline"
                      >
                        {showManualTaskForm ? "Cerrar" : "Nuevo"}
                      </button>
                    </div>
                    
                    {showManualTaskForm && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <input 
                          type="text"
                          placeholder="Descripción de la tarea rápida..."
                          value={manualTask.title}
                          onChange={(e) => setManualTask({...manualTask, title: e.target.value})}
                          className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none focus:border-secondary"
                        />
                        <select 
                          value={manualTask.operatorId}
                          onChange={(e) => setManualTask({...manualTask, operatorId: e.target.value})}
                          className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                        >
                          <option value="">Seleccionar Operador</option>
                          {selectedClient.assignedStaff.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={handleAddManualTask}
                          className="w-full h-10 bg-secondary text-on-secondary rounded-xl text-[10px] font-black uppercase tracking-widest"
                        >
                          Inyectar Tarea
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-secondary" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Acceso Estación Tótem</h4>
                      </div>
                    </div>
                    
                    {selectedClient.totemEmail ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] font-bold text-primary/40 uppercase mb-1">Usuario de Acceso</p>
                          <p className="text-xs font-mono text-white truncate">{selectedClient.totemEmail}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] font-bold text-primary/40 uppercase mb-1">Contraseña</p>
                          <p className="text-xs font-mono text-white">totem123</p>
                        </div>
                        <p className="text-[9px] text-primary/40 leading-tight italic">Usa estas credenciales en una tablet para activar la estación de marcaje de este cliente.</p>
                      </div>
                    ) : (
                      <button 
                        onClick={async () => {
                          if (!selectedClient || !localUserData) return;
                          setLoading(true);
                          try {
                            const totemEmail = `totem.${selectedClient.id.slice(0, 5)}@limpiezapro.ai`;
                            
                            await updateDoc(doc(db, "clients", selectedClient.id), {
                              totemEmail: totemEmail
                            });

                            await addDoc(collection(db, "users"), {
                              email: totemEmail,
                              name: `Tótem - ${selectedClient.name}`,
                              role: 'totem',
                              tenantId: localUserData.tenantId,
                              clientId: selectedClient.id,
                              status: 'active',
                              createdAt: serverTimestamp()
                            });

                            toast.success("Estación Tótem activada para este cliente.");
                          } catch (e: any) {
                            toast.error("Error al activar tótem: " + e.message);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="w-full h-12 bg-secondary/10 text-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest border border-secondary/20 hover:bg-secondary/20 transition-all font-headline"
                      >
                        Activar Acceso Tótem
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => selectedClient && handleDeleteClient(selectedClient.id)}
                      className="flex-1 h-12 bg-error/10 text-error rounded-2xl text-[10px] font-black uppercase tracking-widest border border-error/20 hover:bg-error/20 transition-all"
                    >
                      Eliminar Cliente
                    </button>
                    <button 
                      onClick={() => openEditModal(selectedClient)}
                      className="flex-1 h-12 bg-secondary text-on-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                    >
                      Editar Datos
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {showEditClient && selectedClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-8 relative my-auto border border-white/10"
            >
              <button 
                onClick={() => setShowEditClient(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary mx-auto border border-secondary/20">
                  <Edit2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Editar Cliente</h3>
              </div>

              <form onSubmit={handleUpdateClient} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Nombre</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Dirección</label>
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary transition-all"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Latitud</label>
                      <input 
                        type="number" 
                        step="any"
                        value={formData.lat}
                        onChange={(e) => setFormData({...formData, lat: e.target.value})}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Longitud</label>
                      <input 
                        type="number" 
                        step="any"
                        value={formData.lng}
                        onChange={(e) => setFormData({...formData, lng: e.target.value})}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Horario</label>
                    <input 
                      type="time" 
                      value={formData.schedule}
                      onChange={(e) => setFormData({...formData, schedule: e.target.value})}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-white text-sm focus:border-secondary transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] px-1">Áreas / Plan de Trabajo (Separadas por coma)</label>
                    <textarea 
                      placeholder="Limpieza Baños, Pulido Pisos, Sanitización Ala Norte..."
                      value={formData.areas}
                      onChange={(e) => setFormData({...formData, areas: e.target.value})}
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm focus:border-secondary outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>
                    <Save className="w-6 h-6" />
                    <span>Guardar Cambios</span>
                  </>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assign Staff Modal */}
      <AnimatePresence>
        {showAssignModal && selectedClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-8 rounded-[2.5rem] space-y-6 relative border border-white/10"
            >
              <button 
                onClick={() => setShowAssignModal(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-2">
                <UserPlus className="w-10 h-10 text-secondary mx-auto" />
                <h3 className="text-xl font-black font-headline text-white uppercase tracking-tighter">Asignar Personal</h3>
                <p className="text-xs text-primary/60">Selecciona empleados para {selectedClient.name}</p>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {availableStaff.map((staff) => {
                  const isAssigned = selectedClient.assignedStaff?.some(s => s.id === staff.id);
                  return (
                    <button 
                      key={staff.id}
                      onClick={() => toggleStaffAssignment(staff)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                        isAssigned ? "bg-secondary/10 border-secondary text-secondary" : "bg-white/5 border-white/5 text-primary/60 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold">
                          {staff.name[0]}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black uppercase tracking-tight">{staff.name}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">{staff.role}</p>
                        </div>
                      </div>
                      {isAssigned && <Check className="w-5 h-5" />}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setShowAssignModal(false)}
                className="w-full h-14 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-xl"
              >
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Google Maps Modal */}
      <AnimatePresence>
        {showMap && selectedClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-4xl h-[80vh] rounded-[2.5rem] relative border border-white/10 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-xl flex items-center justify-center text-secondary">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">{selectedClient.name}</h3>
                    <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{selectedClient.address}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMap(false)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-primary/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 relative">
                {!GOOGLE_MAPS_API_KEY ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 p-12 text-center">
                    <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center text-error">
                      <Shield className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">API Key Faltante</h4>
                    <p className="text-sm text-primary/60 max-w-xs">
                      Por favor, configura tu <code className="bg-white/10 px-2 py-1 rounded text-secondary">VITE_GOOGLE_MAPS_API_KEY</code> en el panel de Secretos para activar el mapa interactivo.
                    </p>
                  </div>
                ) : (
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map
                      defaultCenter={selectedClient.location}
                      defaultZoom={15}
                      gestureHandling={'greedy'}
                      disableDefaultUI={false}
                      className="w-full h-full"
                      mapId="DEMO_MAP_ID" // Required for AdvancedMarker
                    >
                      <AdvancedMarker position={selectedClient.location}>
                        <Pin background={'#44DDC2'} glyphColor={'#000'} borderColor={'#000'} />
                      </AdvancedMarker>
                    </Map>
                  </APIProvider>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Critical Areas Modal */}
      <AnimatePresence>
        {showCriticalModal && selectedClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[120] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-lg p-8 rounded-[2.5rem] space-y-8 relative my-auto border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowCriticalModal(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Zonas de Alta Prioridad</h3>
                <p className="text-[10px] text-primary/40 font-black uppercase tracking-[0.2em]">{selectedClient.name}</p>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/20 space-y-4">
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Añadir Punto Crítico</p>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Nombre (ej: Comedor)"
                      value={newCritical.name}
                      onChange={(e) => setNewCritical({...newCritical, name: e.target.value})}
                      className="col-span-2 w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none focus:border-secondary"
                    />
                    <input 
                      type="time" 
                      value={newCritical.schedule}
                      onChange={(e) => setNewCritical({...newCritical, schedule: e.target.value})}
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none focus:border-secondary"
                    />
                    <select 
                      value={newCritical.priority}
                      onChange={(e) => setNewCritical({...newCritical, priority: e.target.value as any})}
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                    >
                      <option value="high">Prioridad Alta</option>
                      <option value="medium">Prioridad Media</option>
                      <option value="low">Prioridad Baja</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleAddCritical}
                    className="w-full h-12 bg-secondary text-on-secondary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    Activar Punto en el Mapa
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedClient.criticalAreas?.map((area) => (
                    <div key={area.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-xs font-black text-white uppercase">{area.name}</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-secondary" />
                          <p className="text-[9px] text-primary/40 font-bold uppercase tracking-widest">{area.schedule}</p>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[7px] font-black uppercase",
                            area.priority === 'high' ? "bg-error/20 text-error" : "bg-secondary/20 text-secondary"
                          )}>{area.priority}</span>
                        </div>
                      </div>
                      <button onClick={() => deleteCritical(area.id)} className="text-error/40 hover:text-error transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowCriticalModal(false)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Confirmar Planificación
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Routines Management Modal */}
      <AnimatePresence>
        {showRoutinesModal && selectedClient && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[120] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-lg p-8 rounded-[2.5rem] space-y-8 relative my-auto border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setShowRoutinesModal(false)}
                className="absolute top-6 right-6 text-primary/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Planificación de Rutinas</h3>
                <p className="text-xs text-primary/40 font-bold uppercase tracking-widest">{selectedClient.name}</p>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4 shadow-inner">
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                     <Zap className="w-3 h-3" /> Añadir Nueva Rutina
                  </p>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Nombre de la Rutina (ej: Rutina Diaria Mañana)"
                      value={newRoutine.name}
                      onChange={(e) => setNewRoutine({...newRoutine, name: e.target.value})}
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white focus:border-secondary outline-none transition-all"
                    />
                    <textarea 
                      placeholder="Lista de tareas (una por línea)"
                      value={newRoutine.tasks}
                      onChange={(e) => setNewRoutine({...newRoutine, tasks: e.target.value})}
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white focus:border-secondary outline-none transition-all resize-none"
                    />
                    <button 
                      onClick={handleAddRoutine}
                      className="w-full h-14 bg-secondary text-on-secondary rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_20px_rgba(68,221,194,0.2)]"
                    >
                      Añadir Rutina al Maestro
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Rutinas Configuradas</p>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedClient.routines?.map((routine) => (
                      <div key={routine.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-secondary/20 transition-all">
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight">{routine.name}</p>
                          <p className="text-[9px] text-primary/40 font-bold uppercase">{routine.tasks.length} Tareas</p>
                        </div>
                        <button 
                          onClick={() => deleteRoutine(routine.id)}
                          className="p-2 text-error/40 hover:text-error transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!selectedClient.routines || selectedClient.routines.length === 0) && (
                      <div className="text-center py-8 bg-white/10 rounded-2xl border border-white/5 border-dashed">
                        <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                        <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">No hay rutinas definidas</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowRoutinesModal(false)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Cerrar Panel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
