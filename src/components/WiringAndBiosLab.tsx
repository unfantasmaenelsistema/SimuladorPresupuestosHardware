import React, { useState } from 'react';
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  Cpu,
  HardDrive,
  Power,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sliders,
  Terminal,
  Zap,
} from 'lucide-react';
import { PCBuildState, UseCaseId } from '../types/hardware';

export interface WiringState {
  atx24Pin: boolean;
  cpuEps8Pin: 'disconnected' | 'eps8pin_correct' | 'pcie8pin_forced_error';
  cpuFanHeader: 'disconnected' | 'cpu_fan' | 'sys_fan_warning';
  gpuPowerCable: 'disconnected' | 'connected';
  sataPowerAndData: 'disconnected' | 'connected';
  frontPanelPwrSw: boolean;
  frontPanelResetSw: boolean;
  frontPanelPwrLed: 'disconnected' | 'correct_polarity' | 'reversed_polarity';
  frontPanelHddLed: 'disconnected' | 'correct_polarity' | 'reversed_polarity';
}

export interface BiosSettingsState {
  memoryProfileXmpExpo: boolean;
  virtualizationEnabled: boolean;
  resizableBar: boolean;
  bootMode: 'UEFI_GPT' | 'CSM_LEGACY';
  fanCurve: 'SILENT' | 'STANDARD' | 'TURBO';
}

interface WiringAndBiosLabProps {
  build: PCBuildState;
  useCaseId: UseCaseId;
  wiring: WiringState;
  onChangeWiring: React.Dispatch<React.SetStateAction<WiringState>>;
  bios: BiosSettingsState;
  onChangeBios: React.Dispatch<React.SetStateAction<BiosSettingsState>>;
}

export const DEFAULT_WIRING_STATE: WiringState = {
  atx24Pin: true,
  cpuEps8Pin: 'eps8pin_correct',
  cpuFanHeader: 'cpu_fan',
  gpuPowerCable: 'connected',
  sataPowerAndData: 'connected',
  frontPanelPwrSw: true,
  frontPanelResetSw: true,
  frontPanelPwrLed: 'correct_polarity',
  frontPanelHddLed: 'correct_polarity',
};

export const UNWIRED_WORKSHOP_STATE: WiringState = {
  atx24Pin: false,
  cpuEps8Pin: 'disconnected',
  cpuFanHeader: 'disconnected',
  gpuPowerCable: 'disconnected',
  sataPowerAndData: 'disconnected',
  frontPanelPwrSw: false,
  frontPanelResetSw: false,
  frontPanelPwrLed: 'disconnected',
  frontPanelHddLed: 'disconnected',
};

export const DEFAULT_BIOS_STATE: BiosSettingsState = {
  memoryProfileXmpExpo: true,
  virtualizationEnabled: true,
  resizableBar: true,
  bootMode: 'UEFI_GPT',
  fanCurve: 'STANDARD',
};

