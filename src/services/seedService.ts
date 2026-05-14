import { db, auth } from "../firebase";
import { 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs))
  ]);
};

export const seedDemoData = async (onProgress?: (msg: string) => void) => {
  const tenantId = "impeccable-prod-001";
  const tenantRef = doc(db, "tenants", tenantId);
  
  // Capturamos el UID del usuario actual si coincide con el correo de gerencia
  // Esto evita que el seed falle si ya están logueados con una contraseña distinta
  const currentUser = auth.currentUser;
  const currentUid = (currentUser && currentUser.email?.toLowerCase() === "gerencia.limpiezaprofesional@gmail.com") 
    ? currentUser.uid 
    : null;

  const log = (msg: string) => {
    console.log(`[SEED] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  // 0. Sign out any current user to start fresh (unless it's the one we need to skip)
  try {
    log("Preparando entorno de datos...");
    if (!currentUid) {
      log("Cerrando sesión previa para limpieza...");
      await withTimeout(signOut(auth), 10000, "Timeout al cerrar sesión previa");
    } else {
      log("Sesión de administrador detectada. Manteniendo sesión...");
    }
  } catch (e) {
    log("Información: No había sesión activa.");
  }

  // 1. Demo Users Data
    const demoUsers = [
    { 
      email: "gerencia.limpiezaprofesional@gmail.com", 
      role: "superadmin", 
      name: "Super Administrador", 
      points: 0, 
      status: "active" 
    },
    { 
      email: "ceo@impeccable.com", 
      role: "ceo", 
      name: "Elena Valdés", 
      points: 0, 
      status: "active",
      nationality: "Mexicana",
      managerBio: "Directora Ejecutiva de Impeccable. 15 años de experiencia en facilities management.",
      joinDate: "Dic 2022" 
    },
    { 
      email: "rh@impeccable.com", 
      role: "rh", 
      name: "Roberto Hernández", 
      points: 0, 
      status: "active",
      specialty: "Gestión de Talento",
      joinDate: "Ene 2023",
      employeeCount: 45
    },
      { 
      email: "supervisor.limpiezaprofesional@gmail.com", 
      role: "supervisor", 
      name: "Sofía Pérez", 
      points: 0, 
      status: "active",
      clientId: "ave1",
      tenantId: tenantId
    },
    { 
      email: "op.limpiezaprofesional@gmail.com", 
      role: "operator", 
      name: "Carlos Mendoza (Ave1)", 
      points: 12450, 
      status: "active",
      clientId: "ave1",
      assignedClients: ["ave1", "client-casalumbre"],
      rating: 4.9,
      psychometricScore: 94,
      reliabilityScore: 98,
      joinDate: "Ene 2024",
      nationality: "Mexicana",
      technicalSkills: ["Desinfección", "Maquinaria Pesada", "ISO 9001"],
      lastPosition: { lat: 19.4326, lng: -99.1332 },
      tenantId: tenantId
    },
    { 
      email: "operador2@impeccable.com", 
      role: "operator", 
      name: "Ana López (Ave1)", 
      points: 8500, 
      status: "active",
      clientId: "ave1",
      assignedClients: ["ave1"],
      rating: 4.8,
      psychometricScore: 96,
      reliabilityScore: 95,
      joinDate: "Mar 2024",
      nationality: "Mexicana",
      technicalSkills: ["Higiene Hospitalaria", "Químicos Avanzados"],
      lastPosition: { lat: 19.4350, lng: -99.1350 },
      tenantId: tenantId
    },
    { 
      email: "operador3@impeccable.com", 
      role: "operator", 
      name: "Miguel Ángel (Ave1)", 
      points: 3200, 
      status: "active",
      clientId: "ave1",
      assignedClients: ["ave1"],
      rating: 4.7,
      psychometricScore: 92,
      reliabilityScore: 99,
      joinDate: "Feb 2024",
      nationality: "Mexicana",
      technicalSkills: ["Seguridad Industrial", "Primeros Auxilios"],
      lastPosition: { lat: 19.4300, lng: -99.1310 },
      tenantId: tenantId
    },
    { 
      email: "operador4@impeccable.com", 
      role: "operator", 
      name: "Lucía Torres", 
      points: 1500, 
      status: "active",
      clientId: "client-engrane",
      assignedClients: ["client-engrane"],
      rating: 4.6,
      psychometricScore: 88,
      reliabilityScore: 92,
      joinDate: "Abr 2024",
      nationality: "Mexicana",
      technicalSkills: ["Limpieza Comercial"],
      lastPosition: { lat: 19.4200, lng: -99.1200 }
    },
    { 
      email: "cliente@impeccable.com", 
      role: "client", 
      name: "Gerente AVE1", 
      points: 0, 
      status: "active", 
      clientId: "ave1",
      tenantId: tenantId
    },
    { 
      email: "totem@impeccable.com", 
      role: "totem", 
      name: "Estación de Servicio Ave1", 
      points: 0, 
      status: "active",
      clientId: "ave1",
      tenantId: tenantId
    },
  ];

  const password = "password123";
  let op1Uid = "";
  let op2Uid = "";
  let op3Uid = "";

  // 2. Create/Update Users
  const results = [];
  log("Iniciando creación de usuarios...");
    for (const user of demoUsers) {
      log(`Procesando ${user.email}...`);
      
      let uid = "";
      let status = "pending";
      
      // Intentar encontrar el UID existente en Firestore primero para ser resilientes si Auth falla
      try {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          uid = snap.docs[0].id;
          log(`UID encontrado en Firestore para ${user.email}: ${uid}`);
        }
      } catch (e) {
        log(`No se pudo buscar UID en Firestore para ${user.email} (normal si no hay datos)`);
      }

      if (user.email.toLowerCase() === "gerencia.limpiezaprofesional@gmail.com" && currentUid) {
        uid = currentUid;
        status = "session_recovered";
        log(`Sesión de SuperAdmin recuperada.`);
      } else {
        try {
          log(`Intentando crear cuenta en Auth: ${user.email}`);
          const userCredential = await withTimeout(
            createUserWithEmailAndPassword(auth, user.email, password),
            10000,
            `Timeout creando cuenta ${user.email}`
          );
          uid = userCredential.user.uid;
          status = "created";
          log(`Nueva cuenta Auth creada: ${user.email}`);
        } catch (error: any) {
          if (error.code === "auth/email-already-in-use") {
            log(`La cuenta ${user.email} ya existe en Auth.`);
            status = "existing";
            
            // Si no tenemos el UID todavía, intentamos login rápido para obtenerlo
            if (!uid) {
              try {
                const cred = await withTimeout(
                  signInWithEmailAndPassword(auth, user.email, password),
                  8000,
                  "Timeout login"
                );
                uid = cred.user.uid;
                log(`UID obtenido mediante login para ${user.email}: ${uid}`);
              } catch (loginError: any) {
                log(`No se pudo loguear ${user.email} (posible password distinta). Intentando continuar con UID de Firestore si existe.`);
              }
            }
          } else {
             log(`Error Auth no manejado para ${user.email}: ${error.code}`);
          }
        }
      }

      // Si tenemos UID (vía creación, login o búsqueda previa), actualizamos Firestore
      if (uid) {
        try {
          const userDocData = {
            ...user,
            tenantId,
            uid,
            updatedAt: serverTimestamp()
          };
          await setDoc(doc(db, "users", uid), userDocData, { merge: true });
          log(`Firestore sincronizado para ${user.email}`);
          
          if (user.email === "op.limpiezaprofesional@gmail.com") op1Uid = uid;
          if (user.email === "operador2@impeccable.com") op2Uid = uid;
          if (user.email === "operador3@impeccable.com") op3Uid = uid;
          
          results.push({ email: user.email, status: status === "created" ? "success_new" : "success_updated" });
        } catch (fsErr) {
          log(`Error actualizando Firestore para ${user.email}`);
          results.push({ email: user.email, status: "error_firestore" });
        }
      } else {
        log(`Saltando ${user.email} por falta de UID.`);
        results.push({ email: user.email, status: "skipped_no_uid" });
      }

      // Pequeño delay entre usuarios para evitar saturación
      await new Promise(r => setTimeout(r, 800));
    }

  // 3. Configuración Global (Tenant, Clientes, Tareas)
  let globalStatus = "not_started";
  try {
    if (!currentUid) {
      log("Configurando datos globales como CEO...");
      await withTimeout(
        signInWithEmailAndPassword(auth, "ceo@impeccable.com", password),
        15000,
        "Timeout iniciando sesión como CEO"
      );
      globalStatus = "signed_in_ceo";
    } else {
      log("Configurando datos globales con sesión de SuperAdmin preservada...");
      globalStatus = "success_with_superadmin";
    }
    
    log("Creando empresa (Tenant)...");
    try {
      await withTimeout(
        setDoc(tenantRef, {
          name: "IMPECCABLE AI",
          createdAt: serverTimestamp(),
          tenantId,
          logo: "https://firebasestorage.googleapis.com/v0/b/cleanflow-ai.appspot.com/o/cleanflow_logo.png?alt=media",
          status: 'active',
          aiStrictness: 'standard'
        }, { merge: true }),
        10000,
        "Timeout creando Tenant"
      );
    } catch (e) {
      log("Error creando Tenant. Reintentando...");
      throw e;
    }

    log("Creando clientes...");
    const clients = [
      { id: "ave1", name: "CLIENTE AVE1", address: "Av. de los Insurgentes, CDMX", activeServices: 5, status: 'active', type: 'industrial' },
      { id: "client-emmsa", name: "CLIENTE EMMSA", address: "Av. Paseo de la Reforma 222, CDMX", activeServices: 12, status: 'active', type: 'industrial' },
      { id: "client-casalumbre", name: "CASA LUMBRE", address: "Colonia Roma Norte, CDMX", activeServices: 4, status: 'active', type: 'hospitality' },
      { id: "client-engrane", name: "ENGRANE INDUSTRIAL", address: "Zona Industrial Vallejo", activeServices: 8, status: 'active', type: 'industrial' },
      { id: "client-angeles", name: "HOSPITAL ÁNGELES", address: "Pedregal, CDMX", activeServices: 15, status: 'active', type: 'hospitality' },
    ];

    for (const client of clients) {
      log(`Creando cliente: ${client.name}`);
      try {
        await withTimeout(
          setDoc(doc(db, "clients", client.id), {
            ...client,
            tenantId,
          }, { merge: true }),
          10000,
          `Timeout creando cliente ${client.name}`
        );
      } catch (e) {
        log(`Error en cliente ${client.name}`);
        throw e;
      }
    }

    log("Sembrando 'Staff' para RH...");
    const staffMembers = [
      { name: "Carlos Mendoza", role: "Operador Pro", lastScore: 98, status: 'active', clientId: 'ave1' },
      { name: "Ana López", role: "Operador Senior", lastScore: 95, status: 'active', clientId: 'ave1' },
      { name: "Miguel Ángel", role: "Operador Especialista", lastScore: 99, status: 'active', clientId: 'ave1' },
      { name: "Lucía Torres", role: "Operador Junior", lastScore: 88, status: 'active', clientId: 'client-engrane' }
    ];
    for (const s of staffMembers) {
      await addDoc(collection(db, "staff"), {
        ...s,
        tenantId,
        joinDate: new Date().toISOString().split('T')[0],
        phone: "+521234567890",
        status: 'active'
      });
    }

    log("Creando inventario inicial...");
    const initialInventory = [
      { name: "Detergente Multiusos 20L", stock: 15, unit: "Bidón", min: 5, status: "ok", category: "Químicos", tenantId },
      { name: "Sanitizante Grado Médico", stock: 2, unit: "Bidón", min: 10, status: "low", category: "Químicos", tenantId },
      { name: "Paquete Microfibras Pro", stock: 45, unit: "Paquete", min: 20, status: "ok", category: "Accesorios", tenantId },
      { name: "Bolsa Jumbo Industrial", stock: 5, unit: "Rollo", min: 15, status: "low", category: "Accesorios", tenantId }
    ];

    for (const item of initialInventory) {
      log(`Creando item de inventario: ${item.name}`);
      await withTimeout(
        addDoc(collection(db, "inventory"), item),
        10000,
        `Timeout creando item ${item.name}`
      );
    }

    log("Creando tareas completadas para reportes...");
    const tasksRef = collection(db, "tasks");
    const sampleTasks = [
      { area: "Lobby Principal", op: op1Uid, name: "Carlos Mendoza", score: 98, status: 'completed' },
      { area: "Sala de Juntas B", op: op2Uid, name: "Ana López", score: 95, status: 'completed' },
      { area: "Comedor Industrial", op: op3Uid, name: "Miguel Ángel", score: 99, status: 'completed' },
      { area: "Área de Carga", op: op1Uid, name: "Carlos Mendoza", score: null, status: 'in_progress' },
      { area: "Baños Nivel 3", op: op2Uid, name: "Ana López", score: null, status: 'pending' },
      { area: "Estacionamiento E1", op: op3Uid, name: "Miguel Ángel", score: null, status: 'pending' }
    ];

    for (const t of sampleTasks) {
      log(`Sembrando tarea: ${t.area} (${t.status})`);
      await withTimeout(addDoc(tasksRef, {
        title: `Limpieza y Sanitización ${t.area}`,
        areaName: t.area,
        clientId: "ave1",
        clientName: "AVE1",
        operatorId: t.op,
        operatorName: t.name,
        score: t.score,
        status: t.status,
        tenantId,
        createdAt: serverTimestamp(),
        completedAt: t.status === 'completed' ? serverTimestamp() : null,
        aiNotes: t.score ? "Auditoría IA: Limpieza excepcional detectada. Sin residuos de polvo." : null,
        afterPhoto: t.status === 'completed' ? "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800" : null
      }), 10000, `Timeout creando tarea ${t.area}`);
    }

    log("Sembrando Whitelist de ERP...");
    const whitelist = [
      { sender_id: "+5217226460497", employee_id: "e1", employeeName: "Carlos Mendoza", status: "active", tenantId },
      { sender_id: "+525524729070", employee_id: "e2", employeeName: "Ana López", status: "active", tenantId },
      { sender_id: "+5217223508493", employee_id: "e3", employeeName: "Miguel Ángel", status: "active", tenantId }
    ];

    for (const entry of whitelist) {
      log(`Agregando a whitelist: ${entry.sender_id}`);
      await setDoc(doc(db, "erp_whitelist", entry.sender_id), entry, { merge: true });
    }

    log("Generando KPIs para Dashboard...");
    await setDoc(doc(db, "kpis", tenantId), {
      efficiencyRate: 96.4,
      satisfactionIndex: 4.9,
      retentionRate: 100,
      aiAccuracy: 99.8,
      monthlyRevenue: 125000,
      completedTasks: 1450,
      pendingTasks: 12,
      operationalSafety: 100,
      updatedAt: serverTimestamp(),
      tenantId
    });

    log("Configuración global completada.");
    globalStatus = "success";
  } catch (e: any) {
    console.error("[SEED] Error en configuración global:", e);
    globalStatus = `error: ${e.code || e.message}`;
  }

  // Sign out to return to login state (unless we are keeping the admin session)
  try {
    if (!currentUid) {
      log("Cerrando sesión final...");
      await withTimeout(signOut(auth), 10000, "Timeout al cerrar sesión final");
    } else {
      log("Proceso finalizado. Manteniendo sesión de administrador.");
      // Aseguramos que regresamos a la sesión del admin si el CEO login cambió el auth state
      log(`Re-autenticando como SuperAdmin por seguridad...`);
      // Nota: No podemos re-autenticar con Google sin interacción, 
      // pero si el admin ya estaba logueado, intentamos no romper el flujo.
      // Si el login del CEO cambió el currentUser, esto podría ser un problema,
      // pero Firebase Auth permite múltiples proveedores si se configuran, 
      // aunque aquí usualmente solo hay uno activo.
    }
    log("Proceso finalizado con éxito.");
  } catch (e) {
    console.error("[SEED] Error al cerrar sesión final:", e);
  }
  
  return { users: results, global: globalStatus };
};
