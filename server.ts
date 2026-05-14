import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import fs from "fs";

dotenv.config();

// Load Firebase Config
const firebaseConfigPath = path.resolve("firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Greeting State
let greetingIndex = 0;
const SALUDO_VARIANTES = [
  "Hola {name}, que tengas una excelente jornada de trabajo. Gracias por tu check-in.",
  "Buenos días {name}, te deseo un día productivo. Agradecemos tu check-in.",
  "Hola {name}, que tu jornada sea eficiente y segura. Gracias por tu check-in.",
  "Saludos {name}, que tu jornada sea productiva y sin contratiempos. Gracias por tu check-in.",
  "Muy buen día, {name}. Agradecemos tu diligencia en el check-in."
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' })); 

  // Debug middleware to see all requests
  app.use((req, res, next) => {
    if (req.url.includes('webhook')) {
      console.log(`[Server] Incoming request: ${req.method} ${req.url}`);
    }
    next();
  });

  const cleanAIResponse = (text: string) => {
    console.log("[Gemini] Cleaning response text...");
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return text.substring(firstBrace, lastBrace + 1).trim();
    }
    return text.trim();
  };

  // Cache for discovered working models to improve performance
  let cachedImageModel: { version: string, name: string } | null = null;
  let cachedTextModel: { version: string, name: string } | null = null;

  async function discoverModels(apiKey: string) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const listResponse = await fetch(listUrl);
      const listData = await listResponse.json();
      if (listResponse.ok && listData.models) {
        return listData.models
          .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
          .map((m: any) => m.name.replace("models/", ""));
      }
    } catch (e) {
      console.error("[Gemini] discovery failed:", e);
    }
    return [];
  }

  // API Routes
  // API: External Check-in logic (usable by other modules)
  app.post("/api/attendance/checkin", async (req, res) => {
    const { employee_id, timestamp, source, checkin_method, evidence_url, selfie_verified, geolocation_verified, tenantId } = req.body;
    
    try {
      const checkinData = {
        employee_id,
        timestamp: timestamp || new Date().toISOString(),
        source: source || "External",
        checkin_method: checkin_method || "API",
        evidence_url: evidence_url || null,
        selfie_verified: !!selfie_verified,
        geolocation_verified: !!geolocation_verified,
        status: "approved",
        tenantId: tenantId || "impeccable-prod-001",
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "attendance"), checkinData);
      res.status(200).json({ success: true, id: docRef.id, status: "approved" });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // OpenClaw Webhook Integration
  app.post("/api/webhooks/openclaw", async (req, res) => {
    console.log("------------------------------------------");
    console.log("🔔 [OpenClaw Webhook] Request received!");
    
    const payload = req.body;
    const { sender_id, body, timestamp, evidence_url } = payload;
    
    console.log(`[Webhook] Inbound Payload:`, JSON.stringify(payload));

    try {
      // 1. Whitelist Verification
      const whitelistDoc = await getDoc(doc(db, "erp_whitelist", sender_id));
      let isAuthorized = false;
      let employeeId = null;
      let employeeName = "Empleado";

      if (whitelistDoc.exists()) {
        const data = whitelistDoc.data();
        isAuthorized = data.authorized !== false;
        employeeId = data.employee_id;
        employeeName = data.employeeName || data.name || "Rebeca";
        console.log(`[Webhook] Whitelist hit: ${employeeName} (${employeeId})`);
      } else {
        // Fallback Mapping
        const mappingPath = path.resolve("src/data/employee-map.json");
        if (fs.existsSync(mappingPath)) {
          const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
          employeeId = mapping[sender_id];
          isAuthorized = !!employeeId;
          console.log(`[Webhook] Fallback mapping search for ${sender_id}: ${isAuthorized ? 'Found' : 'Not found'}`);
        }
      }

      if (!isAuthorized) {
        console.warn(`[Webhook] Unauthorized sender: ${sender_id}`);
        return res.status(401).json({ 
          status: "unauthorized",
          message: "No autorizado" 
        });
      }

      // 2. Prepare ERP Check-in (Internal Record)
      const erp_payload = {
        employee_id: employeeId,
        timestamp: timestamp || new Date().toISOString(),
        source: "WhatsApp",
        checkin_method: "WhatsApp",
        evidence_url: evidence_url || null,
        selfie_verified: !!evidence_url,
        geolocation_verified: true,
        status: "approved",
        tenantId: "impeccable-prod-001",
        body: body || ""
      };

      // 3. Save to Firestore
      const docRef = await addDoc(collection(db, "attendance"), {
        ...erp_payload,
        createdAt: serverTimestamp()
      });
      
      console.log(`[Webhook] ERP entry success. ID: ${docRef.id}`);

      // 4. Send rotative greeting variant
      const variantTemplate = SALUDO_VARIANTES[greetingIndex % SALUDO_VARIANTES.length];
      const greetingMessage = variantTemplate.replace("{name}", employeeName);
      
      // Rotate index
      greetingIndex = (greetingIndex + 1) % SALUDO_VARIANTES.length;

      console.log(`[Webhook] Outbound WhatsApp reply: "${greetingMessage}" to ${sender_id}`);

      res.status(200).json({ 
        success: true, 
        message: "Webhook received by Impeccable AI",
        receivedAt: new Date().toISOString(),
        status: "approved",
        employee_id: employeeId,
        reply_sent: greetingMessage,
        erp_status: "approved",
        erp_entry_id: docRef.id
      });

    } catch (error: any) {
      console.error("[Webhook] Processing Error:", error);
      res.status(500).json({ 
        status: "error",
        message: "No se pudo procesar el check-in",
        details: error.message 
      });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Analysis Route
  app.post("/api/ai/analyze-image", async (req, res) => {
    const { image, prompt, systemInstruction } = req.body;
    
    // Robust API key retrieval
    let apiKey = (process.env.GEMINI_API_KEY || "").trim();
    // User provided API key: AIzaSyD0vF1IyF6mG_akDgnxiZESn9ukUVunQpQ
    const hardcodedKey = "AIzaSyD0vF1IyF6mG_akDgnxiZESn9ukUVunQpQ";
    
    if (!apiKey || apiKey === "" || apiKey === "undefined" || apiKey === "null" || apiKey.length < 20) {
      apiKey = hardcodedKey;
    }
    
    console.log(`[Gemini] Using key starting with: ${apiKey.substring(0, 8)}...`);

    if (!apiKey || apiKey === "") {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY no configurada." 
      });
    }

    const tryModels = async () => {
      const promptEnforcer = "\n\nCRITICAL: respond with ONLY the JSON object. Do not explain anything outside the JSON structure.";
      
      // Step 1: Use cache if available
      const modelsToTry: {version: string, name: string}[] = [];
      if (cachedImageModel) {
        modelsToTry.push(cachedImageModel);
      }

      // Step 2: Build discovery list if cache is empty or fails
      const discoveredNames = await discoverModels(apiKey);
      const fallbackNames = [
        "gemini-1.5-flash", 
        "gemini-1.5-flash-latest", 
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro"
      ];
      
      const allNames = Array.from(new Set([...discoveredNames, ...fallbackNames]));
      const versions = ["v1", "v1beta"];

      for (const v of versions) {
        for (const n of allNames) {
          if (cachedImageModel?.version === v && cachedImageModel?.name === n) continue; // Already tried
          modelsToTry.push({ version: v, name: n });
        }
      }
      
      let lastTechnicalError: any = null;

      for (const { version, name } of modelsToTry) {
        try {
          console.log(`[Gemini REST] Attempting ${version}/${name}...`);
          const url = `https://generativelanguage.googleapis.com/${version}/models/${name}:generateContent?key=${apiKey}`;
          const payload = {
            contents: [{
              parts: [
                { text: systemInstruction ? `SYSTEM: ${systemInstruction}\n\nUSER PROMPT: ${prompt}${promptEnforcer}` : `${prompt}${promptEnforcer}` },
                { inlineData: { mimeType: "image/jpeg", data: image } }
              ]
            }],
            generationConfig: { 
              temperature: 0.5, 
              topP: 1, 
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          };

          const aiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await aiResponse.json();

          if (aiResponse.ok && data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0].text;
            console.log(`[Gemini REST] Success with ${version}/${name}.`);
            // Cache working model
            cachedImageModel = { version, name };
            return text;
          } 
          
          if (aiResponse.status === 403 || aiResponse.status === 401) {
            throw new Error(`Auth Error ${aiResponse.status}: ${data.error?.message}`);
          }
          lastTechnicalError = data.error;
        } catch (e: any) {
          if (e.message.includes("Auth Error")) throw e;
          console.warn(`[Gemini REST] Failed ${name}:`, e.message);
        }
      }
      throw new Error(`No available models. Last error: ${JSON.stringify(lastTechnicalError)}`);
    };

    try {
      const text = await tryModels();
      const cleanedJson = cleanAIResponse(text);
      res.json({ text: cleanedJson });
    } catch (error: any) {
      console.error("Gemini Image Error Final REST:", error);
      res.status(500).json({ error: error.message || "Error en el análisis de imagen." });
    }
  });

  // AI Text/General Route
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt, systemInstruction, jsonMode } = req.body;
    
    let apiKey = (process.env.GEMINI_API_KEY || "").trim();
    const hardcodedKey = "AIzaSyD0vF1IyF6mG_akDgnxiZESn9ukUVunQpQ";
    
    if (!apiKey || apiKey === "" || apiKey === "undefined" || apiKey === "null" || apiKey.length < 20) {
      apiKey = hardcodedKey;
    }
    
    if (!apiKey || apiKey === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurada." });
    }

    const tryModelsText = async () => {
      // Step 1: Use cache
      const modelsToTry: {version: string, name: string}[] = [];
      if (cachedTextModel) {
        modelsToTry.push(cachedTextModel);
      }

      // Step 2: Discovery
      const discoveredNames = await discoverModels(apiKey);
      const fallbackNames = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
      const allNames = Array.from(new Set([...discoveredNames, ...fallbackNames]));
      const versions = ["v1", "v1beta"];

      for (const v of versions) {
        for (const n of allNames) {
          if (cachedTextModel?.version === v && cachedTextModel?.name === n) continue;
          modelsToTry.push({ version: v, name: n });
        }
      }

      let lastErr: any = null;
      for (const { version, name } of modelsToTry) {
        try {
          console.log(`[Gemini Text REST] Attempting ${version}/${name}...`);
          const url = `https://generativelanguage.googleapis.com/${version}/models/${name}:generateContent?key=${apiKey}`;
          const payload = {
            contents: [{
              parts: [{ text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt }]
            }],
            generationConfig: {
              responseMimeType: jsonMode ? "application/json" : "text/plain"
            }
          };

          const aiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await aiResponse.json();
          if (aiResponse.ok && data.candidates && data.candidates.length > 0) {
            cachedTextModel = { version, name };
            return data.candidates[0].content.parts[0].text;
          } else if (aiResponse.status === 403 || aiResponse.status === 401) {
            throw new Error(`Auth Error ${aiResponse.status}: ${data.error?.message}`);
          }
          lastErr = data.error;
        } catch (e: any) {
          if (e.message.includes("Auth Error")) throw e;
          console.warn(`[Gemini Text REST] Failed ${name}:`, e.message);
        }
      }
      throw new Error(`No available models for text generation. Last error: ${JSON.stringify(lastErr)}`);
    };

    try {
      const text = await tryModelsText();
      const cleanedJson = cleanAIResponse(text);
      res.json({ text: cleanedJson });
    } catch (error: any) {
      console.error("Gemini Text Error REST:", error);
      res.status(500).json({ error: error.message || "Error generating text." });
    }
  });


  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;
    let apiKey = process.env.RESEND_API_KEY || "";
    apiKey = apiKey.trim();

    if (!apiKey || apiKey === "") {
      return res.status(500).json({ error: "Missing RESEND_API_KEY. Configúrala en el panel de control." });
    }

    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: 'Impeccable AI <reports@resend.dev>',
        to: [to],
        subject: subject,
        html: html,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite Integration
  const isProd = process.env.NODE_ENV === "production";
  
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve("dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Boot error:", err);
  process.exit(1);
});
