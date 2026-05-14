import React, { useState } from "react";
import { Download, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface ClientReportProps {
  clientData: any;
  tasks: any[];
  tenantLogo?: string;
  erpLogo?: string;
}

export default function ReportDownload({ clientData, tasks, tenantLogo, erpLogo }: ClientReportProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF() as any;
      
      // Header Background
      doc.setFillColor(15, 23, 42); // Navy
      doc.rect(0, 0, 210, 60, 'F');
      
      // Secondary Accent Line
      doc.setFillColor(68, 221, 194); // Teal
      doc.rect(0, 58, 210, 2, 'F');
      
      // Impeccable AI Title
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text("IMPECCABLE IA", 15, 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("SISTEMA DE AUDITORÍA OPERATIVA EN TIEMPO REAL", 15, 35);
      doc.text(`ID CLIENTE: ${clientData.id}`, 15, 42);

      // Client Logo / Branding
      if (tenantLogo) {
        try {
          doc.addImage(tenantLogo, 'JPEG', 160, 10, 35, 20);
        } catch (e) {}
      }

      // Title Section
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("REPORTE DE CUMPLIMIENTO HIGIÉNICO", 15, 80);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`CLIENTE: ${(clientData.name || "CLIENTE").toUpperCase()}`, 15, 90);
      doc.text(`EMISIÓN: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, 95);
      doc.text(`ESTADO: CERTIFICADO POR IA`, 130, 90);
      doc.text(`MÉTRICA: GRADO HOSPITALARIO`, 130, 95);

      // KPIs Section
      const avgScore = tasks.reduce((acc, t) => acc + (t.score || t.aiScore || 0), 0) / (tasks.length || 1);
      
      const getStatusColor = (score: number): [number, number, number] => {
        if (score >= 90) return [20, 184, 166]; // Teal
        if (score >= 75) return [59, 130, 246]; // Blue
        if (score >= 60) return [234, 179, 8];  // Yellow
        return [239, 68, 68]; // Red
      };

      const getStatusText = (score: number) => {
        if (score >= 90) return "EXCELENTE";
        if (score >= 75) return "ÓPTIMO";
        if (score >= 60) return "ESTÁNDAR";
        return "CRÍTICO";
      };

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 105, 180, 25, 3, 3, 'F');
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text(`${avgScore.toFixed(1)}%`, 35, 122);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("ÍNDICE DE PUREZA PROMEDIO", 35, 114, { align: "center" });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text(`${tasks.length}`, 105, 122, { align: "center" });
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("SERVICIOS AUDITADOS 24H", 105, 114, { align: "center" });

      const statusColor = getStatusColor(avgScore);
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.setFontSize(14);
      doc.text(getStatusText(avgScore), 175, 122, { align: "right" });
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("ESTATUS GLOBAL IA", 175, 114, { align: "right" });

      // Tasks Table
      const tableColumn = ["ÁREA/SECTOR", "ACTIVIDAD", "ESTADO", "HORA", "SCORE"];
      const tableRows = tasks.map(task => [
        (task.areaName || "GENERAL").toUpperCase(),
        task.title.toUpperCase(),
        task.status === 'completed' ? 'VALIDADO' : 'PENDIENTE',
        task.completedAt?.toDate ? task.completedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
        task.createdAt?.toDate ? task.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A",
        `${task.score || task.aiScore || 0}%`,
      ]);

      autoTable(doc, {
        startY: 140,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          4: { fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const score = parseInt(data.cell.text[0]);
            const color = getStatusColor(score);
            data.cell.styles.textColor = color;
          }
        }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      // Evidence Section - New Page if needed
      if (tasks.some(t => t.afterPhoto)) {
        if (currentY > 220) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("EVIDENCIA FOTOGRÁFICA Y ANÁLISIS IA", 15, currentY);
        doc.setDrawColor(68, 221, 194);
        doc.line(15, currentY + 2, 80, currentY + 2);
        currentY += 12;

        for (const task of tasks) {
          if (!task.afterPhoto) continue;

          if (currentY > 210) {
            doc.addPage();
            currentY = 20;
          }

          // Task Header in Evidence
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(`${task.areaName || "Área General"} - ${task.title}`, 15, currentY);
          currentY += 6;

          // Image
          try {
            // Check if string is base64 and has correct prefix
            const imgData = task.afterPhoto.startsWith('data:image') ? task.afterPhoto : `data:image/jpeg;base64,${task.afterPhoto}`;
            doc.addImage(imgData, 'JPEG', 15, currentY, 60, 45);
            
            // AI Commentary Block
            doc.setFillColor(248, 250, 252);
            doc.rect(80, currentY, 115, 45, 'F');
            
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139);
            doc.text("ANÁLISIS TÉCNICO IA:", 85, currentY + 7);
            
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 65, 85);
            const notes = task.aiNotes || task.aiFeedback || "Sin observaciones adicionales.";
            const splitNotes = doc.splitTextToSize(notes, 105);
            doc.text(splitNotes, 85, currentY + 15);

            // Score indicator on summary
            const scoreColor = getStatusColor(task.score || 0);
            doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
            doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
            doc.setTextColor(255, 255, 255);
            doc.roundedRect(85, currentY + 38, 30, 5, 1, 1, 'FD');
            doc.text(`SCORE: ${task.score}%`, 100, currentY + 41.5, { align: "center" });

            currentY += 55;
          } catch (e) {
            console.error("Error adding image to PDF:", e);
            currentY += 10;
          }
        }
      }

      // Final Conclusion
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("CONCLUSIÓN GENERAL DEL SERVICIO", 15, currentY);
      doc.setLineWidth(0.5);
      doc.setDrawColor(15, 23, 42);
      doc.line(15, currentY + 2, 195, currentY + 2);
      currentY += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      
      let conclusion = "";
      if (avgScore >= 90) {
        conclusion = "El servicio de hoy ha mantenido estándares de excelencia operativa sobresalientes. Las superficies presentan una sanitización profunda y una organización visual impecable, superando los protocolos de higiene de grado hospitalario.";
      } else if (avgScore >= 75) {
        conclusion = "Se observa un cumplimiento óptimo de los protocolos. Las áreas auditadas están consistentemente limpias, cumpliendo con la mayoría de los criterios de calidad técnica exigidos por la plataforma Impeccable AI.";
      } else if (avgScore >= 60) {
        conclusion = "El servicio es aceptable pero presenta oportunidades de mejora en detalles específicos de acabado y pulido. Se recomienda reforzar la atención en las áreas señaladas para alcanzar el nivel de excelencia esperado.";
      } else {
        conclusion = "ALERTA DE CALIDAD: El nivel de higiene detectado es insuficiente. Se requiere una intervención correctiva inmediata y una re-evaluación de los procesos de limpieza aplicados en los sectores identificados con bajo puntaje.";
      }

      const splitConclusion = doc.splitTextToSize(conclusion, 180);
      doc.text(splitConclusion, 15, currentY);

      // Certification Badge
      if (avgScore >= 80) {
        doc.setDrawColor(68, 221, 194);
        doc.setLineWidth(0.5);
        doc.roundedRect(140, currentY + 30, 55, 25, 2, 2, 'D');
        doc.setFont("helvetica", "bold");
        doc.setTextColor(68, 221, 194);
        doc.text("ESPACIO SEGURO", 167.5, currentY + 40, { align: "center" });
        doc.setFontSize(7);
        doc.text("VALIDACIÓN GEMINI 1.5 PRO", 167.5, currentY + 45, { align: "center" });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Impeccable AI - Reporte Automatizado - Página ${i} de ${pageCount}`, 105, 285, { align: "center" });
      }

      doc.save(`Reporte_Impeccable_${clientData.name}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Documento descargado con éxito");
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Error al generar el PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className="flex items-center gap-2 px-6 h-12 bg-secondary text-on-secondary rounded-2xl font-black font-headline uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
      <span className="text-xs">Descargar Reporte PDF</span>
    </button>
  );
}
