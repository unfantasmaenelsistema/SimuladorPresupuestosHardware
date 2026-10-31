import { describe, expect, it } from 'vitest';
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
} from '../data/hardwareCatalog';
import { PCBuildState, UseCaseId } from '../types/hardware';
import {
  calculateTotalPrice,
  effectiveM2PcieGen,
  evaluateBuild,
  runCompatibilityChecks,
} from './compatibilityEngine';
import { toWinAnsi } from './pdfText';

type Ids = Partial<Record<keyof PCBuildState, string>>;

function find<T extends { id: string }>(list: T[], id?: string): T | null {
  if (!id) return null;
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`id inexistente en el catálogo: ${id}`);
  return item;
}

function build(ids: Ids): PCBuildState {
  return {
    cpu: find(CPU_CATALOG, ids.cpu),
    motherboard: find(MOTHERBOARD_CATALOG, ids.motherboard),
    ram: find(RAM_CATALOG, ids.ram),
    cooler: find(COOLER_CATALOG, ids.cooler),
    gpu: find(GPU_CATALOG, ids.gpu),
    storagePrimary: find(STORAGE_CATALOG, ids.storagePrimary),
    storageSecondary: find(STORAGE_CATALOG, ids.storageSecondary),
    pcCase: find(CASE_CATALOG, ids.pcCase),
    psu: find(PSU_CATALOG, ids.psu),
  };
}

const scenario = (id: UseCaseId) => USE_CASES.find((u) => u.id === id)!;
const severityOf = (b: PCBuildState, checkId: string) =>
  runCompatibilityChecks(b).find((c) => c.id === checkId)?.severity;

