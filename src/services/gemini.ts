import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeCleaningQuality = async (beforeImageBase64: string, afterImageBase64: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: "Analyze the cleaning quality by comparing the 'before' and 'after' images. Look for: depth of cleaning, fingerprints on glass, grout cleanliness, and overall hygiene. Return a JSON object with a 'score' (0-100), 'observations' (string), and 'criteria' (array of {name, status: 'ok'|'fail'})." },
          { inlineData: { mimeType: "image/jpeg", data: beforeImageBase64 } },
          { inlineData: { mimeType: "image/jpeg", data: afterImageBase64 } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          observations: { type: Type.STRING },
          criteria: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["ok", "fail"] }
              }
            }
          }
        },
        required: ["score", "observations", "criteria"]
      }
    }
  });

  const response = await model;
  return JSON.parse(response.text || "{}");
};

export const predictInventory = async (usageHistory: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this usage history: ${usageHistory}, predict when the supplies will run out and suggest an automatic purchase order. Return JSON with 'predictedEmptyDate' and 'suggestedOrderAmount'.`,
    config: { responseMimeType: "application/json" }
  });
  const response = await model;
  return JSON.parse(response.text || "{}");
};

export const generateExecutiveSummary = async (operationalData: any) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this operational data for CleanFlow AI: ${JSON.stringify(operationalData)}. Generate a concise, professional executive summary in Spanish for the CEO. Focus on: overall satisfaction, AI efficiency, critical alerts, and client-specific performance (Emmsa, Casa Lumbre, Engrane). Return a JSON object with 'summary' (string) and 'recommendations' (array of strings).`,
    config: { responseMimeType: "application/json" }
  });
  const response = await model;
  return JSON.parse(response.text || "{}");
};
