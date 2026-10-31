import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  HardDrive,
  Layers,
  MemoryStick,
  Monitor,
  Search,
  ShieldAlert,
  Trash2,
  Wind,
  Zap,
} from 'lucide-react';
import {
  CASE_CATALOG,
  COOLER_CATALOG,
  CPU_CATALOG,
  GPU_CATALOG,
  MOTHERBOARD_CATALOG,
  PSU_CATALOG,
  RAM_CATALOG,
  STORAGE_CATALOG,
} from '../data/hardwareCatalog';
import { ComponentSlotKey, PCBuildState } from '../types/hardware';
import { runCompatibilityChecks } from '../utils/compatibilityEngine';

interface ComponentCatalogSelectorProps {
  build: PCBuildState;
  activeSlot: ComponentSlotKey;
  onSelectSlot: (slot: ComponentSlotKey) => void;
  onUpdateComponent: <K extends ComponentSlotKey>(
    slot: K,
    component: PCBuildState[K]
  ) => void;
}

export const SLOT_DEFINITIONS: {
  key: ComponentSlotKey;
  label: string;
  shortLabel: string;
  optional?: boolean;
}[] = [
  { key: 'cpu', label: '1. Procesador (CPU)', shortLabel: 'CPU' },
  { key: 'motherboard', label: '2. Placa Base', shortLabel: 'Placa Base' },
  { key: 'ram', label: '3. Memoria RAM', shortLabel: 'RAM' },
  { key: 'cooler', label: '4. Disipador CPU', shortLabel: 'Disipador' },
  { key: 'gpu', label: '5. Tarjeta Gráfica', shortLabel: 'GPU / Vídeo' },
  { key: 'storagePrimary', label: '6. Disco Principal (SO)', shortLabel: 'Disco 1 (SO)' },
  {
    key: 'storageSecondary',
    label: '7. Disco Secundario',
    shortLabel: 'Disco 2 (Opc.)',
    optional: true,
  },
  { key: 'pcCase', label: '8. Caja / Chasis', shortLabel: 'Chasis' },
  { key: 'psu', label: '9. Fuente (PSU)', shortLabel: 'Fuente PSU' },
];