export function evaluateWiringDiagnostics(
  build: PCBuildState,
  wiring: WiringState
): {
  canPowerOn: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!wiring.frontPanelPwrSw) {
    errors.push(
      'F_PANEL (Pines 6-8 PWR_SW desconectados): Al pulsar el botón de encendido de la caja no llega el pulso de cierre de circuito a la placa base.'
    );
  }
  if (!wiring.atx24Pin) {
    errors.push(
      'Conector ATX 24 pines desconectado: La placa base carece de alimentación principal (+12V, +5V, +3.3V y señal PS_ON#).'
    );
  }
  if (wiring.cpuEps8Pin === 'disconnected') {
    errors.push(
      'Conector EPS 12V (4+4 pines CPU) desconectado: Los ventiladores giran pero el VRM del procesador no recibe +12V (LED EZ-Debug CPU encendido).'
    );
  } else if (wiring.cpuEps8Pin === 'pcie8pin_forced_error') {
    errors.push(
      '¡CORTOCIRCUITO CRÍTICO!: Has forzado un cable PCIe de 6+2 pines (de tarjeta gráfica) en el conector EPS 12V de la CPU. Tienen polaridad invertida (+12V y Masa cruzados), activando la protección SCP de la fuente.'
    );
  }

  if (wiring.cpuFanHeader === 'disconnected') {
    errors.push(
      'Cable PWM del disipador desconectado de CPU_FAN: El ventilador no gira y la BIOS bloquea el arranque con el mensaje "CPU Fan Error! Press F1 to Run Setup".'
    );
  } else if (wiring.cpuFanHeader === 'sys_fan_warning') {
    warnings.push(
      'Disipador conectado en SYS_FAN/CHA_FAN en vez de CPU_FAN: La placa no detecta tacómetro en CPU_FAN, muestra alerta en el POST y no regula bien la curva térmica de la CPU.'
    );
  }

  const requiresPcieCable = Boolean(build.gpu?.requiresPciePowerConnector);
  if (requiresPcieCable && wiring.gpuPowerCable === 'disconnected') {
    errors.push(
      `Alimentación PCIe de la GPU desconectada: La tarjeta ${build.gpu?.name} exige alimentación adicional de la fuente y no dará señal de vídeo.`
    );
  }

  const hasSataDrive =
    build.storagePrimary?.interface === 'SATA III' ||
    build.storageSecondary?.interface === 'SATA III';
  if (hasSataDrive && wiring.sataPowerAndData === 'disconnected') {
    errors.push(
      'Cables SATA (Datos L-Shape + Alimentación 15 pines) desconectados: Las unidades de 2.5" / 3.5" instaladas no son detectadas en la UEFI.'
    );
  }

  if (!wiring.frontPanelResetSw) {
    warnings.push(
      'F_PANEL (Pines 5-7 RESET_SW desconectados): El equipo encenderá, pero el botón físico de reinicio del chasis no funcionará.'
    );
  }
  if (wiring.frontPanelPwrLed === 'reversed_polarity') {
    warnings.push(
      'F_PANEL (POWER LED con polaridad invertida +/-): Como los diodos LED solo conducen en polarización directa, el piloto de encendido no se iluminará.'
    );
  } else if (wiring.frontPanelPwrLed === 'disconnected') {
    warnings.push('F_PANEL (POWER LED desconectado): El indicador luminoso de encendido estará apagado.');
  }

  if (wiring.frontPanelHddLed === 'reversed_polarity') {
    warnings.push(
      'F_PANEL (HDD LED con polaridad invertida +/-): El piloto de actividad de disco no parpadeará.'
    );
  }

  return {
    canPowerOn: errors.length === 0,
    errors,
    warnings,
  };
}

