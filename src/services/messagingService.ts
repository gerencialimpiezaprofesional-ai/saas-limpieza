/**
 * Impeccable AI - Messaging Service
 * Handles simulated integrations with WhatsApp (Twilio/Meta) and Telegram.
 * In a production environment, this would call real API endpoints.
 */

export interface MessagePayload {
  to: string;
  body: string;
  mediaUrl?: string;
  type: 'whatsapp' | 'telegram';
}

export const sendWarModeAlert = async (supervisorPhone: string, operatorName: string, clientName: string, minutesLate: number) => {
  console.log(`[WhatsApp CRÍTICO] Alertando a Supervisor (${supervisorPhone})`);
  const body = `⚠️ ALERTA MODO GUERRA: El operador ${operatorName} tiene un retraso de ${minutesLate} minutos en el cliente ${clientName}. Acciones inmediatas requeridas.`;
  
  // Integración Robusta con OpenClaw (n8n / Evolution API)
  const openClawUrl = import.meta.env.VITE_OPENCLAW_URL;
  const apiKey = import.meta.env.VITE_OPENCLAW_API_KEY;

  if (openClawUrl) {
    try {
      await fetch(`${openClawUrl}/cleanflow-alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          type: 'war_mode',
          phone: supervisorPhone,
          message: body,
          tenantId: "colossus_master_001",
          metadata: { operatorName, clientName, minutesLate, timestamp: new Date().toISOString() }
        })
      });
      console.log("[OpenClaw] Comando enviado a la IA Autónoma.");
    } catch (error) {
      console.error("[OpenClaw] Fallo en la conexión con el VPS:", error);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 800));
  return { success: true, messageId: `war-${Date.now()}` };
};

export const notifySupervisorTaskRejection = async (supervisorPhone: string, operatorName: string, taskTitle: string, score: number, observations: string) => {
  console.log(`[WhatsApp RECHAZO] Notificando a Supervisor (${supervisorPhone})`);
  const body = `⚠️ TAREA RECHAZADA POR IA: La tarea "${taskTitle}" realizada por ${operatorName} obtuvo un score de ${score}%. 
  Observaciones: ${observations}
  Se requiere atención inmediata.`;
  
  const openClawUrl = import.meta.env.VITE_OPENCLAW_URL;
  const apiKey = import.meta.env.VITE_OPENCLAW_API_KEY;

  if (openClawUrl) {
    try {
      await fetch(`${openClawUrl}/cleanflow-alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          type: 'task_rejection',
          phone: supervisorPhone,
          message: body,
          tenantId: "colossus_master_001",
          metadata: { operatorName, taskTitle, score, observations, timestamp: new Date().toISOString() }
        })
      });
    } catch (error) {
      console.error("[OpenClaw] Error enviando rechazo:", error);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 800));
  return { success: true };
};

export const sendDigitalCertificate = async (clientName: string, phoneNumber: string, purityScore: number, qrUrl: string) => {
  const body = `Espacio validado por Impeccable AI ✨: ${purityScore}% de pureza. Cliente: ${clientName}. Ver certificado aquí: ${qrUrl}`;
  console.log(`[WhatsApp] Enviando Certificado Digital a ${phoneNumber}`);
  
  const openClawUrl = import.meta.env.VITE_OPENCLAW_URL;
  const apiKey = import.meta.env.VITE_OPENCLAW_API_KEY;

  if (openClawUrl) {
    try {
      await fetch(`${openClawUrl}/cleanflow-alerts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          type: 'certificate',
          phone: phoneNumber,
          message: body,
          tenantId: "colossus_master_001",
          metadata: { clientName, purityScore, qrUrl, timestamp: new Date().toISOString() }
        })
      });
      console.log("[OpenClaw] Certificado enviado a través de la IA Autónoma.");
    } catch (error) {
      console.error("[OpenClaw] Error enviando certificado a OpenClaw:", error);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  return { success: true, messageId: `wa-${Math.random().toString(36).substr(2, 9)}` };
};

export const notifyOperatorTask = async (operatorTelegramId: string, taskTitle: string, clientName: string) => {
  console.log(`[Telegram] Notificando a Operador (${operatorTelegramId})`);
  console.log(`[Telegram] Nueva Tarea: ${taskTitle} en ${clientName}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { success: true, messageId: `tg-${Math.random().toString(36).substr(2, 9)}` };
};

export const simulateRHWebhook = async (candidateName: string, message: string) => {
  console.log(`[Webhook] Recibiendo mensaje de WhatsApp de candidato: ${candidateName}`);
  console.log(`[Webhook] Contenido: "${message}"`);
  
  // Aquí Gemini analizaría el mensaje para extraer datos
  const mockAnalysis = {
    score: 85,
    role: "Operador",
    status: "interview",
    name: candidateName
  };
  
  return mockAnalysis;
};
