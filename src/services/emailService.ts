import { toast } from "sonner";

export const sendDailyReportEmail = async (email: string, clientName: string, report: any) => {
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject: `Informe de Higiene Estratégica - ${clientName}`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 650px; margin: auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; color: #1a1a1a;">
            <div style="text-align: center; margin-bottom: 30px;">
              <span style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #888;">Executive Intelligence Report</span>
              <h1 style="color: #000; margin: 10px 0; font-size: 24px; font-weight: 300;">Impeccable <span style="font-weight: 700; color: #44DDC2;">AI</span></h1>
            </div>
            
            <div style="background: #000; color: #fff; padding: 25px; border-radius: 8px; margin-bottom: 40px; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; color: #44DDC2;">Purity Score Index</div>
              <div style="font-size: 48px; font-weight: 700;">${report.score}%</div>
              <div style="font-size: 12px; opacity: 0.7;">Certificación de Higiene de Hoy</div>
            </div>

             <p style="font-size: 16px; line-height: 1.6; color: #444; margin-bottom: 30px;">
              ${report.summary}
            </p>

            ${report.images && report.images.length > 0 ? `
            <div style="margin-bottom: 35px;">
              <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; color: #333;">Evidencia de Calidad</h3>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${report.images.map((img: string) => `
                  <div style="flex: 1; min-width: 150px; border-radius: 8px; overflow: hidden; border: 1px solid #eee;">
                    <img src="${img}" style="width: 100%; height: 150px; object-fit: cover;" alt="Evidencia" />
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 35px;">
              <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; color: #333;">Hitos Técnicos</h3>
              <ul style="padding-left: 20px; color: #555;">
                ${report.highlights.map((h: string) => `<li style="margin-bottom: 12px; font-size: 14px;">${h}</li>`).join('')}
              </ul>
            </div>

            ${report.recommendations ? `
            <div style="background: #f8fdfc; padding: 25px; border-left: 4px solid #44DDC2; margin-bottom: 40px; border-radius: 0 8px 8px 0;">
              <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; color: #2c7a6b;">Recomendaciones Estratégicas</h3>
              <ul style="padding-left: 20px; color: #2c7a6b; margin-bottom: 0;">
                ${report.recommendations.map((r: string) => `<li style="margin-bottom: 8px; font-size: 13px;">${r}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid #eee; text-align: center;">
              <p style="font-size: 11px; color: #aaa; margin-bottom: 5px;">Este informe fue generado por el motor Gemini 3 con análisis de visión artificial.</p>
              <p style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Impeccable ERP Colossus <span style="color: #44DDC2;">•</span> AI Services Division</p>
            </div>
          </div>
        `
      })
    });

    if (!response.ok) throw new Error("Failed to send email");
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
};
