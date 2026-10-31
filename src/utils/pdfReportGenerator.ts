import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SLOT_DEFINITIONS } from '../components/ComponentCatalogSelector';
import {
  CompatibilityCheckItem,
  EvaluationResult,
  PCBuildState,
  UseCaseScenario,
} from '../types/hardware';
import {
  calculatePowerBreakdown,
  calculateTotalPrice,
} from './compatibilityEngine';
import { toWinAnsi } from './pdfText';

export interface StudentReportMetadata {
  studentName: string;
  studentGroup: string;
  schoolName: string;
  teacherName: string;
  studentNotes: string;
  reportCode: string;
}

interface LoadedLogoAsset {
  dataUrl: string;
  width: number;
  height: number;
}

function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return toWinAnsi(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as T;
  return value;
}

// Envuelve las funciones de texto del documento: así también se limpian las celdas que
// jspdf-autotable mide y escribe, y las medidas de ancho coinciden con lo impreso.
function installWinAnsiSanitizer(doc: jsPDF) {
  const d = doc as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const fn of ['text', 'splitTextToSize', 'getTextWidth', 'getStringUnitWidth']) {
    const original = d[fn].bind(doc);
    d[fn] = (first: unknown, ...rest: unknown[]) => original(sanitizeDeep(first), ...rest);
  }
}

/**
 * Loads an image from URL into a base64 PNG dataUrl along with its natural dimensions
 * so it can be embedded in jsPDF without any aspect-ratio distortion.
 */
async function loadLogoWithoutDistortion(url: string): Promise<LoadedLogoAsset | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const naturalW = img.naturalWidth || 256;
        const naturalH = img.naturalHeight || 256;
        canvas.width = naturalW;
        canvas.height = naturalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, naturalW, naturalH);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: naturalW,
          height: naturalH,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function getKeySpecString(slotKey: string, part: any): string {
  if (!part) return 'Sin seleccionar';
  switch (slotKey) {
    case 'cpu':
      return `Socket ${part.socket} | ${part.cores}C/${part.threads}T | ${part.tdpWatts}W (${part.maxTurboWatts}W Turbo)`;
    case 'motherboard':
      return `Socket ${part.socket} (${part.chipset}) | ${part.formFactor} | ${part.ramSlots}x ${part.ramType}`;
    case 'ram':
      return `${part.totalCapacityGb} GB (${part.modules}x${part.capacityPerModuleGb} GB) ${part.ramType}-${part.speedMhz} CL${part.casLatency}`;
    case 'cooler':
      return `${part.type} | Max ${part.maxTdpWatts}W | Altura: ${part.heightMm} mm`;
    case 'gpu':
      return part.vramGb > 0
        ? `${part.vramGb} GB VRAM | ${part.tdpWatts}W | Largo: ${part.lengthMm} mm`
        : 'Uso de iGPU integrada en CPU (0 W / 0 mm)';
    case 'storagePrimary':
    case 'storageSecondary':
      return `${part.capacityGb >= 1000 ? `${part.capacityGb / 1000} TB` : `${part.capacityGb} GB`} | ${part.interface} (${part.readSpeedMbs} MB/s)`;
    case 'pcCase':
      return `${part.supportedFormFactors.join('/')} | Cooler <=${part.maxCoolerHeightMm}mm | GPU <=${part.maxGpuLengthMm}mm`;
    case 'psu':
      return `${part.wattage}W (${part.effective12vWatts}W +12V) | ${part.efficiency}`;
    default:
      return '';
  }
}

