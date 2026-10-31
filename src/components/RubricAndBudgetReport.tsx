import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Eye,
  FileDown,
  FileText,
  Printer,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  CompatibilityCheckItem,
  EvaluationResult,
  PCBuildState,
  UseCaseScenario,
} from '../types/hardware';
import {
  calculatePowerBreakdown,
  calculateTotalPrice,
} from '../utils/compatibilityEngine';
import {
  generateBudgetPdfReport,
  StudentReportMetadata,
} from '../utils/pdfReportGenerator';
import { SLOT_DEFINITIONS } from './ComponentCatalogSelector';

interface RubricAndBudgetReportProps {
  build: PCBuildState;
  scenario: UseCaseScenario;
  budgetLimit: number;
  checks: CompatibilityCheckItem[];
  evaluation: EvaluationResult;
  onImportBuildIds?: (
    ids: Record<string, string | null>,
    useCaseId?: string,
    budget?: number
  ) => void;
}

export const RubricAndBudgetReport: React.FC<RubricAndBudgetReportProps> = ({
  build,
  scenario,
  budgetLimit,
  checks,
  evaluation,
  onImportBuildIds,
}) => {
  const [studentName, setStudentName] = useState('');
  const [studentGroup, setStudentGroup] = useState(
    '1º CFGM SMR — Montaje y Reparación de Sistemas Microinformáticos'
  );
  const [schoolName, setSchoolName] = useState('IES / Centro FP — Aula Taller Hardware');
  const [teacherName, setTeacherName] = useState('');
  const [studentNotes, setStudentNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showA4Preview, setShowA4Preview] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const reportCode = useMemo(() => {
    const suffix = String(
      (build.cpu?.price ?? 17) * 13 +
        (build.motherboard?.price ?? 23) * 7 +
        budgetLimit
    ).slice(-4);
    return `SMR-${scenario.id.toUpperCase().slice(0, 4)}-${suffix}`;
  }, [build.cpu, build.motherboard, budgetLimit, scenario.id]);

  const totalPrice = calculateTotalPrice(build);
  const netPriceNoVat = Number((totalPrice / 1.21).toFixed(2));
  const vatAmount = Number((totalPrice - netPriceNoVat).toFixed(2));
  const power = calculatePowerBreakdown(build);

  const logoSrc = `${import.meta.env.BASE_URL}assets/aistudio/icono_81a3db5b.png`;

  const handleAutoDraftJustification = () => {
    const draftParts: string[] = [
      `Para responder al encargo de "${scenario.title}" con un presupuesto máximo de ${budgetLimit} €, se ha diseñado una configuración por importe de ${totalPrice} € (IVA incluido).`,
    ];

    if (build.cpu && build.motherboard) {
      draftParts.push(
        `Plataforma base: Procesador ${build.cpu.name} (${build.cpu.cores} núcleos / ${build.cpu.threads} hilos, socket ${build.cpu.socket}) montado sobre placa base ${build.motherboard.name} (chipset ${build.motherboard.chipset}, formato ${build.motherboard.formFactor}, VRM hasta ${build.motherboard.maxRecommendedCpuWatts}W).`
      );
    }
    if (build.ram) {
      draftParts.push(
        `Subsistema de memoria: ${build.ram.totalCapacityGb} GB ${build.ram.ramType}-${build.ram.speedMhz} (${build.ram.modules}x${build.ram.capacityPerModuleGb} GB) operando en ${
          build.ram.modules >= 2 ? 'Dual Channel (128 bits)' : 'Single Channel'
        }.`
      );
    }
    if (build.cooler && build.pcCase) {
      draftParts.push(
        `Geometría y refrigeración: Disipador ${build.cooler.name} (${build.cooler.heightMm} mm de altura, capacidad ${build.cooler.maxTdpWatts}W TDP) alojado en chasis ${build.pcCase.name} (admite hasta ${build.pcCase.maxCoolerHeightMm} mm de disipador y ${build.pcCase.maxGpuLengthMm} mm de tarjeta gráfica).`
      );
    }
    if (build.psu) {
      draftParts.push(
        `Balance eléctrico: Consumo pico estimado de ${power.totalMaxPeakWatts}W alimentado por fuente ${build.psu.name} (${build.psu.effective12vWatts}W reales en línea +12V, carga del ${power.psuLoadPercentage}%, certificación ${build.psu.efficiency}).`
      );
    }

    setStudentNotes(draftParts.join(' '));
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const metadata: StudentReportMetadata = {
        studentName,
        studentGroup,
        schoolName,
        teacherName,
        studentNotes,
        reportCode,
      };
      await generateBudgetPdfReport({
        build,
        scenario,
        budgetLimit,
        checks,
        evaluation,
        metadata,
        logoUrl: logoSrc,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const generatePlainTextReport = () => {
    const lines: string[] = [
      '====================================================================',
      'INFORME TÉCNICO DE PRESUPUESTO Y COMPATIBILIDAD DE HARDWARE (SMR)',
      'Simulador Educativo — https://www.unfantasmaenelsistema.com/',
      '====================================================================',
      `Referencia: ${reportCode} | Fecha: ${new Date().toLocaleDateString('es-ES')}`,
      `Alumno/a: ${studentName || 'Sin especificar'}`,
      `Grupo / Módulo: ${studentGroup}`,
      `Centro / Profesor: ${schoolName}${teacherName ? ` (${teacherName})` : ''}`,
      `Caso de Uso: ${scenario.title}`,
      `Presupuesto Máximo: ${budgetLimit} € | Coste Total (IVA incl.): ${totalPrice} €`,
      `Calificación Rúbrica: ${evaluation.totalScore} / 10 (${evaluation.verdictTitle})`,
      '--------------------------------------------------------------------',
      '1. DESGLOSE DE COMPONENTES SELECCIONADOS:',
    ];

    SLOT_DEFINITIONS.forEach((slot) => {
      const part = build[slot.key];
      lines.push(
        `  - ${slot.label.padEnd(28, ' ')}: ${
          part ? `${part.name} [${part.price} €]` : 'No seleccionado'
        }`
      );
    });

    lines.push(
      `  ------------------------------------------------------------------`,
      `  Base Imponible (Sin IVA): ${netPriceNoVat} €`,
      `  IVA (21%):                ${vatAmount} €`,
      `  TOTAL PRESUPUESTO:        ${totalPrice} € (Límite: ${budgetLimit} €)`,
      '--------------------------------------------------------------------',
      '2. TELEMETRÍA ELÉCTRICA Y TÉRMICA:',
      `  - Consumo típico estimado: ${power.totalTypicalWatts} W`,
      `  - Consumo pico máximo (CPU Turbo + GPU): ${power.totalMaxPeakWatts} W`,
      `  - Fuente seleccionada: ${
        build.psu
          ? `${build.psu.name} (${build.psu.effective12vWatts}W reales en +12V, carga ${power.psuLoadPercentage}%)`
          : 'Sin fuente'
      }`,
      '--------------------------------------------------------------------',
      '3. VALIDACIONES DE COMPATIBILIDAD FÍSICA Y LÓGICA:'
    );

    checks.forEach((c) => {
      const tag =
        c.severity === 'ok'
          ? '[OK]'
          : c.severity === 'warning'
          ? '[AVISO]'
          : c.severity === 'error'
          ? '[ERROR]'
          : '[PENDIENTE]';
      lines.push(`  ${tag} ${c.category}: ${c.summary}`);
    });

    if (studentNotes.trim()) {
      lines.push(
        '--------------------------------------------------------------------',
        '4. JUSTIFICACIÓN TÉCNICA DEL ALUMNO/A:',
        studentNotes.trim()
      );
    }

    lines.push('====================================================================');
    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    const text = generatePlainTextReport();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadTxt = () => {
    const text = generatePlainTextReport();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presupuesto-smr-${scenario.id}-${totalPrice}eur.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportJson = () => {
    const payload = {
      app: 'Simulador de Presupuestos y Compatibilidad SMR - Un Fantasma en el Sistema',
      exportedAt: new Date().toISOString(),
      studentName,
      studentGroup,
      schoolName,
      teacherName,
      studentNotes,
      useCaseId: scenario.id,
      budgetLimit,
      buildIds: {
        cpu: build.cpu?.id ?? null,
        motherboard: build.motherboard?.id ?? null,
        ram: build.ram?.id ?? null,
        cooler: build.cooler?.id ?? null,
        gpu: build.gpu?.id ?? null,
        storagePrimary: build.storagePrimary?.id ?? null,
        storageSecondary: build.storageSecondary?.id ?? null,
        pcCase: build.pcCase?.id ?? null,
        psu: build.psu?.id ?? null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `montaje-smr-${scenario.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportBuildIds) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && typeof parsed.buildIds === 'object') {
          if (parsed.studentName) setStudentName(parsed.studentName);
          if (parsed.studentGroup) setStudentGroup(parsed.studentGroup);
          if (parsed.schoolName) setSchoolName(parsed.schoolName);
          if (parsed.teacherName) setTeacherName(parsed.teacherName);
          if (parsed.studentNotes) setStudentNotes(parsed.studentNotes);
          onImportBuildIds(parsed.buildIds, parsed.useCaseId, parsed.budgetLimit);
          setImportError(null);
        } else {
          setImportError('El archivo JSON no contiene un montaje válido.');
        }
      } catch {
        setImportError('No se pudo leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
      {/* Top Header & PDF / Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Evaluación Formativa y Generador de Dossier PDF Oficial (Ref: {reportCode})
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Rúbrica de Calificación e Informe PDF para Entrega Formal
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Primary Stylized PDF Generator Button */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
          >
            <FileDown className="w-4 h-4" />
            {isGeneratingPdf
              ? 'Generando PDF Oficial...'
              : 'Descargar Informe PDF Estilizado'}
          </button>

          <button
            type="button"
            onClick={() => setShowA4Preview(!showA4Preview)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showA4Preview
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {showA4Preview ? 'Ocultar Vista Previa A4' : 'Vista Previa Dossier A4'}
          </button>

          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copiado
              </>
            ) : (
              <>
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copiar Texto
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar .JSON
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5" />
            Importar .JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {importError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
          {importError}
        </div>
      )}

      {/* Student Identification & Technical Justification Form (Used directly in the generated PDF) */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Datos de Cabecera para el Informe PDF del Estudiante
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completa tus datos antes de pulsar «Descargar Informe PDF Estilizado» para que figuren en el documento de entrega.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoDraftJustification}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Autocompletar Borrador Técnico
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre y Apellidos del Alumno/a
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Ej. Laura Gómez Pérez"
              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Curso / Módulo Profesional
            </label>
            <input
              type="text"
              value={studentGroup}
              onChange={(e) => setStudentGroup(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Centro Educativo / Taller
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Ej. IES Tecnológico"
              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Profesor/a Evaluador/a
            </label>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Ej. Dpto. Informática"
              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Memoria Justificativa de la Configuración (Incluida en la sección 4 del PDF)
            </label>
            <textarea
              rows={3}
              value={studentNotes}
              onChange={(e) => setStudentNotes(e.target.value)}
              placeholder="Justifica técnicamente la elección del socket, tipo de memoria RAM, holgura térmica del disipador y dimensionamiento de la fuente para el cliente..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Interactive Live A4 PDF Preview Panel */}
      {showA4Preview && (
        <div className="p-5 rounded-xl bg-slate-200/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              PREVISUALIZACIÓN DEL DOCUMENTO OFICIAL A4 (LISTO PARA EXPORTAR A PDF)
            </span>
            <button
              type="button"
              onClick={handleGeneratePdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              Descargar archivo .PDF ahora
            </button>
          </div>

          {/* Simulated A4 Sheet */}
          <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-md border border-slate-300 overflow-hidden">
            {/* Dark Header Banner matching jsPDF layout */}
            <div className="bg-slate-900 text-white p-5 border-b-4 border-sky-600 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-1.5 bg-slate-50 rounded-lg shrink-0">
                  <img
                    src={logoSrc}
                    alt="Logo Un Fantasma en el Sistema"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 object-contain shrink-0"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-wider text-sky-400">
                    MONTAJE Y REPARACIÓN DE SISTEMAS MICROINFORMÁTICOS · UN FANTASMA EN EL SISTEMA
                  </div>
                  <div className="text-lg font-bold tracking-tight">
                    INFORME TÉCNICO DE PRESUPUESTO Y COMPATIBILIDAD
                  </div>
                  <div className="text-xs text-slate-300">
                    https://www.unfantasmaenelsistema.com/ · Ref: {reportCode} · Fecha:{' '}
                    {new Date().toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono hidden sm:block">
                <div className="text-xs text-slate-400">NOTA RÚBRICA</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {evaluation.totalScore} / 10
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Alumno/a:</span>
                  <strong className="text-slate-900">
                    {studentName || 'Sin especificar'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Curso / Centro:</span>
                  <strong className="text-slate-900">
                    {studentGroup} ({schoolName})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Caso de Uso y Límite:</span>
                  <strong className="text-sky-700">
                    {scenario.shortTitle} (Máx: {budgetLimit} €)
                  </strong>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                <strong>Resumen de validación:</strong>{' '}
                {checks.filter((c) => c.severity === 'ok').length} subsistemas compatibles,{' '}
                {checks.filter((c) => c.severity === 'warning').length} advertencias y{' '}
                {checks.filter((c) => c.severity === 'error').length} errores críticos. Consumo pico:{' '}
                {power.totalMaxPeakWatts}W. Coste total IVA incl.:{' '}
                <strong>{totalPrice.toFixed(2)} €</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rubric Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Global Score Card */}
        <div className="md:col-span-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Nota Global del Montaje
            </span>
            <Award className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="my-3">
            <div className="text-4xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {evaluation.totalScore}{' '}
              <span className="text-lg font-normal text-slate-500">/ 10</span>
            </div>
            <div
              className={`mt-1 text-xs font-semibold ${
                evaluation.canBoot && evaluation.totalScore >= 5
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {evaluation.verdictTitle}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
            Nota: Cualquier incompatibilidad física o lógica que impida el arranque limita la nota máxima a 4.5 / 10.
          </div>
        </div>

        {/* 4 Criteria Breakdown */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                1. Compatibilidad Física y Lógica
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {evaluation.compatibilityScore} / 4.0 pts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Socket CPU/Placa, estándar DDR4/DDR5, nº de ranuras DIMM, salida de vídeo y cotas en mm.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                2. Ajuste al Presupuesto Fijado
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {evaluation.budgetScore} / 2.0 pts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Coste actual: {totalPrice} € frente a un límite máximo de {budgetLimit} €.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                3. Adecuación al Caso de Uso
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {evaluation.useCaseScore} / 2.5 pts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cumplimiento de núcleos, RAM, VRAM y almacenamiento para {scenario.shortTitle}.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                4. Equilibrio Térmico y Eléctrico
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {evaluation.balanceScore} / 1.5 pts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Holgura de disipación TDP, VRM de placa base, Dual Channel y margen de fuente PSU.
            </p>
          </div>
        </div>
      </div>

      {/* Checklist of Use Case Requirements */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Verificación de Requisitos del Cliente ({scenario.title})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {evaluation.useCaseChecklist.map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                item.met
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
              }`}
            >
              {item.met ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </div>
                <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                  {item.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Itemized Invoice Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="py-2.5 px-3 font-semibold">Categoría</th>
              <th className="py-2.5 px-3 font-semibold">Componente Seleccionado</th>
              <th className="py-2.5 px-3 font-semibold">Especificación Clave</th>
              <th className="py-2.5 px-3 font-semibold text-right font-mono">
                Precio (IVA incl.)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {SLOT_DEFINITIONS.map((slot) => {
              const part: any = build[slot.key];
              let keySpec = '—';
              if (part) {
                if (slot.key === 'cpu')
                  keySpec = `Socket ${part.socket} · ${part.cores}C/${part.threads}T · ${part.tdpWatts}W`;
                else if (slot.key === 'motherboard')
                  keySpec = `${part.socket} · ${part.formFactor} · ${part.ramSlots}x ${part.ramType}`;
                else if (slot.key === 'ram')
                  keySpec = `${part.totalCapacityGb}GB (${part.modules}x${part.capacityPerModuleGb}GB) ${part.ramType}-${part.speedMhz}`;
                else if (slot.key === 'cooler')
                  keySpec = `Máx ${part.maxTdpWatts}W · Altura ${part.heightMm} mm`;
                else if (slot.key === 'gpu')
                  keySpec =
                    part.vramGb > 0
                      ? `${part.vramGb}GB VRAM · ${part.tdpWatts}W · ${part.lengthMm} mm`
                      : 'Gráficos integrados en CPU';
                else if (
                  slot.key === 'storagePrimary' ||
                  slot.key === 'storageSecondary'
                )
                  keySpec = `${part.interface} · ${part.readSpeedMbs} MB/s`;
                else if (slot.key === 'pcCase')
                  keySpec = `${part.supportedFormFactors.join('/')} · Cooler ≤${
                    part.maxCoolerHeightMm
                  }mm`;
                else if (slot.key === 'psu')
                  keySpec = `${part.wattage}W (${part.effective12vWatts}W +12V) · ${part.efficiency}`;
              }

              return (
                <tr
                  key={slot.key}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40"
                >
                  <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {slot.label}
                  </td>
                  <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 font-medium">
                    {part ? (
                      part.name
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic">
                        Sin seleccionar
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                    {keySpec}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {part ? `${part.price.toFixed(2)} €` : '0.00 €'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 font-mono">
            <tr>
              <td
                colSpan={3}
                className="py-2 px-3 text-right text-slate-500 dark:text-slate-400"
              >
                Base Imponible (Sin IVA):
              </td>
              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                {netPriceNoVat.toFixed(2)} €
              </td>
            </tr>
            <tr>
              <td
                colSpan={3}
                className="py-2 px-3 text-right text-slate-500 dark:text-slate-400"
              >
                Cuota IVA (21%):
              </td>
              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                {vatAmount.toFixed(2)} €
              </td>
            </tr>
            <tr className="text-sm font-bold border-t border-slate-200 dark:border-slate-800">
              <td
                colSpan={3}
                className="py-3 px-3 text-right text-slate-900 dark:text-slate-100"
              >
                TOTAL PRESUPUESTO (Límite: {budgetLimit} €):
              </td>
              <td
                className={`py-3 px-3 text-right ${
                  totalPrice <= budgetLimit
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {totalPrice.toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