export const ComponentCatalogSelector: React.FC<ComponentCatalogSelectorProps> = ({
  build,
  activeSlot,
  onSelectSlot,
  onUpdateComponent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'name'>('price-asc');
  const [onlyCompatible, setOnlyCompatible] = useState(false);
  const [examBlindMode, setExamBlindMode] = useState(false);

  // Evaluate what happens if a candidate item is placed into `activeSlot`
  const checkCandidateCompatibility = (candidate: any): {
    status: 'ok' | 'warning' | 'error';
    reason: string;
  } => {
    const simulatedBuild: PCBuildState = {
      ...build,
      [activeSlot]: candidate,
    };
    const checks = runCompatibilityChecks(simulatedBuild);

    // Map relevant check IDs per slot
    const relevantIdsBySlot: Record<ComponentSlotKey, string[]> = {
      cpu: ['check-socket', 'check-vrm', 'check-ram', 'check-video', 'check-tdp', 'check-psu'],
      motherboard: ['check-socket', 'check-vrm', 'check-ram', 'check-form-factor', 'check-storage'],
      ram: ['check-ram'],
      cooler: ['check-cooler-clearance', 'check-tdp'],
      gpu: ['check-video', 'check-gpu-clearance', 'check-psu'],
      storagePrimary: ['check-storage'],
      storageSecondary: ['check-storage'],
      pcCase: ['check-cooler-clearance', 'check-gpu-clearance', 'check-form-factor', 'check-storage'],
      psu: ['check-psu'],
    };

    const relevantIds = relevantIdsBySlot[activeSlot];
    const relevantChecks = checks.filter((c) => relevantIds.includes(c.id));

    const firstError = relevantChecks.find((c) => c.severity === 'error');
    if (firstError) {
      return { status: 'error', reason: firstError.summary };
    }
    const firstWarning = relevantChecks.find((c) => c.severity === 'warning');
    if (firstWarning) {
      return { status: 'warning', reason: firstWarning.summary };
    }
    return { status: 'ok', reason: 'Compatible con los componentes actuales' };
  };

  const rawItems = useMemo(() => {
    switch (activeSlot) {
      case 'cpu':
        return CPU_CATALOG;
      case 'motherboard':
        return MOTHERBOARD_CATALOG;
      case 'ram':
        return RAM_CATALOG;
      case 'cooler':
        return COOLER_CATALOG;
      case 'gpu':
        return GPU_CATALOG;
      case 'storagePrimary':
      case 'storageSecondary':
        return STORAGE_CATALOG;
      case 'pcCase':
        return CASE_CATALOG;
      case 'psu':
        return PSU_CATALOG;
    }
  }, [activeSlot]);

  const filteredItems = useMemo(() => {
    return rawItems
      .map((item) => ({
        item,
        compat: checkCandidateCompatibility(item),
      }))
      .filter(({ item, compat }) => {
        if (onlyCompatible && compat.status === 'error') return false;
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q) ||
          JSON.stringify(item).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.item.price - b.item.price;
        if (sortBy === 'price-desc') return b.item.price - a.item.price;
        return a.item.name.localeCompare(b.item.name);
      });
  }, [rawItems, build, activeSlot, onlyCompatible, searchTerm, sortBy]);

  const currentSelected = build[activeSlot];

  const renderTechnicalSpecsLine = (item: any) => {
    switch (activeSlot) {
      case 'cpu':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              Socket {item.socket}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {item.cores} núcleos / {item.threads} hilos
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {item.baseClockGhz}–{item.boostClockGhz} GHz
            </span>
            <span aria-hidden="true">·</span>
            <span>
              TDP {item.tdpWatts}W (Turbo {item.maxTurboWatts}W)
            </span>
            <span aria-hidden="true">·</span>
            <span>RAM: {item.supportedRam.join('/')}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                item.hasIntegratedGraphics
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }
            >
              {item.hasIntegratedGraphics ? `iGPU: ${item.igpuName}` : 'Sin gráficos integrados'}
            </span>
          </div>
        );
      case 'motherboard':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              Socket {item.socket} ({item.chipset})
            </span>
            <span aria-hidden="true">·</span>
            <span>Formato: {item.formFactor}</span>
            <span aria-hidden="true">·</span>
            <span>
              {item.ramSlots}x DIMM {item.ramType} (máx {item.maxRamGb} GB)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              PCIe x16 {item.maxPcieVersion}.0 · {item.m2Slots}x M.2 PCIe {item.m2PcieVersion}.0 + {item.sataPorts}x SATA
            </span>
            <span aria-hidden="true">·</span>
            <span>VRM máx: {item.maxRecommendedCpuWatts}W</span>
          </div>
        );
      case 'ram':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {item.ramType}-{item.speedMhz} CL{item.casLatency}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {item.totalCapacityGb} GB totales ({item.modules}x {item.capacityPerModuleGb} GB)
            </span>
            <span aria-hidden="true">·</span>
            <span>{item.modules >= 2 ? 'Dual Channel Ready' : 'Single Channel (1 módulo)'}</span>
            {item.isEcc && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-sky-600 dark:text-sky-400">ECC Unbuffered</span>
              </>
            )}
          </div>
        );
      case 'cooler':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {item.type}
            </span>
            <span aria-hidden="true">·</span>
            <span>Capacidad TDP: hasta {item.maxTdpWatts} W</span>
            <span aria-hidden="true">·</span>
            <span>Altura física: {item.heightMm} mm</span>
            <span aria-hidden="true">·</span>
            <span>Ruido: {item.noiseDb} dBA</span>
          </div>
        );
      case 'gpu':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {item.vramGb > 0 ? `${item.vramGb} GB VRAM` : 'iGPU del Procesador'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Consumo TBP: {item.tdpWatts} W</span>
            <span aria-hidden="true">·</span>
            <span>Longitud física: {item.lengthMm} mm</span>
            <span aria-hidden="true">·</span>
            <span>PSU rec: ≥ {item.recommendedPsuWatts} W</span>
          </div>
        );
      case 'storagePrimary':
      case 'storageSecondary':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {item.capacityGb >= 1000 ? `${item.capacityGb / 1000} TB` : `${item.capacityGb} GB`} ·{' '}
              {item.interface}
            </span>
            <span aria-hidden="true">·</span>
            <span>Formato: {item.type}</span>
            <span aria-hidden="true">·</span>
            <span>
              Lectura: {item.readSpeedMbs} MB/s / Escritura: {item.writeSpeedMbs} MB/s
            </span>
          </div>
        );
      case 'pcCase':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              Placas: {item.supportedFormFactors.join(', ')}
            </span>
            <span aria-hidden="true">·</span>
            <span>Altura máx Disipador: {item.maxCoolerHeightMm} mm</span>
            <span aria-hidden="true">·</span>
            <span>Largo máx GPU: {item.maxGpuLengthMm} mm</span>
            <span aria-hidden="true">·</span>
            <span>Radiador 240mm: {item.supportsAio240 ? 'Sí' : 'No'}</span>
          </div>
        );
      case 'psu':
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {item.wattage}W Nominales ({item.effective12vWatts}W reales en +12V)
            </span>
            <span aria-hidden="true">·</span>
            <span>{item.efficiency}</span>
            <span aria-hidden="true">·</span>
            <span>{item.modular ? 'Modular' : 'Cableado Fijo'}</span>
            <span aria-hidden="true">·</span>
            <span>
              Conectores PCIe GPU: {item.hasPciePowerConnectors ? 'Sí (8-pin / PCIe 5.0)' : 'No tiene'}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
      {/* Category Stepper Tabs */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Catálogo Técnico de Componentes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecciona paso a paso las 9 piezas de la torre comprobando especificaciones físicas y lógicas
            </p>
          </div>

          {/* Exam Blind Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExamBlindMode(!examBlindMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                examBlindMode
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Oculta las etiquetas de ayuda en el catálogo para que el alumno deduzca la compatibilidad leyendo las especificaciones técnicas"
            >
              {examBlindMode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Modo Examen: Pistas Ocultas
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Modo Guiado: Pistas Visibles
                </>
              )}
            </button>
          </div>
        </div>

        {/* 9 Slot Selector Strip */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          {SLOT_DEFINITIONS.map((slotDef) => {
            const isSelected = activeSlot === slotDef.key;
            const hasPart = build[slotDef.key] !== null;
            return (
              <button
                key={slotDef.key}
                type="button"
                onClick={() => onSelectSlot(slotDef.key)}
                className={`px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[11px] font-semibold truncate">
                    {slotDef.shortLabel}
                  </span>
                  {hasPart && (
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {build[slotDef.key]
                    ? `${build[slotDef.key]!.price} €`
                    : slotDef.optional
                    ? 'Opcional'
                    : 'Vacío'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Buscar en ${
              SLOT_DEFINITIONS.find((s) => s.key === activeSlot)?.label
            } (ej. AM5, DDR5, 65W, ATX, NVMe...)`}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!examBlindMode && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                checked={onlyCompatible}
                onChange={(e) => setOnlyCompatible(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Solo compatibles
            </label>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Ordenar componentes"
            className="px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="price-asc">Precio: Menor a Mayor</option>
            <option value="price-desc">Precio: Mayor a Menor</option>
            <option value="name">Orden Alfabético</option>
          </select>

          {currentSelected && (
            <button
              type="button"
              onClick={() => onUpdateComponent(activeSlot, null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Desmontar pieza
            </button>
          )}
        </div>
      </div>

      {/* Component Cards List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
            No se encontraron componentes con ese filtro. Desmarca &ldquo;Solo compatibles&rdquo; o borra la búsqueda.
          </div>
        ) : (
          filteredItems.map(({ item, compat }) => {
            const isInstalled = currentSelected?.id === item.id;
            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isInstalled
                    ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/25'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.name}
                    </h3>
                    {!examBlindMode && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          compat.status === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : compat.status === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        <span aria-hidden="true">·</span>
                        {compat.status === 'error' && (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            Incompatible: {compat.reason}
                          </>
                        )}
                        {compat.status === 'warning' && (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Aviso: {compat.reason}
                          </>
                        )}
                        {compat.status === 'ok' && (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Compatible
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Specs Line */}
                  {renderTechnicalSpecsLine(item)}

                  {/* Didactic Note */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.notes}
                  </p>
                </div>

                {/* Price & Install Button */}
                <div className="flex sm:flex-row lg:flex-col items-center lg:items-end justify-between gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200 dark:border-slate-800">
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                      {item.price} €
                    </span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                      IVA incl.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateComponent(activeSlot, isInstalled ? null : item)
                    }
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isInstalled
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
                    }`}
                  >
                    {isInstalled ? 'Instalado en Torre' : 'Instalar Pieza'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