export async function generateBudgetPdfReport(params: {
  build: PCBuildState;
  scenario: UseCaseScenario;
  budgetLimit: number;
  checks: CompatibilityCheckItem[];
  evaluation: EvaluationResult;
  metadata: StudentReportMetadata;
  logoUrl: string;
}): Promise<void> {
  const { build, scenario, budgetLimit, checks, evaluation, metadata, logoUrl } =
    params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  installWinAnsiSanitizer(doc);

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const totalPrice = calculateTotalPrice(build);
  const netPrice = Number((totalPrice / 1.21).toFixed(2));
  const vatAmount = Number((totalPrice - netPrice).toFixed(2));
  const budgetDiff = budgetLimit - totalPrice;
  const power = calculatePowerBreakdown(build);

  // 1. Dark Slate Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Accent sky stripe under header
  doc.setFillColor(2, 132, 199); // sky-600
  doc.rect(0, 36, pageWidth, 1.5, 'F');

  // Load and draw undistorted logo
  const logoAsset = await loadLogoWithoutDistortion(logoUrl);
  let headerTextStartX = margin;

  if (logoAsset) {
    const maxBoxSize = 22; // 22x22 mm box
    const aspectRatio = logoAsset.width / logoAsset.height;
    let drawW = maxBoxSize;
    let drawH = maxBoxSize;
    if (aspectRatio > 1) {
      drawH = maxBoxSize / aspectRatio;
    } else if (aspectRatio < 1) {
      drawW = maxBoxSize * aspectRatio;
    }
    const logoX = margin + (maxBoxSize - drawW) / 2;
    const logoY = 7 + (maxBoxSize - drawH) / 2;

    // Subtle white rounded badge behind logo so dark outlines pop cleanly
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin - 1, 6, maxBoxSize + 2, maxBoxSize + 2, 3, 3, 'F');
    doc.addImage(logoAsset.dataUrl, 'PNG', logoX, logoY, drawW, drawH);
    headerTextStartX = margin + maxBoxSize + 6;
  }

  // Header Titles
  doc.setTextColor(56, 189, 248); // sky-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    'MONTAJE Y REPARACIÓN DE SISTEMAS MICROINFORMÁTICOS · UN FANTASMA EN EL SISTEMA',
    headerTextStartX,
    12
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(
    'INFORME TÉCNICO DE PRESUPUESTO Y COMPATIBILIDAD',
    headerTextStartX,
    19.5
  );

  doc.setTextColor(203, 213, 225); // slate-300
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.textWithLink(
    'https://www.unfantasmaenelsistema.com/',
    headerTextStartX,
    25.5,
    { url: 'https://www.unfantasmaenelsistema.com/' }
  );

  const dateStr = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Ref: ${metadata.reportCode}  |  Fecha de emisión: ${dateStr}`,
    headerTextStartX,
    31
  );

  let currentY = 43;

  // 2. Student & Assignment Identification Card + Rubric Score Box
  // Left Box: Student & Scenario Info (width: 122mm)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, 122, 32, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DATOS DEL ALUMNO/A Y ENCARGO TÉCNICO', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Alumno/a: ${metadata.studentName || 'Sin especificar'}`,
    margin + 4,
    currentY + 12
  );
  doc.text(
    `Curso / Grupo: ${metadata.studentGroup || 'CFGM SMR'}`,
    margin + 4,
    currentY + 17
  );
  doc.text(
    `Centro / Profesor: ${metadata.schoolName || 'Aula Taller SMR'}${
      metadata.teacherName ? ` (${metadata.teacherName})` : ''
    }`,
    margin + 4,
    currentY + 22
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(
    `Caso de Uso: ${scenario.title} (Límite: ${budgetLimit} €)`,
    margin + 4,
    currentY + 28
  );

  // Right Box: Global Rubric Grade Box (width: 56mm)
  const scoreBoxX = margin + 126;
  const isPassing = evaluation.canBoot && evaluation.totalScore >= 5;
  if (isPassing) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(16, 185, 129); // emerald-500
  } else {
    doc.setFillColor(255, 241, 242); // rose-50
    doc.setDrawColor(244, 63, 94); // rose-500
  }
  doc.roundedRect(scoreBoxX, currentY, 56, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('CALIFICACIÓN (RÚBRICA)', scoreBoxX + 28, currentY + 6, {
    align: 'center',
  });

  doc.setFontSize(18);
  if (isPassing) {
    doc.setTextColor(5, 150, 105);
  } else {
    doc.setTextColor(225, 29, 72);
  }
  doc.text(`${evaluation.totalScore} / 10`, scoreBoxX + 28, currentY + 15, {
    align: 'center',
  });

  doc.setFontSize(7.2);
  doc.text(
    evaluation.canBoot ? 'POST BIOS: ARRANQUE OK' : 'POST BIOS: NO ARRANCA',
    scoreBoxX + 28,
    currentY + 20.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Comp: ${evaluation.compatibilityScore}/4 | Presup: ${evaluation.budgetScore}/2`,
    scoreBoxX + 28,
    currentY + 25.5,
    { align: 'center' }
  );
  doc.text(
    `Caso Uso: ${evaluation.useCaseScore}/2.5 | Balance: ${evaluation.balanceScore}/1.5`,
    scoreBoxX + 28,
    currentY + 29.5,
    { align: 'center' }
  );

  currentY += 37;

  // 3. Section 1: Itemized Component Budget Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DESGLOSE ECONÓMICO Y ESPECIFICACIONES DE COMPONENTES', margin, currentY);
  currentY += 2.5;

  const budgetRows = SLOT_DEFINITIONS.map((slot, index) => {
    const part: any = build[slot.key];
    const priceWithVat = part ? part.price : 0;
    const priceNoVat = priceWithVat / 1.21;
    const itemVat = priceWithVat - priceNoVat;

    return [
      String(index + 1),
      slot.shortLabel,
      part ? part.name : 'No seleccionado',
      getKeySpecString(slot.key, part),
      `${priceNoVat.toFixed(2)} €`,
      `${itemVat.toFixed(2)} €`,
      `${priceWithVat.toFixed(2)} €`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        '#',
        'Ranura',
        'Componente Seleccionado',
        'Especificaciones Técnicas Clave',
        'Base s/IVA',
        'IVA 21%',
        'Total c/IVA',
      ],
    ],
    body: budgetRows,
    foot: [
      [
        '',
        '',
        '',
        `Límite Presupuesto Cliente: ${budgetLimit.toFixed(2)} € (${
          budgetDiff >= 0
            ? `Ahorro: +${budgetDiff.toFixed(2)} €`
            : `Excedido: ${budgetDiff.toFixed(2)} €`
        })`,
        `${netPrice.toFixed(2)} €`,
        `${vatAmount.toFixed(2)} €`,
        `${totalPrice.toFixed(2)} €`,
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      valign: 'middle',
      cellPadding: 1.8,
    },
    footStyles: {
      fillColor: budgetDiff >= 0 ? [240, 253, 244] : [255, 241, 242],
      textColor: budgetDiff >= 0 ? [6, 95, 70] : [159, 18, 57],
      fontSize: 7.8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 21, fontStyle: 'bold' },
      2: { cellWidth: 48 },
      3: { cellWidth: 58 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 17, halign: 'right', fontStyle: 'bold' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 4. Section 2: Physical Clearances & Power Telemetry Strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '2. TELEMETRÍA ELÉCTRICA (+12V), TÉRMICA (TDP) Y COTAS MECÁNICAS (MM)',
    margin,
    currentY
  );
  currentY += 2.5;

  const coolerMetric =
    build.cooler && build.pcCase
      ? `${build.cooler.heightMm} mm / Max ${build.pcCase.maxCoolerHeightMm} mm (${
          build.pcCase.maxCoolerHeightMm - build.cooler.heightMm >= 0
            ? `+${build.pcCase.maxCoolerHeightMm - build.cooler.heightMm} mm libre`
            : `Colision ${build.pcCase.maxCoolerHeightMm - build.cooler.heightMm} mm`
        })`
      : 'Pendiente';

  const gpuMetric =
    build.gpu && build.pcCase
      ? `${build.gpu.lengthMm} mm / Max ${build.pcCase.maxGpuLengthMm} mm`
      : 'Pendiente';

  const tdpMetric =
    build.cpu && build.cooler
      ? `CPU Turbo ${build.cpu.maxTurboWatts}W vs Cooler ${build.cooler.maxTdpWatts}W`
      : 'Pendiente';

  const psuMetric = build.psu
    ? `Pico ${power.totalMaxPeakWatts}W / Rail +12V ${build.psu.effective12vWatts}W (${power.psuLoadPercentage}% carga)`
    : `Pico ${power.totalMaxPeakWatts}W (Sin PSU)`;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        'Holgura Altura Disipador',
        'Holgura Longitud GPU',
        'Balance Térmico TDP',
        'Balance Eléctrico PSU (+12V)',
      ],
    ],
    body: [[coolerMetric, gpuMetric, tdpMetric, psuMetric]],
    theme: 'grid',
    headStyles: {
      fillColor: [2, 132, 199],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.3,
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      cellPadding: 2,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5. Section 3: 10-Point Real-Time Compatibility Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '3. AUDITORÍA DE COMPATIBILIDAD FÍSICA Y LÓGICA (10 PUNTOS DE CONTROL)',
    margin,
    currentY
  );
  currentY += 2.5;

  const checkRows = checks.map((c) => {
    const statusLabel =
      c.severity === 'ok'
        ? 'COMPATIBLE'
        : c.severity === 'warning'
        ? 'AVISO'
        : c.severity === 'error'
        ? 'INCOMPATIBLE'
        : 'PENDIENTE';

    return [
      c.category,
      statusLabel,
      c.measuredValue ? `${c.measuredValue} (${c.limitValue ?? ''})` : '—',
      `${c.summary} ${c.technicalExplanation}`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        'Subsistema Evaluado',
        'Estado',
        'Medición / Límite',
        'Diagnóstico y Justificación Técnica',
      ],
    ],
    body: checkRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 6.9,
      textColor: [30, 41, 59],
      cellPadding: 1.6,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 34 },
      3: { cellWidth: 94 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const val = String(data.cell.raw);
        if (val === 'COMPATIBLE') {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [22, 101, 52];
        } else if (val === 'AVISO') {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        } else if (val === 'INCOMPATIBLE') {
          data.cell.styles.fillColor = [255, 228, 230];
          data.cell.styles.textColor = [159, 18, 57];
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Check if we need a page break before Student Justification & Signatures
  if (currentY + 45 > pageHeight - 15) {
    doc.addPage();
    currentY = 18;
  }

  // 6. Section 4: Student Technical Justification & Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. MEMORIA JUSTIFICATIVA DEL ALUMNO/A Y VALIDACION DOCENTE', margin, currentY);
  currentY += 3;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  const notesText = metadata.studentNotes.trim()
    ? metadata.studentNotes.trim()
    : 'El alumno/a no ha incluido observaciones adicionales en la memoria justificativa del presupuesto.';
  const wrappedNotes = doc.splitTextToSize(notesText, contentWidth - 6);
  doc.text(wrappedNotes.slice(0, 4), margin + 3, currentY + 5);

  currentY += 24;

  // Signature Boxes (Student & Teacher)
  if (currentY + 22 <= pageHeight - 12) {
    const boxW = (contentWidth - 6) / 2;
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, currentY, boxW, 18, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + boxW + 6, currentY, boxW, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Firma del Alumno/a: ${metadata.studentName || '____________________'}`,
      margin + 3,
      currentY + 4.5
    );
    doc.text(
      `Sello y Calificacion Docente (${metadata.teacherName || 'Profesor/a SMR'}):`,
      margin + boxW + 9,
      currentY + 4.5
    );
  }

  // Add Footer with Page Numbers & Website Link on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Simulador de Presupuestos y Compatibilidad de Hardware (SMR) — Un Fantasma en el Sistema',
      margin,
      pageHeight - 6.5
    );

    doc.setTextColor(2, 132, 199);
    doc.textWithLink(
      'unfantasmaenelsistema.com',
      pageWidth - margin - 52,
      pageHeight - 6.5,
      { url: 'https://www.unfantasmaenelsistema.com/' }
    );

    doc.setTextColor(100, 116, 139);
    doc.text(
      `|  Pág. ${p} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  const cleanStudentSlug = (metadata.studentName || 'alumno')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  doc.save(
    `informe-presupuesto-smr-${scenario.id}-${cleanStudentSlug || 'taller'}.pdf`
  );
}
