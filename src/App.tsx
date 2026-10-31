import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Link2,
  Moon,
  Redo2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Wrench,
} from 'lucide-react';
import {
  BuildHistoryEntry,
  BuildHistoryPanel,
} from './components/BuildHistoryPanel';
import {
  ComponentCatalogSelector,
  SLOT_DEFINITIONS,
} from './components/ComponentCatalogSelector';
import { InteractiveArchitectureDiagram } from './components/InteractiveArchitectureDiagram';
import { InteractiveQuizAndGenerator } from './components/InteractiveQuizAndGenerator';
import { PerformanceAndEnergyAnalyzer } from './components/PerformanceAndEnergyAnalyzer';
import { RubricAndBudgetReport } from './components/RubricAndBudgetReport';
import {
  BiosSettingsState,
  DEFAULT_BIOS_STATE,
  DEFAULT_WIRING_STATE,
  WiringAndBiosLab,
  WiringState,
} from './components/WiringAndBiosLab';
import { WorkshopReferenceGuide } from './components/WorkshopReferenceGuide';
import {
  BROKEN_CHALLENGES,
  CASE_CATALOG,
  COOLER_CATALOG,
  CPU_CATALOG,
  GPU_CATALOG,
  MOTHERBOARD_CATALOG,
  PSU_CATALOG,
  RAM_CATALOG,
  RECOMMENDED_PRESETS,
  STORAGE_CATALOG,
  USE_CASES,
} from './data/hardwareCatalog';
import {
  ComponentSlotKey,
  PCBuildState,
  UseCaseId,
} from './types/hardware';
import {
  calculatePowerBreakdown,
  calculateTotalPrice,
  evaluateBuild,
  runCompatibilityChecks,
} from './utils/compatibilityEngine';

const EMPTY_BUILD: PCBuildState = {
  cpu: null,
  motherboard: null,
  ram: null,
  cooler: null,
  gpu: null,
  storagePrimary: null,
  storageSecondary: null,
  pcCase: null,
  psu: null,
};

function resolveBuildFromIds(ids: {
  cpu?: string | null;
  motherboard?: string | null;
  ram?: string | null;
  cooler?: string | null;
  gpu?: string | null;
  storagePrimary?: string | null;
  storageSecondary?: string | null;
  pcCase?: string | null;
  psu?: string | null;
}): PCBuildState {
  return {
    cpu: CPU_CATALOG.find((x) => x.id === ids.cpu) ?? null,
    motherboard: MOTHERBOARD_CATALOG.find((x) => x.id === ids.motherboard) ?? null,
    ram: RAM_CATALOG.find((x) => x.id === ids.ram) ?? null,
    cooler: COOLER_CATALOG.find((x) => x.id === ids.cooler) ?? null,
    gpu: GPU_CATALOG.find((x) => x.id === ids.gpu) ?? null,
    storagePrimary: STORAGE_CATALOG.find((x) => x.id === ids.storagePrimary) ?? null,
    storageSecondary: STORAGE_CATALOG.find((x) => x.id === ids.storageSecondary) ?? null,
    pcCase: CASE_CATALOG.find((x) => x.id === ids.pcCase) ?? null,
    psu: PSU_CATALOG.find((x) => x.id === ids.psu) ?? null,
  };
}