describe('catálogo', () => {
  it('los ids son únicos en todo el catálogo', () => {
    const all = [
      ...CPU_CATALOG,
      ...MOTHERBOARD_CATALOG,
      ...RAM_CATALOG,
      ...COOLER_CATALOG,
      ...GPU_CATALOG,
      ...STORAGE_CATALOG,
      ...CASE_CATALOG,
      ...PSU_CATALOG,
    ].map((x) => x.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('los kits de RAM son coherentes (capacidad y velocidad JEDEC)', () => {
    for (const r of RAM_CATALOG) {
      expect(r.modules * r.capacityPerModuleGb, r.id).toBe(r.totalCapacityGb);
      expect(r.jedecSpeedMhz, r.id).toBeLessThanOrEqual(r.speedMhz);
    }
  });

  it('la ranura M.2 de cada placa nunca es más rápida que su ranura gráfica', () => {
    for (const m of MOTHERBOARD_CATALOG) {
      expect(m.m2PcieVersion, m.id).toBeLessThanOrEqual(m.maxPcieVersion);
    }
  });
});

describe('montajes base recomendados', () => {
  for (const [useCase, ids] of Object.entries(RECOMMENDED_PRESETS)) {
    it(`${useCase}: sin errores ni avisos, cumple el encargo y entra en presupuesto`, () => {
      const b = build(ids);
      const sc = scenario(useCase as UseCaseId);
      const ev = evaluateBuild(b, sc, sc.defaultBudget);
      expect(runCompatibilityChecks(b).filter((c) => c.severity !== 'ok')).toEqual([]);
      expect(ev.canBoot).toBe(true);
      expect(calculateTotalPrice(b)).toBeLessThanOrEqual(sc.defaultBudget);
      expect(ev.useCaseChecklist.filter((i) => !i.met)).toEqual([]);
      expect(ev.totalScore).toBeGreaterThanOrEqual(9);
    });
  }
});

describe('retos Caza-Errores', () => {
  const reto = (id: string) => build(BROKEN_CHALLENGES.find((c) => c.id === id)!.buildIds);

  it('cada reto no arranca y su nota queda limitada a 4.5', () => {
    for (const c of BROKEN_CHALLENGES) {
      const ev = evaluateBuild(build(c.buildIds), scenario(c.targetUseCase), c.targetBudget);
      expect(ev.canBoot, c.id).toBe(false);
      expect(ev.totalScore, c.id).toBeLessThanOrEqual(4.5);
    }
  });

  it('avería 1: socket, DDR5 en placa DDR4, sin vídeo y placa ATX en caja Micro-ATX', () => {
    const b = reto('reto-1-ofimatica-sin-video');
    for (const id of ['check-socket', 'check-ram', 'check-video', 'check-form-factor']) {
      expect(severityOf(b, id), id).toBe('error');
    }
  });

  it('avería 2: disipador que choca, fuente sin cables PCIe y RAM en Single Channel', () => {
    const b = reto('reto-2-gaming-colision-y-fuente');
    expect(severityOf(b, 'check-cooler-clearance')).toBe('error');
    expect(severityOf(b, 'check-psu')).toBe('error');
    expect(severityOf(b, 'check-ram')).toBe('warning');
  });

  it('avería 3: 4 módulos en placa de 2 ranuras y disipador stock en un Ryzen 9', () => {
    const b = reto('reto-3-virtualizacion-dimms-vrm');
    expect(severityOf(b, 'check-ram')).toBe('error');
    expect(severityOf(b, 'check-tdp')).toBe('error');
  });
});

describe('almacenamiento: generación PCIe real del M.2', () => {
  const base: Ids = {
    ram: 'ram-ddr5-32gb-2x16',
    storagePrimary: 'sto-nvme-2tb-t700',
  };

  it('en LGA1700 el M.2 es PCIe 4.0 aunque la ranura gráfica sea 5.0', () => {
    const b = build({ ...base, cpu: 'cpu-i5-14600kf', motherboard: 'mb-b760-tuf-ddr5' });
    expect(effectiveM2PcieGen(b)).toBe(4);
    expect(severityOf(b, 'check-storage')).toBe('warning');
  });

  it('AM5 con M.2 PCIe 5.0 aprovecha un SSD PCIe 5.0', () => {
    const b = build({ ...base, cpu: 'cpu-r9-7950x', motherboard: 'mb-x670e-proart' });
    expect(effectiveM2PcieGen(b)).toBe(5);
    expect(severityOf(b, 'check-storage')).toBe('ok');
  });

  it('la APU 8500G limita el M.2 a PCIe 4.0 aunque la placa sea PCIe 5.0', () => {
    const b = build({ ...base, cpu: 'cpu-r5-8500g', motherboard: 'mb-b650m-hdv' });
    expect(effectiveM2PcieGen(b)).toBe(4);
    expect(severityOf(b, 'check-storage')).toBe('warning');
  });

  it('también avisa si la unidad limitada es la secundaria', () => {
    const b = build({
      cpu: 'cpu-r5-7600x',
      motherboard: 'mb-b650-gaming-x',
      storagePrimary: 'sto-nvme-1tb-sn770',
      storageSecondary: 'sto-nvme-2tb-t700',
    });
    expect(severityOf(b, 'check-storage')).toBe('warning');
  });
});

describe('plataforma AM4 económica', () => {
  it('un NVMe PCIe 4.0 en Ryzen 4600G + A520 trabaja a PCIe 3.0', () => {
    const b = build({ cpu: 'cpu-r5-4600g', motherboard: 'mb-a520m-k', storagePrimary: 'sto-nvme-500-sn580' });
    expect(effectiveM2PcieGen(b)).toBe(3);
    expect(severityOf(b, 'check-storage')).toBe('warning');
  });
});

describe('memoria y fuente', () => {
  it('4 módulos DDR5 en placa de 4 ranuras avisan de la bajada de frecuencia (2DPC)', () => {
    const b = build({ cpu: 'cpu-r9-7900x', motherboard: 'mb-b650-gaming-x', ram: 'ram-ddr5-64gb-4x16' });
    expect(severityOf(b, 'check-ram')).toBe('warning');
  });

  it('gaming exige fuente 80 Plus con margen; la del montaje base lo cumple', () => {
    const ids = { ...RECOMMENDED_PRESETS.gaming };
    const okItem = evaluateBuild(build(ids), scenario('gaming'), 1450).useCaseChecklist.find((i) =>
      i.label.startsWith('Fuente 80 Plus')
    );
    expect(okItem?.met).toBe(true);
    const sinCertificar = evaluateBuild(
      build({ ...ids, gpu: 'gpu-igpu', psu: 'psu-tooq-400w' }),
      scenario('gaming'),
      1450
    ).useCaseChecklist.find((i) => i.label.startsWith('Fuente 80 Plus'));
    expect(sinCertificar?.met).toBe(false);
  });
});

describe('texto del PDF', () => {
  it('sustituye símbolos que Helvetica no tiene y conserva tildes y €', () => {
    expect(toWinAnsi('142 W (≤ 235 W)')).toBe('142 W (<= 235 W)');
    expect(toWinAnsi('GPU ≥ 12 GB → OK')).toBe('GPU >= 12 GB -> OK');
    expect(toWinAnsi('Microinformáticos — 1.450 € «ñ»')).toBe('Microinformáticos — 1.450 € «ñ»');
    expect(toWinAnsi('icono 🚀')).toBe('icono ??');
  });
});
