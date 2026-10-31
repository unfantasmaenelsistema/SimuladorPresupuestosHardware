export type SocketType = 'AM4' | 'AM5' | 'LGA1700';
export type RamType = 'DDR4' | 'DDR5';
export type FormFactor = 'ATX' | 'Micro-ATX' | 'Mini-ITX';
export type StorageInterface = 'NVMe PCIe 5.0' | 'NVMe PCIe 4.0' | 'NVMe PCIe 3.0' | 'SATA III';
export type PsuEfficiency = 'Sin Certificación' | '80 Plus Bronze' | '80 Plus Gold' | '80 Plus Platinum';

export type UseCaseId = 'ofimatica' | 'gaming' | 'virtualizacion' | 'edicion' | 'libre';

export interface CPUComponent {
  id: string;
  name: string;
  brand: 'AMD' | 'Intel';
  socket: SocketType;
  cores: number;
  threads: number;
  baseClockGhz: number;
  boostClockGhz: number;
  tdpWatts: number;
  maxTurboWatts: number;
  supportedRam: RamType[];
  hasIntegratedGraphics: boolean;
  igpuName?: string;
  pcieVersion: 3 | 4 | 5;
  includesStockCooler: boolean;
  gamingScore: number; // 1-100
  multicoreScore: number; // 1-100
  price: number;
  notes: string;
}

export interface MotherboardComponent {
  id: string;
  name: string;
  brand: string;
  socket: SocketType;
  chipset: string;
  formFactor: FormFactor;
  ramType: RamType;
  ramSlots: 2 | 4;
  maxRamGb: number;
  m2Slots: number;
  maxPcieVersion: 3 | 4 | 5; // ranura gráfica PCIe x16 principal
  m2PcieVersion: 3 | 4 | 5; // ranura M.2 más rápida de la placa
  sataPorts: number;
  maxRecommendedCpuWatts: number; // VRM thermal capability
  lanSpeedGbps: 1 | 2.5 | 10;
  hasWifi: boolean;
  price: number;
  notes: string;
}

export interface RamComponent {
  id: string;
  name: string;
  ramType: RamType;
  modules: 1 | 2 | 4;
  capacityPerModuleGb: number;
  totalCapacityGb: number;
  speedMhz: number;
  jedecSpeedMhz: number; // velocidad sin perfil XMP/EXPO
  casLatency: number;
  isEcc: boolean;
  price: number;
  notes: string;
}

export interface CoolerComponent {
  id: string;
  name: string;
  type: 'Aire Stock' | 'Aire Perfil Bajo' | 'Aire Torre Simple' | 'Aire Doble Torre' | 'Líquida AIO 240mm';
  maxTdpWatts: number;
  heightMm: number;
  requiresAio240Mount: boolean;
  noiseDb: number;
  supportedSockets: SocketType[];
  price: number;
  notes: string;
}

export interface GpuComponent {
  id: string;
  name: string;
  chipsetBrand: 'Integrada' | 'NVIDIA' | 'AMD';
  vramGb: number;
  tdpWatts: number;
  lengthMm: number;
  recommendedPsuWatts: number;
  requiresPciePowerConnector: boolean;
  gamingScore: number; // 0-100
  computeScore: number; // 0-100
  price: number;
  notes: string;
}

export interface StorageComponent {
  id: string;
  name: string;
  type: 'NVMe M.2' | 'SSD 2.5"' | 'HDD 3.5"';
  interface: StorageInterface;
  capacityGb: number;
  readSpeedMbs: number;
  writeSpeedMbs: number;
  watts: number;
  price: number;
  notes: string;
}

export interface CaseComponent {
  id: string;
  name: string;
  supportedFormFactors: FormFactor[];
  maxCoolerHeightMm: number;
  maxGpuLengthMm: number;
  supportsAio240: boolean;
  driveBays35: number;
  driveBays25: number;
  includedFans: number;
  price: number;
  notes: string;
}

export interface PsuComponent {
  id: string;
  name: string;
  wattage: number;
  effective12vWatts: number;
  efficiency: PsuEfficiency;
  modular: boolean;
  atx30Ready: boolean;
  hasPciePowerConnectors: boolean;
  price: number;
  notes: string;
}

export interface PCBuildState {
  cpu: CPUComponent | null;
  motherboard: MotherboardComponent | null;
  ram: RamComponent | null;
  cooler: CoolerComponent | null;
  gpu: GpuComponent | null;
  storagePrimary: StorageComponent | null;
  storageSecondary: StorageComponent | null;
  pcCase: CaseComponent | null;
  psu: PsuComponent | null;
}

export type ComponentSlotKey = keyof PCBuildState;

export interface UseCaseScenario {
  id: UseCaseId;
  title: string;
  shortTitle: string;
  clientProfile: string;
  defaultBudget: number;
  minRamGb: number;
  minStorageGb: number;
  requiresDedicatedGpu: boolean;
  minVramGb: number;
  minCpuCores: number;
  minCpuMulticoreScore: number;
  minGamingScore: number;
  recommendedDualChannel: boolean;
  requiresSecondaryStorage?: boolean;
  learningObjectives: string[];
  requirementsList: string[];
}

export type CheckSeverity = 'ok' | 'warning' | 'error' | 'pending';

export interface CompatibilityCheckItem {
  id: string;
  category:
    | 'Socket y Chipset'
    | 'Memoria RAM'
    | 'Señal de Vídeo'
    | 'Geometría Disipador'
    | 'Geometría GPU'
    | 'Formato Placa/Chasis'
    | 'Disipación Térmica (TDP)'
    | 'Potencia Fuente (PSU)'
    | 'Almacenamiento y Buses'
    | 'VRM Placa Base';
  title: string;
  severity: CheckSeverity;
  summary: string;
  technicalExplanation: string;
  measuredValue?: string;
  limitValue?: string;
}

export interface BrokenChallengePreset {
  id: string;
  title: string;
  symptom: string;
  targetUseCase: UseCaseId;
  targetBudget: number;
  description: string;
  buildIds: {
    cpu: string;
    motherboard: string;
    ram: string;
    cooler: string;
    gpu: string;
    storagePrimary: string;
    storageSecondary?: string;
    pcCase: string;
    psu: string;
  };
}

export interface EvaluationResult {
  totalScore: number; // 0 to 10
  compatibilityScore: number; // max 4.0
  budgetScore: number; // max 2.0
  useCaseScore: number; // max 2.5
  balanceScore: number; // max 1.5
  canBoot: boolean;
  verdictTitle: string;
  verdictFeedback: string[];
  useCaseChecklist: {
    label: string;
    met: boolean;
    detail: string;
  }[];
}
