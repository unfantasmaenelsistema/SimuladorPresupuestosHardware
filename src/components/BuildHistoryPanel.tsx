import React from 'react';
import {
  CheckCircle2,
  Clock,
  History,
  Redo2,
  RotateCcw,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import { PCBuildState } from '../types/hardware';

export interface BuildHistoryEntry {
  id: string;
  timestamp: string;
  actionLabel: string;
  slotChanged?: string;
  build: PCBuildState;
  totalPrice: number;
  errorCount: number;
}

interface BuildHistoryPanelProps {
  history: BuildHistoryEntry[];
  currentIndex: number;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToIndex: (index: number) => void;
  onRestoreLastErrorFree: () => void;
}

export const BuildHistoryPanel: React.FC<BuildHistoryPanelProps> = ({
  history,
  currentIndex,
  onUndo,
  onRedo,
  onJumpToIndex,
  onRestoreLastErrorFree,
}) => {
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const currentEntry = history[currentIndex];

  // Check if there is an earlier state with 0 errors when current state has errors
  const hasErrorFreePreviousState =
    currentEntry &&
    currentEntry.errorCount > 0 &&
    history.slice(0, currentIndex).some((entry) => entry.errorCount === 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Control de Versiones del Montaje (Ctrl+Z / Ctrl+Y)
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Historial de Cambios ({currentIndex + 1}/{history.length})
            </h2>
          </div>
        </div>

        {/* Undo / Redo Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer último cambio (Ctrl+Z)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Deshacer
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rehacer cambio (Ctrl+Y)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Redo2 className="w-3.5 h-3.5" />
            Rehacer
          </button>
        </div>
      </div>

      {/* Smart Recovery Button if current build has compatibility errors */}
      {hasErrorFreePreviousState && (
        <button
          type="button"
          onClick={onRestoreLastErrorFree}
          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          Volver al último paso sin errores de compatibilidad
        </button>
      )}

      {/* Interactive Timeline List (Most recent first) */}
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {[...history].reverse().map((entry, reversedIdx) => {
          const actualIndex = history.length - 1 - reversedIdx;
          const isCurrent = actualIndex === currentIndex;
          const isFuture = actualIndex > currentIndex;

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onJumpToIndex(actualIndex)}
              className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isCurrent
                  ? 'bg-sky-500/10 border-sky-500 text-slate-900 dark:text-slate-100'
                  : isFuture
                  ? 'bg-slate-50/40 dark:bg-slate-950/30 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-slate-300'
                  : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    #{actualIndex + 1} · {entry.timestamp}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                      · Actual
                    </span>
                  )}
                  {isFuture && (
                    <span className="text-[10px] font-mono text-slate-400">
                      · Deshecho
                    </span>
                  )}
                </div>
                <div className="font-medium truncate mt-0.5">
                  {entry.actionLabel}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                <span>{entry.totalPrice} €</span>
                {entry.errorCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-semibold"
                    title={`${entry.errorCount} incompatibilidad(es) en este paso`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {entry.errorCount}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
                    title="Sin errores de compatibilidad en este paso"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
