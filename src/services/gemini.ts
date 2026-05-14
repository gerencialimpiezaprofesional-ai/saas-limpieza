const parseGeminiResponse = (text: string, fallback: any = {}) => {
  try {
    let cleanedText = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    cleanedText = cleanedText.replace(/,\s*([\]\}])/g, '$1');
    if (!cleanedText) return fallback;
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Gemini Parse Error:", error, "Original Text:", text);
    return fallback;
  }
};

export const callAIApi = async (endpoint: string, body: any) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "AI Service Error");
  }
  return await response.json();
};

export const generateAIResponse = async (prompt: string, systemInstruction?: string, jsonMode: boolean = false) => {
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt,
      systemInstruction,
      jsonMode
    });
    return data.text;
  } catch (error: any) {
    console.error("Error in generateAIResponse:", error);
    throw error;
  }
};

export const analyzeCleaningQuality = async (afterImageBase64: string, strictness: 'human' | 'standard' | 'strict' = 'standard', clientIndustry: string = "Comercio") => {
  const strictnessPrompts = {
    human: "Sé comprensivo y busca un estándar de limpieza doméstico/comercial básico. Valora el orden y la ausencia de suciedad evidente.",
    standard: "Sé un auditor profesional equilibrado. Busca un estándar de limpieza comercial de alta calidad, adecuado para el giro del cliente.",
    strict: "Sé minucioso y exigente. Busca un estándar de limpieza profunda, similar al requerido en laboratorios o zonas de alta higiene."
  };

  if (!afterImageBase64 || afterImageBase64.length < 100) {
    throw new Error("Imagen de evidencia no válida.");
  }

  try {
    const data = await callAIApi("/api/ai/analyze-image", {
      image: afterImageBase64,
    prompt: `IDENTIFICACIÓN Y ANÁLISIS DE LIMPIEZA PROFESIONAL:
1. ¿Es esta una imagen de un área de trabajo (piso, baño, cocina, oficina, etc.)? 
   - SI ES UNA SELFIE, UNA PERSONA, UNA IMAGEN OSCURA, BORROSA O IRRELEVANTE: EL SCORE DEBE SER 0. Esto es crítico.
2. Si es un área de limpieza, evalúa con objetividad profesional según el giro: ${clientIndustry}.
3. Criterios de evaluación:
   - Presencia de residuos o basura (Penalización fuerte).
   - Manchas en superficies o restos de suciedad (Penalización moderada).
   - Orden de los elementos y uniformidad.
4. Nivel de exigencia solicitado: ${strictness.toUpperCase()}. 
   - Guía: ${strictnessPrompts[strictness]}

5. El SCORE debe ser un número entero de 0 a 100.
6. PUNTUACIÓN CRÍTICA: Si detectas una selfie o una persona, observations debe decir: "Detección de persona/selfie - Auditoría Rechazada" y score: 0.

Retorna un JSON estricto con: 
- score: (número 0-100) 
- observations: (Explicación detallada de por qué obtuvo esa nota. Debe ser humanamente comprensible y evaluable)
- criteria: (lista de 3-5 puntos específicos verificados)`,
      systemInstruction: "Eres un Auditor de Calidad IA de alto nivel. Tu misión es certificar la limpieza. Eres imperturbable ante selfies o intentos de engaño: si no es un área de limpieza, califica con 0. Tus comentarios deben ser profesionales, constructivos y directos."
    });

    return parseGeminiResponse(data.text, {
      score: 0,
      observations: "No se pudo realizar el análisis técnico. Asegúrese de que la imagen sea clara y enfoque el área de limpieza.",
      criteria: []
    });
  } catch (error: any) {
    console.error("Error in analyzeCleaningQuality:", error);
    throw new Error(`Error en el análisis: ${error.message}`);
  }
};

export const analyzeCleaningVideo = async (videoBase64: string) => {
  // Video analysis usually requires File API or specific handling, 
  // for now we proxy text/image patterns or use simpler prompts.
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt: "Analiza el video de limpieza profesional (base64) y retorna score y observaciones en JSON.",
      systemInstruction: "Analista de video de limpieza.",
      jsonMode: true
    });
    return parseGeminiResponse(data.text);
  } catch (error: any) {
    throw new Error(`Error video: ${error.message}`);
  }
};

export const predictInventory = async (usageHistory: string) => {
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt: `Based on history: ${usageHistory}, predict inventory in JSON.`,
      jsonMode: true
    });
    return parseGeminiResponse(data.text);
  } catch (error) {
    return { predictedEmptyDate: "N/A", suggestedOrderAmount: 0 };
  }
};

export const generateExecutiveSummary = async (operationalData: any) => {
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt: `Analyze operational data: ${JSON.stringify(operationalData)}. Generate summary for CEO in Spanish JSON.`,
      jsonMode: true
    });
    return parseGeminiResponse(data.text);
  } catch (error) {
    return { summary: "Error al generar resumen.", recommendations: [] };
  }
};

export const generateDailyClientReport = async (clientName: string, tasks: any[]) => {
  const tasksSummary = tasks.map(t => `- ${t.title}: ${t.status} (${t.score || 0}%)`).join("\n");
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt: `Genera informe ejecutivo para '${clientName}' basado en: ${tasksSummary}. Formato JSON.`,
      jsonMode: true
    });
    return parseGeminiResponse(data.text);
  } catch (error) {
    return { summary: "Resumen estándar de hoy.", highlights: [], score: 0 };
  }
};

export const getSupervisorAIAssistant = async (context: any) => {
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt: `Eres asistente experto. Contexto: ${JSON.stringify(context)}. Da soluciones accionables en español.`,
    });
    return data.text || "Asistente no disponible.";
  } catch (error) {
    return "Error al conectar con el asistente.";
  }
};

export const getChurnPrediction = async (employeeData: any) => {
  try {
    const data = await callAIApi("/api/ai/generate", {
      prompt: `Analiza deserción para: ${JSON.stringify(employeeData)}. Retorna JSON.`,
      jsonMode: true
    });
    return parseGeminiResponse(data.text);
  } catch (error) {
    return { riskScore: 0, riskLevel: 'bajo', reasoning: "Error en predicción.", recommendations: [] };
  }
};