export const WiringAndBiosLab: React.FC<WiringAndBiosLabProps> = ({
  build,
  useCaseId,
  wiring,
  onChangeWiring,
  bios,
  onChangeBios,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'wiring' | 'bios'>('wiring');
  const wiringDiag = evaluateWiringDiagnostics(build, wiring);

  const requiresPcieCable = Boolean(build.gpu?.requiresPciePowerConnector);
  const hasSataDrive =
    build.storagePrimary?.interface === 'SATA III' ||
    build.storageSecondary?.interface === 'SATA III';

  const jedecDefaultSpeed =
    build.ram?.ramType === 'DDR5' ? 4800 : build.ram?.ramType === 'DDR4' ? 2133 : 0;
  const effectiveRamSpeed = build.ram
    ? bios.memoryProfileXmpExpo
      ? build.ram.speedMhz
      : Math.min(build.ram.speedMhz, jedecDefaultSpeed)
    : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
      {/* Header & Sub-tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Práctica de Taller SMR — Fase Post-Ensamblaje Mecánico
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Simulador de Cableado Interno (F_PANEL / PSU) y Configuración UEFI/BIOS
          </h2>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('wiring')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'wiring'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            1. Cableado y Pines F_PANEL
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('bios')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'bios'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            2. Setup UEFI / BIOS
          </button>
        </div>
      </div>

      {activeSubTab === 'wiring' ? (
        <div className="space-y-5">
          {/* Quick Practice Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Practica la conexión de los cables de la fuente y del frontal de la caja, o pulsa{' '}
              <strong>«Desconectar Todo»</strong> para realizar el ejercicio de cableado desde cero.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onChangeWiring(UNWIRED_WORKSHOP_STATE)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Desconectar Todo (Practicar)
              </button>
              <button
                type="button"
                onClick={() => onChangeWiring(DEFAULT_WIRING_STATE)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectar Todo Correctamente
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 cols: Power & Internal Motherboard Cables */}
            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                A. Cableado de Alimentación (PSU) y Ventilación PWM
              </h3>

              {/* 1. ATX 24-Pin */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    1. Conector Principal ATX 24 Pines (20+4 pines)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Suministra +12V, +5V, +3.3V, +5VSB y el cable verde PS_ON# para encender la fuente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeWiring((w) => ({ ...w, atx24Pin: !w.atx24Pin }))
                  }
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    wiring.atx24Pin
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {wiring.atx24Pin ? 'Conectado (24-Pin OK)' : 'Desconectado'}
                </button>
              </div>

              {/* 2. CPU EPS 8-Pin vs PCIe 6+2-Pin Trap */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      2. Alimentación CPU_PWR1 (Zócalo EPS 12V de 8 pines)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      ¡Cuidado en el taller! No confundir el cable <strong>CPU 4+4 pines</strong> con el cable <strong>PCIe 6+2 pines</strong>.
                    </p>
                  </div>
                  <select
                    value={wiring.cpuEps8Pin}
                    onChange={(e) =>
                      onChangeWiring((w) => ({
                        ...w,
                        cpuEps8Pin: e.target.value as WiringState['cpuEps8Pin'],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none ${
                      wiring.cpuEps8Pin === 'eps8pin_correct'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40'
                    }`}
                  >
                    <option value="eps8pin_correct">
                      Cable EPS 12V (4+4 pines) [Correcto]
                    </option>
                    <option value="disconnected">Desconectado (Sin cable)</option>
                    <option value="pcie8pin_forced_error">
                      Forzar cable PCIe (6+2 pines) [¡Cortocircuito!]
                    </option>
                  </select>
                </div>
              </div>

              {/* 3. CPU_FAN PWM Header */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    3. Conector PWM de 4 pines del Disipador ({build.cooler?.name ?? 'Cooler CPU'})
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Debe conectarse siempre en el cabezal <code>CPU_FAN</code> junto al socket.
                  </p>
                </div>
                <select
                  value={wiring.cpuFanHeader}
                  onChange={(e) =>
                    onChangeWiring((w) => ({
                      ...w,
                      cpuFanHeader: e.target.value as WiringState['cpuFanHeader'],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none ${
                    wiring.cpuFanHeader === 'cpu_fan'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : wiring.cpuFanHeader === 'sys_fan_warning'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40'
                  }`}
                >
                  <option value="cpu_fan">Conectado en CPU_FAN (4-Pin PWM)</option>
                  <option value="sys_fan_warning">
                    Conectado por error en SYS_FAN_1
                  </option>
                  <option value="disconnected">Desconectado (Ventilador parado)</option>
                </select>
              </div>

              {/* 4. GPU PCIe Power & SATA Power/Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      4. Alimentación PCIe Tarjeta Gráfica
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {requiresPcieCable
                        ? `Requerido por ${build.gpu?.name} (${build.gpu?.tdpWatts}W).`
                        : 'No requerido (iGPU o tarjeta alimentada por ranura PCIe ≤ 75W).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeWiring((w) => ({
                        ...w,
                        gpuPowerCable:
                          w.gpuPowerCable === 'connected' ? 'disconnected' : 'connected',
                      }))
                    }
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      !requiresPcieCable || wiring.gpuPowerCable === 'connected'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {!requiresPcieCable
                      ? 'No requiere cable PCIe extra'
                      : wiring.gpuPowerCable === 'connected'
                      ? 'PCIe 6+2 / 12VHPWR Conectado'
                      : 'PCIe Desconectado (¡Fallo!)'}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      5. Cableado SATA Datos + Alimentación
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {hasSataDrive
                        ? 'Requerido para las unidades SSD 2.5" / HDD 3.5" instaladas.'
                        : 'Unidades M.2 NVMe se conectan directo al zócalo de la placa.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeWiring((w) => ({
                        ...w,
                        sataPowerAndData:
                          w.sataPowerAndData === 'connected'
                            ? 'disconnected'
                            : 'connected',
                      }))
                    }
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      !hasSataDrive || wiring.sataPowerAndData === 'connected'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {!hasSataDrive
                      ? 'Solo M.2 NVMe (Sin cables SATA)'
                      : wiring.sataPowerAndData === 'connected'
                      ? 'Cables SATA Conectados'
                      : 'SATA Desconectado (¡Sin disco!)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Interactive 9-Pin Intel Standard Front Panel Header (JFP1 / F_PANEL) */}
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    B. Cabezal Panel Frontal (JFP1 / F_PANEL 9 Pines)
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    Estándar Intel 2×5
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Haz clic en cada conector del pinout para alternar su conexión y comprobar qué pines tienen <strong>polaridad (+/-)</strong> y cuáles son pulsadores sin polaridad:
                </p>

                {/* Visual 2x5 Pin Header Schematic */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 space-y-2.5 font-mono">
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>FILA SUPERIOR (Pines Pares: 2, 4, 6, 8, 10)</span>
                    <span>Pin 9 = NC</span>
                  </div>

                  {/* Top Row: Pins 2 & 4 (PWR_LED), Pins 6 & 8 (PWR_SW), Pin 10 (Empty/Key) */}
                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeWiring((w) => ({
                          ...w,
                          frontPanelPwrLed:
                            w.frontPanelPwrLed === 'correct_polarity'
                              ? 'reversed_polarity'
                              : w.frontPanelPwrLed === 'reversed_polarity'
                              ? 'disconnected'
                              : 'correct_polarity',
                        }))
                      }
                      className={`col-span-2 p-2 rounded border text-left transition-colors cursor-pointer ${
                        wiring.frontPanelPwrLed === 'correct_polarity'
                          ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                          : wiring.frontPanelPwrLed === 'reversed_polarity'
                          ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                          : 'bg-slate-800 border-slate-600 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">
                        Pines 2(+) y 4(-): PWR_LED
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {wiring.frontPanelPwrLed === 'correct_polarity'
                          ? '● Polaridad +/- OK'
                          : wiring.frontPanelPwrLed === 'reversed_polarity'
                          ? '▲ Invertido (-/+)'
                          : '○ Desconectado'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onChangeWiring((w) => ({
                          ...w,
                          frontPanelPwrSw: !w.frontPanelPwrSw,
                        }))
                      }
                      className={`col-span-2 p-2 rounded border text-left transition-colors cursor-pointer ${
                        wiring.frontPanelPwrSw
                          ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                          : 'bg-rose-950/90 border-rose-500 text-rose-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold">
                        Pines 6 y 8: POWER_SW
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {wiring.frontPanelPwrSw
                          ? '● Conectado (Sin pol.)'
                          : '✕ Desconectado'}
                      </div>
                    </button>

                    <div className="col-span-1 p-2 rounded border border-dashed border-slate-700 bg-slate-950/60 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-slate-500">Pin 10</span>
                      <span className="text-[9px] text-slate-500">SIN PIN</span>
                    </div>
                  </div>

                  {/* Bottom Row: Pins 1 & 3 (HDD_LED), Pins 5 & 7 (RESET_SW), Pin 9 (NC) */}
                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeWiring((w) => ({
                          ...w,
                          frontPanelHddLed:
                            w.frontPanelHddLed === 'correct_polarity'
                              ? 'reversed_polarity'
                              : w.frontPanelHddLed === 'reversed_polarity'
                              ? 'disconnected'
                              : 'correct_polarity',
                        }))
                      }
                      className={`col-span-2 p-2 rounded border text-left transition-colors cursor-pointer ${
                        wiring.frontPanelHddLed === 'correct_polarity'
                          ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                          : wiring.frontPanelHddLed === 'reversed_polarity'
                          ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                          : 'bg-slate-800 border-slate-600 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">
                        Pines 1(+) y 3(-): HDD_LED
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {wiring.frontPanelHddLed === 'correct_polarity'
                          ? '● Polaridad +/- OK'
                          : wiring.frontPanelHddLed === 'reversed_polarity'
                          ? '▲ Invertido (-/+)'
                          : '○ Desconectado'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onChangeWiring((w) => ({
                          ...w,
                          frontPanelResetSw: !w.frontPanelResetSw,
                        }))
                      }
                      className={`col-span-2 p-2 rounded border text-left transition-colors cursor-pointer ${
                        wiring.frontPanelResetSw
                          ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                          : 'bg-slate-800 border-slate-600 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">
                        Pines 5 y 7: RESET_SW
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {wiring.frontPanelResetSw
                          ? '● Conectado (Sin pol.)'
                          : '○ Desconectado'}
                      </div>
                    </button>

                    <div className="col-span-1 p-2 rounded border border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] text-slate-400">Pin 9</span>
                      <span className="text-[9px] text-slate-500">Reservado</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400">
                    FILA INFERIOR (Pines Impares: 1, 3, 5, 7, 9)
                  </div>
                </div>
              </div>

              {/* Real-time Wiring Diagnostic Box */}
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  wiringDiag.errors.length > 0
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : wiringDiag.warnings.length > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  {wiringDiag.errors.length > 0 ? (
                    <>
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      Fallo de Cableado Detectado ({wiringDiag.errors.length})
                    </>
                  ) : wiringDiag.warnings.length > 0 ? (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Equipo enciende con advertencias de cableado ({wiringDiag.warnings.length})
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Cableado de Fuente y Panel Frontal 100% Correcto
                    </>
                  )}
                </div>
                {wiringDiag.errors.map((err, i) => (
                  <p key={i} className="text-[11px] leading-relaxed">
                    • {err}
                  </p>
                ))}
                {wiringDiag.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] leading-relaxed">
                    • {w}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Sub-tab 2: Interactive UEFI / BIOS Setup Utility */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-3">
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-700">
                <div>
                  <span className="text-xs text-sky-400 font-bold">
                    UEFI BIOS UTILITY — ADVANCED MODE
                  </span>
                  <div className="text-xs text-slate-400">
                    Placa: {build.motherboard?.name ?? 'Sin placa'} · CPU:{' '}
                    {build.cpu?.name ?? 'Sin CPU'}
                  </div>
                </div>
                <div className="text-xs text-emerald-400">
                  F10: Save &amp; Reset
                </div>
              </div>

              {/* 1. XMP / EXPO Profile */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    1. Perfil de Memoria Extreme (Intel XMP 3.0 / AMD EXPO)
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Si se deja desactivado, la RAM funciona a velocidad base JEDEC ({jedecDefaultSpeed} MT/s) en lugar de su frecuencia nominal ({build.ram?.speedMhz ?? 0} MT/s).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeBios((b) => ({
                      ...b,
                      memoryProfileXmpExpo: !b.memoryProfileXmpExpo,
                    }))
                  }
                  className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer shrink-0 ${
                    bios.memoryProfileXmpExpo
                      ? 'bg-sky-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {bios.memoryProfileXmpExpo
                    ? `ENABLED (${effectiveRamSpeed} MT/s)`
                    : `DISABLED (JEDEC ${effectiveRamSpeed} MT/s)`}
                </button>
              </div>

              {/* 2. Hardware Virtualization (SVM / VT-x) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    2. Virtualización por Hardware (Intel VT-x / VT-d · AMD SVM / IOMMU)
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Imprescindible para ejecutar máquinas virtuales de 64 bits en Proxmox, VMware ESXi, VirtualBox, Hyper-V y contenedores Docker/WSL2.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeBios((b) => ({
                      ...b,
                      virtualizationEnabled: !b.virtualizationEnabled,
                    }))
                  }
                  className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer shrink-0 ${
                    bios.virtualizationEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {bios.virtualizationEnabled ? 'ENABLED (VT-x / SVM)' : 'DISABLED'}
                </button>
              </div>

              {/* 3. Resizable BAR / Above 4G Decoding */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    3. Above 4G Decoding &amp; Resizable BAR (Re-Size BAR Support)
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Permite al procesador direccionar toda la VRAM de la tarjeta gráfica de una vez en lugar de bloques de 256 MB (+5–12% FPS en Gaming).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeBios((b) => ({
                      ...b,
                      resizableBar: !b.resizableBar,
                    }))
                  }
                  className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer shrink-0 ${
                    bios.resizableBar
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {bios.resizableBar ? 'ENABLED (Auto)' : 'DISABLED'}
                </button>
              </div>

              {/* 4. Boot Mode UEFI + fTPM 2.0 vs Legacy CSM */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    4. Modo de Arranque (UEFI Nativo + PTT/fTPM 2.0 vs. Legacy CSM)
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                    UEFI con tabla de particiones GPT y TPM 2.0 es obligatorio para Windows 11, Secure Boot y arranque desde discos NVMe modernos.
                  </div>
                </div>
                <select
                  value={bios.bootMode}
                  onChange={(e) =>
                    onChangeBios((b) => ({
                      ...b,
                      bootMode: e.target.value as BiosSettingsState['bootMode'],
                    }))
                  }
                  className="px-3 py-1.5 rounded text-xs font-bold bg-slate-800 text-white border border-slate-600"
                >
                  <option value="UEFI_GPT">UEFI Nativo + Secure Boot + TPM 2.0</option>
                  <option value="CSM_LEGACY">CSM Legacy (MBR Clásico — Desaconsejado)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right 4 cols: Live UEFI Telemetry & Diagnostic Feedback */}
          <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Impacto de tu Configuración BIOS/UEFI
              </h3>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Frecuencia RAM activa:</span>
                  <span
                    className={
                      bios.memoryProfileXmpExpo
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-amber-600 dark:text-amber-400 font-bold'
                    }
                  >
                    {effectiveRamSpeed} MT/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hipervisor / KVM Ready:</span>
                  <span
                    className={
                      bios.virtualizationEnabled
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-rose-600 dark:text-rose-400 font-bold'
                    }
                  >
                    {bios.virtualizationEnabled ? 'SÍ (Activo)' : 'NO (Bloqueado)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tabla de particiones:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold">
                    {bios.bootMode === 'UEFI_GPT' ? 'GPT (UEFI)' : 'MBR (Legacy)'}
                  </span>
                </div>
              </div>

              {!bios.memoryProfileXmpExpo && build.ram && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  <strong>Aviso XMP/EXPO:</strong> Has comprado memoria de {build.ram.speedMhz} MT/s pero al no activar XMP/EXPO en la BIOS está trabajando a {effectiveRamSpeed} MT/s.
                </div>
              )}

              {useCaseId === 'virtualizacion' && !bios.virtualizationEnabled && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
                  <strong>Error para Virtualización:</strong> El caso de uso es un servidor de virtualización, pero has deshabilitado VT-x / AMD-V en la BIOS. Proxmox/ESXi no podrá iniciar máquinas virtuales con aceleración KVM.
                </div>
              )}

              {bios.bootMode === 'CSM_LEGACY' && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  <strong>Aviso CSM Legacy:</strong> El modo CSM impide activar Resizable BAR, Secure Boot y no cumple los requisitos de instalación de Windows 11.
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <strong>Nota didáctica SMR:</strong> En el taller real, tras ensamblar el hardware y verificar temperaturas en la BIOS durante 5 minutos, el primer paso antes de instalar el SO es activar XMP/EXPO y verificar el modo UEFI.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
