import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Power,
  RotateCcw,
  ShieldAlert,
  Wind,
  Zap,
} from 'lucide-react';
import {
  CompatibilityCheckItem,
  ComponentSlotKey,
  PCBuildState,
} from '../types/hardware';
import { PowerBreakdown } from '../utils/compatibilityEngine';
import { evaluateWiringDiagnostics, WiringState } from './WiringAndBiosLab';

interface InteractiveArchitectureDiagramProps {
  build: PCBuildState;
  activeSlot: ComponentSlotKey;
  onSelectSlot: (slot: ComponentSlotKey) => void;
  checks: CompatibilityCheckItem[];
  power: PowerBreakdown;
  wiring?: WiringState;
}

interface PostTestResult {
  tested: boolean;
  success: boolean;
  haltedStage: 'NONE' | 'MECHANICAL' | 'WIRING' | 'PSU' | 'CPU' | 'DRAM' | 'VGA' | 'BOOT';
  beepCode: string;
  diagnosticMessage: string;
}

export const InteractiveArchitectureDiagram: React.FC<
  InteractiveArchitectureDiagramProps
> = ({ build, activeSlot, onSelectSlot, checks, power, wiring }) => {
  const [postState, setPostState] = useState<PostTestResult>({
    tested: false,
    success: false,
    haltedStage: 'NONE',
    beepCode: '',
    diagnosticMessage: '',
  });

  const getCheckStatus = (checkId: string) => {
    return checks.find((c) => c.id === checkId)?.severity ?? 'pending';
  };

  const socketSeverity = getCheckStatus('check-socket');
  const ramSeverity = getCheckStatus('check-ram');
  const videoSeverity = getCheckStatus('check-video');
  const coolerClearanceSeverity = getCheckStatus('check-cooler-clearance');
  const tdpSeverity = getCheckStatus('check-tdp');
  const gpuClearanceSeverity = getCheckStatus('check-gpu-clearance');
  const formFactorSeverity = getCheckStatus('check-form-factor');
  const psuSeverity = getCheckStatus('check-psu');
  const storageSeverity = getCheckStatus('check-storage');

  const runPostSimulation = () => {
    // 1. Check mechanical/assembly blocks first
    if (!build.motherboard || !build.pcCase) {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'MECHANICAL',
        beepCode: 'Sin encendido (Montaje incompleto)',
        diagnosticMessage:
          'Falta instalar la placa base o el chasis antes de conectar el cableado del panel frontal (PWR_SW).',
      });
      return;
    }

    if (
      formFactorSeverity === 'error' ||
      coolerClearanceSeverity === 'error' ||
      gpuClearanceSeverity === 'error'
    ) {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'MECHANICAL',
        beepCode: 'Bloqueo Físico en Taller',
        diagnosticMessage:
          'Existen colisiones dimensionales físicas (formato de placa, altura de disipador o longitud de GPU que superan el chasis). Corrige las cotas en milímetros antes de energizar.',
      });
      return;
    }

    // 2. Check Wiring & Front Panel if provided
    if (wiring) {
      const wiringDiag = evaluateWiringDiagnostics(build, wiring);
      if (!wiringDiag.canPowerOn) {
        setPostState({
          tested: true,
          success: false,
          haltedStage: 'WIRING',
          beepCode: 'Fallo de Cableado Interno / F_PANEL',
          diagnosticMessage: wiringDiag.errors[0],
        });
        return;
      }
    }

    // 3. Check PSU
    if (!build.psu || psuSeverity === 'error') {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'PSU',
        beepCode: 'Corte por Protección OPP/OCP (Sin pitidos)',
        diagnosticMessage: !build.psu
          ? 'No se ha instalado fuente de alimentación (conectores ATX 24 pines y EPS 8 pines desconectados).'
          : 'La fuente de alimentación se apaga por protección de sobrecarga en la línea de +12V o carece de conectores PCIe requeridos por la GPU.',
      });
      return;
    }

    // 4. Check CPU & Cooler (EZ-Debug LED: CPU)
    if (!build.cpu || !build.cooler || socketSeverity === 'error' || tdpSeverity === 'error') {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'CPU',
        beepCode: 'LED EZ-Debug CPU Encendido Fijo',
        diagnosticMessage:
          !build.cpu || socketSeverity === 'error'
            ? 'El procesador no está instalado o el socket es incompatible con la placa base.'
            : 'Protección térmica CPU Over Temperature Error: el disipador no está instalado o su capacidad TDP es inferior al mínimo de la CPU.',
      });
      return;
    }

    // 5. Check DRAM (EZ-Debug LED: DRAM)
    if (!build.ram || ramSeverity === 'error') {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'DRAM',
        beepCode: 'AMI BIOS: 3 pitidos cortos (Fallo de Memoria DRAM)',
        diagnosticMessage:
          'El entrenamiento de memoria ha fallado: no hay módulos instalados, el estándar DDR4/DDR5 no coincide con la placa o el kit tiene más módulos que ranuras DIMM.',
      });
      return;
    }

    // 6. Check VGA (EZ-Debug LED: VGA)
    if (!build.gpu || videoSeverity === 'error') {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'VGA',
        beepCode: 'AMI BIOS: 1 pitido largo y 3 cortos (Fallo VGA)',
        diagnosticMessage:
          'LED EZ-Debug VGA encendido: el procesador no dispone de gráficos integrados (iGPU) y no se ha detectado ninguna tarjeta gráfica dedicada en el bus PCIe.',
      });
      return;
    }

    // 7. Check BOOT / Storage (EZ-Debug LED: BOOT)
    if (!build.storagePrimary || storageSeverity === 'error') {
      setPostState({
        tested: true,
        success: false,
        haltedStage: 'BOOT',
        beepCode: '1 pitido corto → Detenido en UEFI (LED BOOT)',
        diagnosticMessage:
          'El equipo da vídeo pero no detecta unidad de almacenamiento válida o se han excedido las ranuras M.2/bahías disponibles.',
      });
      return;
    }

    // All passed!
    setPostState({
      tested: true,
      success: true,
      haltedStage: 'NONE',
      beepCode: '1 pitido corto (POST Correcto — Sistema Operativo Listo)',
      diagnosticMessage: `POST superado con éxito: ${build.cpu.name} @ ${build.cpu.boostClockGhz} GHz · ${build.ram.totalCapacityGb} GB ${build.ram.ramType}-${build.ram.speedMhz} (${build.ram.modules >= 2 ? 'Dual Channel' : 'Single Channel'}) · Salida de vídeo activa y voltajes +12V estables.`,
    });
  };

  // Dimensional percentages for visual bars
  const coolerRatio =
    build.cooler && build.pcCase
      ? Math.min(125, Math.round((build.cooler.heightMm / build.pcCase.maxCoolerHeightMm) * 100))
      : 0;

  const gpuRatio =
    build.gpu && build.pcCase && build.gpu.lengthMm > 0
      ? Math.min(125, Math.round((build.gpu.lengthMm / build.pcCase.maxGpuLengthMm) * 100))
      : 0;

  const slotStatusBadge = (severity: CompatibilityCheckItem['severity']) => {
    if (severity === 'error') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          Incompatibilidad
        </span>
      );
    }
    if (severity === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Revisar
        </span>
      );
    }
    if (severity === 'ok') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Compatible
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">Pendiente</span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
      {/* Header + Interactive POST Tester */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Banco de Pruebas e Inspección Mecánica/Lógica
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Esquema Interactivo de Arquitectura de la Torre
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={runPostSimulation}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Power className="w-4 h-4" />
            Simular Encendido POST (BIOS)
          </button>
          {postState.tested && (
            <button
              type="button"
              onClick={() =>
                setPostState({
                  tested: false,
                  success: false,
                  haltedStage: 'NONE',
                  beepCode: '',
                  diagnosticMessage: '',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Reiniciar test POST"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Apagar
            </button>
          )}
        </div>
      </div>

      {/* EZ-Debug LEDs & POST Result Banner */}
      {postState.tested && (
        <div
          className={`p-4 rounded-lg border ${
            postState.success
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80'
              : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {postState.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {postState.beepCode}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {postState.diagnosticMessage}
              </p>
            </div>

            {/* Motherboard EZ-Debug 4-LED Panel */}
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-lg bg-slate-900 text-slate-200 border border-slate-700 shrink-0">
              <span className="text-[11px] font-mono text-slate-400">EZ-DEBUG LED:</span>
              {(['CPU', 'DRAM', 'VGA', 'BOOT'] as const).map((led) => {
                const isFault = postState.haltedStage === led;
                return (
                  <div
                    key={led}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                      isFault
                        ? 'bg-rose-600 text-white border-rose-400'
                        : postState.success
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {led}: {isFault ? 'FALLO' : postState.success ? 'OK' : '—'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Chassis + Motherboard Schematic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 cols: Chassis & Motherboard Interactive Blueprint */}
        <div className="lg:col-span-8 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
          {/* Chassis Frame Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onSelectSlot('pcCase')}
              className={`text-left group cursor-pointer transition-colors ${
                activeSlot === 'pcCase'
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400'
              }`}
            >
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                CHASIS / ENVOLVENTE MECÁNICA (Clic para cambiar)
              </div>
              <div className="text-sm font-semibold">
                {build.pcCase ? build.pcCase.name : 'Sin Chasis Seleccionado'}
              </div>
            </button>

            <div className="flex items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span>
                Formatos:{' '}
                <strong className="text-slate-900 dark:text-slate-200">
                  {build.pcCase ? build.pcCase.supportedFormFactors.join(' / ') : '—'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              {slotStatusBadge(formFactorSeverity)}
            </div>
          </div>

          {/* Motherboard Tray Container */}
          <div
            className={`rounded-lg border p-3.5 transition-colors ${
              formFactorSeverity === 'error'
                ? 'border-rose-500/80 bg-rose-500/5'
                : activeSlot === 'motherboard'
                ? 'border-sky-500 bg-sky-500/5'
                : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/90'
            }`}
          >
            {/* Motherboard Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSelectSlot('motherboard')}
                className="text-left cursor-pointer group"
              >
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  PLACA BASE (PCB {build.motherboard?.formFactor ?? 'Formato no elegido'})
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  {build.motherboard
                    ? `${build.motherboard.name} · Socket ${build.motherboard.socket} · ${build.motherboard.ramType}`
                    : 'Haz clic para seleccionar Placa Base'}
                </div>
              </button>
              {build.motherboard && (
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  VRM máx: {build.motherboard.maxRecommendedCpuWatts}W · PCIe{' '}
                  {build.motherboard.maxPcieVersion}.0
                </div>
              )}
            </div>

            {/* Upper Motherboard Zone: CPU Socket + Cooler + DIMM Slots */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
              {/* CPU Socket Slot (4 cols) */}
              <button
                type="button"
                onClick={() => onSelectSlot('cpu')}
                className={`md:col-span-4 text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  socketSeverity === 'error'
                    ? 'border-rose-500 bg-rose-500/10'
                    : activeSlot === 'cpu'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    ZÓCALO CPU
                  </span>
                  <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {build.cpu ? build.cpu.name : 'Instalar Procesador'}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  <span>
                    {build.cpu
                      ? `${build.cpu.socket} · ${build.cpu.cores}C/${build.cpu.threads}T`
                      : 'Sin CPU'}
                  </span>
                  <span>{build.cpu ? `${build.cpu.tdpWatts}W` : ''}</span>
                </div>
              </button>

              {/* CPU Cooler Slot (4 cols) */}
              <button
                type="button"
                onClick={() => onSelectSlot('cooler')}
                className={`md:col-span-4 text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  coolerClearanceSeverity === 'error' || tdpSeverity === 'error'
                    ? 'border-rose-500 bg-rose-500/10'
                    : tdpSeverity === 'warning'
                    ? 'border-amber-500 bg-amber-500/10'
                    : activeSlot === 'cooler'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    DISIPADOR CPU
                  </span>
                  <Wind className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {build.cooler ? build.cooler.name : 'Instalar Disipador'}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  <span>
                    {build.cooler ? `Alt: ${build.cooler.heightMm} mm` : 'Sin Cooler'}
                  </span>
                  <span>
                    {build.cooler ? `Máx ${build.cooler.maxTdpWatts}W` : ''}
                  </span>
                </div>
              </button>

              {/* RAM DIMM Banks (4 cols) */}
              <button
                type="button"
                onClick={() => onSelectSlot('ram')}
                className={`md:col-span-4 text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  ramSeverity === 'error'
                    ? 'border-rose-500 bg-rose-500/10'
                    : ramSeverity === 'warning'
                    ? 'border-amber-500 bg-amber-500/10'
                    : activeSlot === 'ram'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    BANCOS DIMM ({build.motherboard ? `${build.motherboard.ramSlots} SLOTS ${build.motherboard.ramType}` : 'RAM'})
                  </span>
                  <MemoryStick className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {build.ram ? build.ram.name : 'Instalar Memoria RAM'}
                </div>
                {/* Visual DIMM slot bars */}
                <div className="mt-2 flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((slotIndex) => {
                    const maxBoardSlots = build.motherboard?.ramSlots ?? 4;
                    const installedModules = build.ram?.modules ?? 0;
                    const isSlotPresentOnBoard = slotIndex <= maxBoardSlots;
                    const isPopulated = slotIndex <= installedModules;
                    const isOverflow = slotIndex <= installedModules && !isSlotPresentOnBoard;

                    return (
                      <div
                        key={slotIndex}
                        className={`h-2.5 flex-1 rounded-xs border ${
                          isOverflow
                            ? 'bg-rose-500 border-rose-400'
                            : isPopulated
                            ? 'bg-sky-500 border-sky-400'
                            : isSlotPresentOnBoard
                            ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                            : 'bg-transparent border-dashed border-slate-300 dark:border-slate-800 opacity-35'
                        }`}
                        title={
                          isOverflow
                            ? `Módulo #${slotIndex} sin zócalo físico en placa`
                            : isPopulated
                            ? `DIMM #${slotIndex} ocupado`
                            : isSlotPresentOnBoard
                            ? `DIMM #${slotIndex} libre`
                            : 'No existe en esta placa'
                        }
                      />
                    );
                  })}
                </div>
              </button>
            </div>

            {/* Lower Motherboard Zone: PCIe x16 GPU Slot + M.2 & SATA Storage */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* PCIe x16 Graphics Slot (7 cols) */}
              <button
                type="button"
                onClick={() => onSelectSlot('gpu')}
                className={`md:col-span-7 text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  videoSeverity === 'error' || gpuClearanceSeverity === 'error'
                    ? 'border-rose-500 bg-rose-500/10'
                    : activeSlot === 'gpu'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    BUS PCIe x16 PRINCIPAL / SALIDA DE VÍDEO
                  </span>
                  <Monitor className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {build.gpu ? build.gpu.name : 'Seleccionar GPU o Gráficos Integrados'}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  <span>
                    {build.gpu
                      ? build.gpu.id === 'gpu-igpu'
                        ? build.cpu?.hasIntegratedGraphics
                          ? `iGPU: ${build.cpu.igpuName}`
                          : '¡CPU SIN iGPU!'
                        : `${build.gpu.vramGb} GB VRAM · Longitud: ${build.gpu.lengthMm} mm`
                      : 'Pendiente'}
                  </span>
                  <span>{build.gpu ? `${build.gpu.tdpWatts}W` : ''}</span>
                </div>
              </button>

              {/* Storage M.2 & SATA Slots (5 cols) */}
              <div className="md:col-span-5 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectSlot('storagePrimary')}
                  className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    storageSeverity === 'error'
                      ? 'border-rose-500 bg-rose-500/10'
                      : activeSlot === 'storagePrimary'
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span>UNIDAD PRINCIPAL (SO / BOOT)</span>
                    <HardDrive className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {build.storagePrimary
                      ? build.storagePrimary.name
                      : 'Seleccionar Disco Principal'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSlot('storageSecondary')}
                  className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    activeSlot === 'storageSecondary'
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span>UNIDAD SECUNDARIA (DATOS / BACKUP)</span>
                    <span>Opcional</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {build.storageSecondary
                      ? build.storageSecondary.name
                      : 'Sin disco secundario (Clic para añadir)'}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom PSU Shroud Zone */}
          <button
            type="button"
            onClick={() => onSelectSlot('psu')}
            className={`w-full text-left p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              psuSeverity === 'error'
                ? 'border-rose-500 bg-rose-500/10'
                : psuSeverity === 'warning'
                ? 'border-amber-500 bg-amber-500/10'
                : activeSlot === 'psu'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  CÁMARA INFERIOR: FUENTE DE ALIMENTACIÓN (PSU +12V)
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {build.psu ? build.psu.name : 'Seleccionar Fuente de Alimentación'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono shrink-0">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Pico Sistema: </span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {power.totalMaxPeakWatts} W
                </strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Raíl +12V: </span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {build.psu ? `${build.psu.effective12vWatts} W` : '—'}
                </strong>
              </div>
              {slotStatusBadge(psuSeverity)}
            </div>
          </button>
        </div>

        {/* Right 4 cols: Physical Clearances (mm) & Energy Telemetry Gauges */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cotas Dimensionales y Balance Térmico
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verificación física en milímetros y vatios en tiempo real
              </p>
            </div>

            {/* Gauge 1: Cooler Height vs Case Max Cooler Height */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Altura Disipador vs. Ancho Caja
                </span>
                <span className="font-mono text-slate-900 dark:text-slate-100">
                  {build.cooler ? `${build.cooler.heightMm} mm` : '—'} /{' '}
                  {build.pcCase ? `${build.pcCase.maxCoolerHeightMm} mm` : '—'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    coolerClearanceSeverity === 'error'
                      ? 'bg-rose-500'
                      : coolerRatio > 92
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, coolerRatio)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {build.cooler && build.pcCase
                  ? build.cooler.heightMm <= build.pcCase.maxCoolerHeightMm
                    ? `Holgura libre hasta tapa lateral: +${
                        build.pcCase.maxCoolerHeightMm - build.cooler.heightMm
                      } mm`
                    : `¡Colisión! Sobresale ${
                        build.cooler.heightMm - build.pcCase.maxCoolerHeightMm
                      } mm del chasis`
                  : 'Selecciona disipador y caja'}
              </p>
            </div>

            {/* Gauge 2: GPU Length vs Case Max GPU Length */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Longitud GPU vs. Interior Caja
                </span>
                <span className="font-mono text-slate-900 dark:text-slate-100">
                  {build.gpu ? `${build.gpu.lengthMm} mm` : '—'} /{' '}
                  {build.pcCase ? `${build.pcCase.maxGpuLengthMm} mm` : '—'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    gpuClearanceSeverity === 'error'
                      ? 'bg-rose-500'
                      : gpuRatio > 92
                      ? 'bg-amber-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${Math.min(100, gpuRatio)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {build.gpu && build.pcCase
                  ? build.gpu.lengthMm === 0
                    ? 'Usando iGPU integrada en CPU (0 mm ocupados)'
                    : build.gpu.lengthMm <= build.pcCase.maxGpuLengthMm
                    ? `Espacio libre hasta frontal: +${
                        build.pcCase.maxGpuLengthMm - build.gpu.lengthMm
                      } mm`
                    : `¡Colisión! Excede en ${
                        build.gpu.lengthMm - build.pcCase.maxGpuLengthMm
                      } mm el largo de la caja`
                  : 'Selecciona tarjeta gráfica y caja'}
              </p>
            </div>

            {/* Gauge 3: CPU Turbo TDP vs Cooler Max TDP */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Calor CPU (Turbo) vs. Disipador
                </span>
                <span className="font-mono text-slate-900 dark:text-slate-100">
                  {build.cpu ? `${build.cpu.maxTurboWatts} W` : '—'} /{' '}
                  {build.cooler ? `${build.cooler.maxTdpWatts} W` : '—'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    tdpSeverity === 'error'
                      ? 'bg-rose-500'
                      : tdpSeverity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width:
                      build.cpu && build.cooler
                        ? `${Math.min(
                            100,
                            Math.round((build.cpu.maxTurboWatts / build.cooler.maxTdpWatts) * 100)
                          )}%`
                        : '0%',
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {build.cpu && build.cooler
                  ? `TDP Base: ${build.cpu.tdpWatts}W · Pico Turbo: ${build.cpu.maxTurboWatts}W · Cooler: ${build.cooler.maxTdpWatts}W`
                  : 'Selecciona CPU y sistema de refrigeración'}
              </p>
            </div>

            {/* Gauge 4: Total System Power vs PSU +12V Capacity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Carga Eléctrica sobre Fuente (+12V)
                </span>
                <span className="font-mono text-slate-900 dark:text-slate-100">
                  {power.totalMaxPeakWatts} W /{' '}
                  {build.psu ? `${build.psu.effective12vWatts} W` : '—'}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    psuSeverity === 'error'
                      ? 'bg-rose-500'
                      : psuSeverity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, power.psuLoadPercentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span>CPU: {power.cpuMaxWatts}W</span>
                <span>GPU: {power.gpuWatts}W</span>
                <span>Placa/RAM/Discos: {power.motherboardAndFansWatts + power.ramWatts + power.storageWatts}W</span>
              </div>
            </div>
          </div>

          {/* Quick Educational Tip Box */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              Consejo de Taller SMR:{' '}
            </span>
            Haz clic en cualquier bloque del plano (Zócalo CPU, RAM, GPU, Disipador o PSU) para abrir directamente su catálogo filtrado.
          </div>
        </div>
      </div>
    </div>
  );
};
