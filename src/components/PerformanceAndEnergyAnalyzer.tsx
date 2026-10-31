import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Cpu,
  Flame,
  Gauge,
  Monitor,
  Server,
  Zap,
} from 'lucide-react';
import { PCBuildState } from '../types/hardware';
import { PowerBreakdown } from '../utils/compatibilityEngine';

interface PerformanceAndEnergyAnalyzerProps {
  build: PCBuildState;
  power: PowerBreakdown;
}

export const PerformanceAndEnergyAnalyzer: React.FC<
  PerformanceAndEnergyAnalyzerProps
> = ({ build, power }) => {
  const [resolution, setResolution] = useState<'1080p' | '1440p' | '4k'>('1440p');
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [daysPerYear, setDaysPerYear] = useState<number>(250);
  const [kwhPriceEur, setKwhPriceEur] = useState<number>(0.18);

  // 1. Bottleneck & Balance Analysis
  const cpuGaming = build.cpu?.gamingScore ?? 0;
  const gpuGaming = build.gpu?.gamingScore ?? 0;

  // At 1080p CPU matters more; at 4K GPU matters much more
  const resolutionMultiplier =
    resolution === '1080p' ? 1.15 : resolution === '1440p' ? 1.0 : 0.78;
  const adjustedGpuDemand = Math.round(gpuGaming * resolutionMultiplier);

  const bottleneckDiff = adjustedGpuDemand - cpuGaming; // positive means CPU holds back GPU
  const bottleneckPercentage =
    cpuGaming > 0 && gpuGaming > 0
      ? Math.min(65, Math.abs(Math.round((bottleneckDiff / Math.max(cpuGaming, adjustedGpuDemand)) * 100)))
      : 0;

  const limitingComponent =
    !build.cpu || !build.gpu
      ? 'Pendiente de seleccionar CPU y GPU'
      : build.gpu.id === 'gpu-igpu'
      ? 'Limitado por Gráficos Integrados (iGPU)'
      : Math.abs(bottleneckDiff) <= 14
      ? 'Equilibrio Óptimo CPU / GPU (<12% desviación)'
      : bottleneckDiff > 14
      ? `Cuello de botella en CPU (${bottleneckPercentage}% en ${resolution})`
      : `Limitado por potencia de GPU (${bottleneckPercentage}% en ${resolution})`;

  // 2. Estimated FPS in Games (1080p / 1440p / 4K)
  const effectiveGamingIndex =
    cpuGaming > 0 && gpuGaming > 0
      ? Math.min(cpuGaming * 1.15, gpuGaming) *
        (resolution === '1080p' ? 1.25 : resolution === '1440p' ? 0.95 : 0.55) *
        (build.ram?.modules === 1 ? 0.85 : 1.0)
      : 0;

  const esportsFps = Math.round(effectiveGamingIndex * 3.1);
  const aaaHighFps = Math.round(effectiveGamingIndex * 1.15);
  const rayTracingFps =
    build.gpu && build.gpu.vramGb >= 8
      ? Math.round(effectiveGamingIndex * (build.gpu.chipsetBrand === 'NVIDIA' ? 0.82 : 0.68))
      : 0;

  // 3. Virtualization Capacity (Proxmox / VMware ESXi)
  const totalThreads = build.cpu?.threads ?? 0;
  const totalRamGb = build.ram?.totalCapacityGb ?? 0;
  const usableRamForVms = Math.max(0, totalRamGb - 4); // Reserve 4GB for Hypervisor host
  const maxVmsByRam = Math.floor(usableRamForVms / 4); // Assuming 4GB per standard VM
  const maxVmsByCpu = Math.floor((totalThreads * 1.5) / 2); // 2 vCPU per VM with 1.5x overcommit
  const recommendedConcurrentVms = Math.min(maxVmsByRam, maxVmsByCpu);

  // 4. 80 Plus PSU Efficiency & Annual Electricity Cost (TCO)
  const psuEfficiencyMap: Record<string, number> = {
    'Sin Certificación': 0.75,
    '80 Plus Bronze': 0.85,
    '80 Plus Gold': 0.9,
    '80 Plus Platinum': 0.92,
  };
  const currentEfficiency = build.psu
    ? psuEfficiencyMap[build.psu.efficiency] ?? 0.8
    : 0.85;

  const wallPowerTypicalWatts =
    power.totalTypicalWatts > 0
      ? Math.round(power.totalTypicalWatts / currentEfficiency)
      : 0;
  const wastedHeatWatts = Math.max(0, wallPowerTypicalWatts - power.totalTypicalWatts);

  const annualKwh = Number(
    ((wallPowerTypicalWatts * hoursPerDay * daysPerYear) / 1000).toFixed(1)
  );
  const annualCostEur = Number((annualKwh * kwhPriceEur).toFixed(2));

  // Compare with generic 75% PSU vs 90% Gold PSU
  const genericWallWatts = Math.round(power.totalTypicalWatts / 0.75);
  const goldWallWatts = Math.round(power.totalTypicalWatts / 0.9);
  const annualSavingsGoldVsGenericEur = Number(
    (
      (((genericWallWatts - goldWallWatts) * hoursPerDay * daysPerYear) / 1000) *
      kwhPriceEur
    ).toFixed(2)
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Laboratorio de Rendimiento, Cuellos de Botella y Eficiencia Energética
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Simulación de Cargas de Trabajo (FPS / Virtualización) y Coste Eléctrico 80 Plus
          </h2>
        </div>

        {/* Resolution Selector for Bottleneck & FPS */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
          {(['1080p', '1440p', '4k'] as const).map((res) => (
            <button
              key={res}
              type="button"
              onClick={() => setResolution(res)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                resolution === res
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {res.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 cols: Bottleneck + FPS + Virtualization */}
        <div className="lg:col-span-6 space-y-4">
          {/* Bottleneck Meter Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Balance de Arquitectura CPU vs. GPU ({resolution.toUpperCase()})
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                {limitingComponent}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 text-[11px]">Índice IPC / Gaming CPU</div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {cpuGaming} / 100
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {build.cpu?.name ?? 'Sin CPU'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 text-[11px]">Índice Rasterizado GPU</div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {gpuGaming} / 100
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {build.gpu?.name ?? 'Sin GPU'}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Explicación técnica:</strong> En resolución <strong>1080p</strong>, la gráfica dibuja fotogramas muy rápido y el procesador suele ser el factor limitante (IPC y memoria Dual Channel). En <strong>1440p y 4K</strong>, la carga recae mayoritariamente sobre los shaders y la VRAM de la GPU.
            </p>
          </div>

          {/* Gaming FPS + Virtualization Capacity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Gaming FPS Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-sky-500" />
                  Tasa FPS Estimada ({resolution})
                </span>
                {build.ram?.modules === 1 && (
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                    -15% (Single Ch.)
                  </span>
                )}
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">eSports (CS2 / Valorant):</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ~{esportsFps} FPS
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Triple-A Ultra:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ~{aaaHighFps} FPS
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Ray Tracing / Render:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {rayTracingFps > 0 ? `~${rayTracingFps} FPS` : 'No apto (<8GB VRAM)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Virtualization / Proxmox Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-500" />
                  Capacidad Virtualización
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Proxmox / ESXi
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Hilos lógicos (vCPU):</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {totalThreads} hilos
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">RAM útil para VMs:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {usableRamForVms} GB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">VMs simultáneas (4GB):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Hasta {recommendedConcurrentVms} VMs
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 cols: Interactive 80 Plus PSU Efficiency & Annual TCO Calculator */}
        <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                Calculadora de Eficiencia 80 Plus y Coste Eléctrico Anual
              </h3>
              <span className="text-xs font-mono text-slate-500">
                Eficiencia PSU: {Math.round(currentEfficiency * 100)}%
              </span>
            </div>

            {/* 3 Labeled Sliders with Explicit Numeric Values and Units */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <label htmlFor="slider-hours">Uso diario:</label>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {hoursPerDay} h/día
                  </span>
                </div>
                <input
                  id="slider-hours"
                  type="range"
                  min={1}
                  max={24}
                  step={1}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Number(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <label htmlFor="slider-days">Días al año:</label>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {daysPerYear} días
                  </span>
                </div>
                <input
                  id="slider-days"
                  type="range"
                  min={50}
                  max={365}
                  step={5}
                  value={daysPerYear}
                  onChange={(e) => setDaysPerYear(Number(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <label htmlFor="slider-kwh">Tarifa luz:</label>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {kwhPriceEur.toFixed(2)} €/kWh
                  </span>
                </div>
                <input
                  id="slider-kwh"
                  type="range"
                  min={0.08}
                  max={0.35}
                  step={0.01}
                  value={kwhPriceEur}
                  onChange={(e) => setKwhPriceEur(Number(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Power Conversion Metrics */}
            <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">Consumo DC Interno</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {power.totalTypicalWatts} W
                </div>
                <div className="text-[10px] text-slate-500">Carga típica</div>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">Absorción AC Enchufe</div>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {wallPowerTypicalWatts} W
                </div>
                <div className="text-[10px] text-slate-500">
                  +{wastedHeatWatts}W disipados en calor
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">Factura Anual Est.</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {annualCostEur} €/año
                </div>
                <div className="text-[10px] text-slate-500">{annualKwh} kWh/año</div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <strong>Por qué importa la certificación 80 Plus:</strong> Con este perfil de uso ({hoursPerDay} h/día × {daysPerYear} días), una fuente <strong>80 Plus Gold (90%)</strong> ahorra <strong>{annualSavingsGoldVsGenericEur} € cada año</strong> en electricidad (y evita evacuar {genericWallWatts - goldWallWatts}W constantes de calor al aula/oficina) frente a una fuente sin certificación (75%).
          </div>
        </div>
      </div>
    </div>
  );
};