function createHistorySnapshot(
  buildState: PCBuildState,
  actionLabel: string,
  slotChanged?: string
): BuildHistoryEntry {
  const checks = runCompatibilityChecks(buildState);
  const errorCount = checks.filter((c) => c.severity === 'error').length;
  const totalPrice = calculateTotalPrice(buildState);
  const now = new Date();
  const timestamp = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    actionLabel,
    slotChanged,
    build: { ...buildState },
    totalPrice,
    errorCount,
  };
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<UseCaseId>('gaming');
  const [budgetLimit, setBudgetLimit] = useState<number>(1450);
  const [activeSlot, setActiveSlot] = useState<ComponentSlotKey>('cpu');
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>('check-socket');
  const [shareCopied, setShareCopied] = useState(false);

  const [wiring, setWiring] = useState<WiringState>(DEFAULT_WIRING_STATE);
  const [bios, setBios] = useState<BiosSettingsState>(DEFAULT_BIOS_STATE);

  const initialBuild = useMemo<PCBuildState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('cpu') || params.has('mb')) {
        return resolveBuildFromIds({
          cpu: params.get('cpu'),
          motherboard: params.get('mb'),
          ram: params.get('ram'),
          cooler: params.get('cooler'),
          gpu: params.get('gpu'),
          storagePrimary: params.get('sto1'),
          storageSecondary: params.get('sto2'),
          pcCase: params.get('case'),
          psu: params.get('psu'),
        });
      }
    }
    return resolveBuildFromIds(RECOMMENDED_PRESETS.gaming);
  }, []);

  const [build, setBuild] = useState<PCBuildState>(initialBuild);

  // Undo/Redo History State
  const [history, setHistory] = useState<BuildHistoryEntry[]>(() => [
    createHistorySnapshot(initialBuild, 'Montaje inicial cargado'),
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const commitBuildChange = useCallback(
    (
      nextBuild: PCBuildState,
      actionLabel: string,
      slotChanged?: ComponentSlotKey
    ) => {
      setBuild(nextBuild);
      const newEntry = createHistorySnapshot(
        nextBuild,
        actionLabel,
        slotChanged
      );
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const updated = [...sliced, newEntry].slice(-30); // keep last 30 steps
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    },
    [historyIndex]
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setBuild(history[prevIndex].build);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setBuild(history[nextIndex].build);
    }
  }, [history, historyIndex]);

  const handleJumpToHistoryIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < history.length) {
        setHistoryIndex(index);
        setBuild(history[index].build);
      }
    },
    [history]
  );

  const handleRestoreLastErrorFree = useCallback(() => {
    for (let i = historyIndex - 1; i >= 0; i--) {
      if (history[i].errorCount === 0) {
        setHistoryIndex(i);
        setBuild(history[i].build);
        return;
      }
    }
  }, [history, historyIndex]);

  // Global Keyboard Shortcuts: Ctrl+Z (Undo) & Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Load useCase and budget from URL if present on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uc = params.get('uc') as UseCaseId | null;
    const b = Number(params.get('b'));
    if (uc && USE_CASES.some((u) => u.id === uc)) {
      setSelectedUseCaseId(uc);
    }
    if (Number.isFinite(b) && b >= 400 && b <= 3000) {
      setBudgetLimit(b);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const currentScenario = useMemo(
    () => USE_CASES.find((u) => u.id === selectedUseCaseId) ?? USE_CASES[0],
    [selectedUseCaseId]
  );

  const handleSelectUseCase = (useCaseId: UseCaseId) => {
    const found = USE_CASES.find((u) => u.id === useCaseId);
    setSelectedUseCaseId(useCaseId);
    setActiveChallengeId(null);
    if (found) {
      setBudgetLimit(found.defaultBudget);
    }
  };

  const handleLoadBrokenChallenge = (challengeId: string) => {
    const challenge = BROKEN_CHALLENGES.find((c) => c.id === challengeId);
    if (!challenge) return;
    setActiveChallengeId(challenge.id);
    setSelectedUseCaseId(challenge.targetUseCase);
    setBudgetLimit(challenge.targetBudget);
    const nextBuild = resolveBuildFromIds(challenge.buildIds);
    commitBuildChange(nextBuild, `Cargado reto: ${challenge.title}`);
  };

  const handleLoadRecommendedPreset = () => {
    const presetKey = selectedUseCaseId === 'libre' ? 'gaming' : selectedUseCaseId;
    const preset = RECOMMENDED_PRESETS[presetKey];
    if (preset) {
      setActiveChallengeId(null);
      setWiring(DEFAULT_WIRING_STATE);
      setBios(DEFAULT_BIOS_STATE);
      const nextBuild = resolveBuildFromIds(preset);
      commitBuildChange(
        nextBuild,
        `Montaje base cargado (${currentScenario.shortTitle})`
      );
    }
  };

  const handleClearBuild = () => {
    setActiveChallengeId(null);
    commitBuildChange(EMPTY_BUILD, 'Mesa de taller vaciada');
    setActiveSlot('cpu');
  };

  const handleUpdateComponent = <K extends ComponentSlotKey>(
    slot: K,
    component: PCBuildState[K]
  ) => {
    const slotLabel =
      SLOT_DEFINITIONS.find((s) => s.key === slot)?.shortLabel ?? slot;
    const prevPart = build[slot];

    // Avoid duplicate history entries if clicking the exact same state
    if (prevPart?.id === component?.id) return;

    const nextBuild: PCBuildState = {
      ...build,
      [slot]: component,
    };

    let actionLabel = '';
    if (!component) {
      actionLabel = `Desmontado ${slotLabel}: ${prevPart?.name ?? ''}`;
    } else if (!prevPart) {
      actionLabel = `Instalado ${slotLabel}: ${component.name}`;
    } else {
      actionLabel = `Cambiado ${slotLabel}: ${component.name}`;
    }

    commitBuildChange(nextBuild, actionLabel, slot);
  };

  const handleImportBuildIds = (
    ids: Record<string, string | null>,
    importedUseCaseId?: string,
    importedBudget?: number
  ) => {
    if (
      importedUseCaseId &&
      USE_CASES.some((u) => u.id === importedUseCaseId)
    ) {
      setSelectedUseCaseId(importedUseCaseId as UseCaseId);
    }
    if (typeof importedBudget === 'number' && importedBudget >= 400 && importedBudget <= 3000) {
      setBudgetLimit(importedBudget);
    }
    setActiveChallengeId(null);
    const nextBuild = resolveBuildFromIds(ids);
    commitBuildChange(nextBuild, 'Montaje importado desde archivo JSON');
  };

  const handleShareBuildUrl = async () => {
    const params = new URLSearchParams();
    params.set('uc', selectedUseCaseId);
    params.set('b', String(budgetLimit));
    if (build.cpu) params.set('cpu', build.cpu.id);
    if (build.motherboard) params.set('mb', build.motherboard.id);
    if (build.ram) params.set('ram', build.ram.id);
    if (build.cooler) params.set('cooler', build.cooler.id);
    if (build.gpu) params.set('gpu', build.gpu.id);
    if (build.storagePrimary) params.set('sto1', build.storagePrimary.id);
    if (build.storageSecondary) params.set('sto2', build.storageSecondary.id);
    if (build.pcCase) params.set('case', build.pcCase.id);
    if (build.psu) params.set('psu', build.psu.id);

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', `?${params.toString()}`);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const totalPrice = useMemo(() => calculateTotalPrice(build), [build]);
  const power = useMemo(() => calculatePowerBreakdown(build), [build]);
  const checks = useMemo(() => runCompatibilityChecks(build), [build]);
  const evaluation = useMemo(
    () => evaluateBuild(build, currentScenario, budgetLimit),
    [build, currentScenario, budgetLimit]
  );

  const errorCount = checks.filter((c) => c.severity === 'error').length;
  const warningCount = checks.filter((c) => c.severity === 'warning').length;
  const okCount = checks.filter((c) => c.severity === 'ok').length;

  const budgetDifference = budgetLimit - totalPrice;
  const budgetPercentage = Math.min(
    100,
    Math.round((totalPrice / Math.max(1, budgetLimit)) * 100)
  );

  const logoSrc = `${import.meta.env.BASE_URL}assets/aistudio/icono_81a3db5b.png`;

  const activeChallenge = useMemo(
    () => BROKEN_CHALLENGES.find((c) => c.id === activeChallengeId) ?? null,
    [activeChallengeId]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
        {/* Zone 1: Brand Title (single line with undistorted logo) */}
        <a
          href="https://www.unfantasmaenelsistema.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          <img
            src={logoSrc}
            alt="Logo Un Fantasma en el Sistema"
            referrerPolicy="no-referrer"
            className="w-9 h-9 object-contain shrink-0"
          />
          <span className="hidden sm:inline">Un Fantasma en el Sistema</span>
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a
            href="#simulador"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Simulador
          </a>
          <a
            href="#catalogo"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Catálogo
          </a>
          <a
            href="#cableado-bios"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Cableado y BIOS
          </a>
          <a
            href="#evaluacion"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Evaluación
          </a>
          <a
            href="#test-smr"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Test SMR
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://www.unfantasmaenelsistema.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>Visitar Web</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content Container (1440px max-width presence) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero & Module Banner + Utility Controls */}
        <section
          id="simulador"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <a
                href="https://www.unfantasmaenelsistema.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shrink-0 hover:border-sky-500 transition-colors"
                title="Ir a Un Fantasma en el Sistema"
              >
                <img
                  src={logoSrc}
                  alt="Un Fantasma en el Sistema"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 object-contain shrink-0"
                />
              </a>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Montaje y Reparación de Sistemas Microinformáticos</span>
                  <span aria-hidden="true">·</span>
                  <a
                    href="https://www.unfantasmaenelsistema.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  >
                    unfantasmaenelsistema.com
                  </a>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Simulador de Presupuestos y Compatibilidad de Hardware
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
                  Configura una torre completa cumpliendo el presupuesto y el caso de uso. Comprueba en tiempo real socket CPU/placa, memoria DDR4/DDR5, cotas en milímetros, potencia de fuente, cableado del panel frontal (F_PANEL) y parámetros UEFI/BIOS.
                </p>
              </div>
            </div>

            {/* Workspace Actions Toolbar (with Undo/Redo + Presets + Share + Theme) */}
            <div className="flex flex-wrap items-center gap-2 xl:shrink-0 no-print">
              {/* Quick Undo / Redo Segmented Group */}
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Deshacer último cambio de componente (Ctrl+Z)"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Deshacer
                </button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Rehacer cambio de componente (Ctrl+Y)"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  Rehacer
                </button>
              </div>

              <button
                type="button"
                onClick={handleShareBuildUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Copia un enlace directo con tu configuración actual para enviarlo al profesor"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Enlace Copiado
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    Compartir Enlace
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleLoadRecommendedPreset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                Cargar Montaje Base
              </button>

              <button
                type="button"
                onClick={handleClearBuild}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Vaciar Mesa
              </button>

              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Cambiar tema visual Claro / Oscuro"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Claro
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                    Oscuro
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Use Case Selector Tabs + Broken Repair Challenges */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Segmented Use Case Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                {USE_CASES.map((uc) => {
                  const active = selectedUseCaseId === uc.id && !activeChallengeId;
                  return (
                    <button
                      key={uc.id}
                      type="button"
                      onClick={() => handleSelectUseCase(uc.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {uc.shortTitle} ({uc.defaultBudget} €)
                    </button>
                  );
                })}
              </div>

              {/* Broken PC Challenges Selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                  <Wrench className="w-3.5 h-3.5 text-amber-500" />
                  Retos Caza-Errores:
                </span>
                {BROKEN_CHALLENGES.map((ch, idx) => {
                  const isActiveChallenge = activeChallengeId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleLoadBrokenChallenge(ch.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isActiveChallenge
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                    >
                      Avería #{idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Scenario or Repair Challenge Brief */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="lg:col-span-8 space-y-2">
                {activeChallenge ? (
                  <>
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      MODO DIAGNÓSTICO DE AVERÍA EN TALLER ACTIVO
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {activeChallenge.title}
                    </h2>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <strong>Síntoma en taller:</strong> {activeChallenge.symptom}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      <strong>Misión del alumno:</strong> {activeChallenge.description}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-medium text-sky-600 dark:text-sky-400">
                      Encargo del Cliente · Caso de Uso Activo
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {currentScenario.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {currentScenario.clientProfile}
                    </p>
                  </>
                )}

                {/* Requirements inline list */}
                <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {currentScenario.requirementsList.map((req, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                      )}
                      <span>{req}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Budget Slider & Target Control */}
              <div className="lg:col-span-4 flex flex-col justify-between p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="budget-slider"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Presupuesto Límite Fijado:
                  </label>
                  <span className="text-base font-bold font-mono text-sky-600 dark:text-sky-400">
                    {budgetLimit} €
                  </span>
                </div>

                <input
                  id="budget-slider"
                  type="range"
                  min={400}
                  max={3000}
                  step={25}
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(Number(e.target.value))}
                  className="w-full my-2 accent-sky-600 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span>Mín: 400 €</span>
                  <span>Predefinido: {currentScenario.defaultBudget} €</span>
                  <span>Máx: 3.000 €</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Main Workspace (8 cols Interactive Stage & Modules + 4 cols Real-Time Inspector) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Interactive Blueprint, Catalog, Wiring/BIOS, Performance/TCO, Rubric, Quiz, Guide */}
          <div className="xl:col-span-8 space-y-6">
            {/* 1. Interactive Architecture Blueprint & POST Tester */}
            <InteractiveArchitectureDiagram
              build={build}
              activeSlot={activeSlot}
              onSelectSlot={(slot) => {
                setActiveSlot(slot);
                const el = document.getElementById('catalogo');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
              checks={checks}
              power={power}
              wiring={wiring}
            />

            {/* 2. Component Catalog Selector */}
            <div id="catalogo">
              <ComponentCatalogSelector
                build={build}
                activeSlot={activeSlot}
                onSelectSlot={setActiveSlot}
                onUpdateComponent={handleUpdateComponent}
              />
            </div>

            {/* 3. Internal Wiring (F_PANEL / PSU) & UEFI BIOS Lab */}
            <div id="cableado-bios">
              <WiringAndBiosLab
                build={build}
                useCaseId={selectedUseCaseId}
                wiring={wiring}
                onChangeWiring={setWiring}
                bios={bios}
                onChangeBios={setBios}
              />
            </div>

            {/* 4. Performance, Bottleneck, Virtualization & 80 Plus TCO Energy Calculator */}
            <PerformanceAndEnergyAnalyzer build={build} power={power} />

            {/* 5. Rubric & Printable Budget Report */}
            <div id="evaluacion">
              <RubricAndBudgetReport
                build={build}
                scenario={currentScenario}
                budgetLimit={budgetLimit}
                checks={checks}
                evaluation={evaluation}
                onImportBuildIds={handleImportBuildIds}
              />
            </div>

            {/* 6. Interactive SMR Quiz & Random Client Work Order Generator */}
            <div id="test-smr">
              <InteractiveQuizAndGenerator
                onApplyGeneratedOrder={(ucId, newBudget) => {
                  setSelectedUseCaseId(ucId);
                  setBudgetLimit(newBudget);
                  setActiveChallengeId(null);
                }}
              />
            </div>

            {/* 7. SMR Workshop Reference Guide */}
            <div id="guia-smr">
              <WorkshopReferenceGuide />
            </div>
          </div>

          {/* Right 4 Columns: Sticky Real-Time Budget, Undo/Redo History & Compatibility Inspector */}
          <aside className="xl:col-span-4 xl:sticky xl:top-20 space-y-5">
            {/* Card 1: Real-Time Budget & Telemetry Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Control Económico en Tiempo Real
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Presupuesto de la Torre
                  </h2>
                </div>
                <div className="text-right font-mono">
                  <div
                    className={`text-2xl font-bold ${
                      totalPrice <= budgetLimit
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {totalPrice} €
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Límite: {budgetLimit} €
                  </div>
                </div>
              </div>

              {/* Budget Bar */}
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      totalPrice > budgetLimit
                        ? 'bg-rose-500'
                        : budgetPercentage > 90
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${budgetPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span
                    className={
                      budgetDifference >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }
                  >
                    {budgetDifference >= 0
                      ? `Margen disponible: +${budgetDifference} €`
                      : `Presupuesto excedido en: ${Math.abs(budgetDifference)} €`}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Nota: {evaluation.totalScore}/10
                  </span>
                </div>
              </div>

              {/* Quick Slot Summary List */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Componentes en Mesa de Montaje
                </div>
                {SLOT_DEFINITIONS.map((slot) => {
                  const part = build[slot.key];
                  const isCurrentSlot = activeSlot === slot.key;
                  return (
                    <div
                      key={slot.key}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isCurrentSlot
                          ? 'bg-sky-500/10 border border-sky-500/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-950/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSlot(slot.key)}
                        className="flex-1 text-left truncate cursor-pointer"
                      >
                        <span className="font-medium text-slate-500 dark:text-slate-400 mr-1.5">
                          {slot.shortLabel}:
                        </span>
                        <span
                          className={
                            part
                              ? 'text-slate-900 dark:text-slate-100 font-medium'
                              : 'text-slate-400 dark:text-slate-500 italic'
                          }
                        >
                          {part ? part.name : 'Sin instalar'}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {part ? `${part.price} €` : '—'}
                        </span>
                        {part && (
                          <button
                            type="button"
                            onClick={() => handleUpdateComponent(slot.key, null)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Quitar componente"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Interactive Build History (Undo/Redo & Smart Error Recovery) */}
            <BuildHistoryPanel
              history={history}
              currentIndex={historyIndex}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onJumpToIndex={handleJumpToHistoryIndex}
              onRestoreLastErrorFree={handleRestoreLastErrorFree}
            />

            {/* Card 3: Real-Time Physical & Logical Compatibility Inspector */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Diagnóstico en Tiempo Real
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Inspector de Compatibilidad
                  </h2>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    {errorCount} Err
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {warningCount} Avisos
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {okCount} OK
                  </span>
                </div>
              </div>

              {/* 10 Real-Time Checks Accordion */}
              <div className="space-y-2.5">
                {checks.map((check) => {
                  const isExpanded = expandedCheckId === check.id;
                  return (
                    <div
                      key={check.id}
                      className={`rounded-xl border transition-all ${
                        check.severity === 'error'
                          ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800/80'
                          : check.severity === 'warning'
                          ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/80'
                          : check.severity === 'ok'
                          ? 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                          : 'bg-slate-50/40 dark:bg-slate-950/30 border-slate-200/70 dark:border-slate-800/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCheckId(isExpanded ? null : check.id)
                        }
                        className="w-full text-left p-3 flex items-start gap-2.5 cursor-pointer"
                      >
                        <div className="mt-0.5 shrink-0">
                          {check.severity === 'error' && (
                            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          )}
                          {check.severity === 'warning' && (
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          )}
                          {check.severity === 'ok' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {check.severity === 'pending' && (
                            <Cpu className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {check.category}
                            </span>
                            {check.measuredValue && (
                              <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
                                {check.measuredValue}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                            {check.title}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                            {check.summary}
                          </p>
                        </div>
                      </button>

                      {(isExpanded || check.severity === 'error') && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-200/70 dark:border-slate-800/70 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                          <p className="leading-relaxed">
                            <strong className="text-slate-900 dark:text-slate-100">
                              Explicación didáctica:{' '}
                            </strong>
                            {check.technicalExplanation}
                          </p>
                          {(check.measuredValue || check.limitValue) && (
                            <div className="flex items-center justify-between font-mono text-[11px] pt-1 text-slate-500 dark:text-slate-400">
                              <span>Medido: {check.measuredValue ?? '—'}</span>
                              <span>Límite/Ref: {check.limitValue ?? '—'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Clean Educational Footer with Undistorted Logo & Link to unfantasmaenelsistema.com */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 px-6 no-print">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <a
              href="https://www.unfantasmaenelsistema.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src={logoSrc}
                alt="Logo Un Fantasma en el Sistema"
                referrerPolicy="no-referrer"
                className="w-12 h-12 object-contain shrink-0"
              />
            </a>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Simulador de Presupuestos y Compatibilidad de Hardware (SMR / ASIR)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Recurso educativo interactivo para Formación Profesional —{' '}
                <a
                  href="https://www.unfantasmaenelsistema.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 dark:text-sky-400 hover:underline font-medium"
                >
                  https://www.unfantasmaenelsistema.com/
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Compatible con GitHub Pages (SPA estática)</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.unfantasmaenelsistema.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 font-medium transition-colors"
            >
              <span>Un Fantasma en el Sistema</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
