export interface BottleType {
  name: string;
  label: string;
  volume: number; // internal volume in liters
}

export const BOTTOM_GAS_TYPES: BottleType[] = [
  { name: '2x80', label: '2x80 (22L)', volume: 22 },
  { name: 'd12', label: 'D12 (24L)', volume: 24 },
];

export const STAGE_TANK_TYPES: BottleType[] = [
  { name: 'alu80', label: 'Alu80 (11L)', volume: 11 },
  { name: 'alu40', label: 'Alu40 (5.5L)', volume: 5.5 },
];

export interface StageEntry {
  id: string;
  tankType: string;
  fillPressure: number; // bar
  reserveInBackGas: boolean;
}

export interface StandingData {
  scr: number; // surface consumption rate in L/min/ATA
  swimSpeed: number; // m/min
  bottomGasType: string; // key into BOTTOM_GAS_TYPES
  bottomGasFillPressure: number; // bar
  stages: StageEntry[];
}

export type SectionType = 'swim' | 't-left' | 't-right' | 'jump-left' | 'jump-right';

export interface Section {
  id: string;
  type: SectionType;
  avgDepth: number; // meters (used for swim, 0 for nav)
  distance: number; // meters (used for swim, 0 for nav)
  wayBack?: boolean;
}

export interface StageState {
  id: string;
  tankType: string;
  initialPressure: number;
  currentPressure: number;
  volume: number; // tank internal volume
  dropPressure: number;
  dropped: boolean;
}

export interface SectionResult {
  sectionId: string;
  time: number; // minutes
  depth: number; // meters (effective depth for this section)
  gasConsumed: number; // free liters
  runningTime: number;
  runningAvgDepth: number;
  remainingBackGasLiters: number;
  remainingBackGasBar: number;
  stageStates: StageState[];
  stageDroppedIds: string[]; // stage IDs dropped during this section
  turnWarning: boolean;
  backGasUsedTotal: number;
  effectiveBackGas: number;
  usableBackGas: number; // 1/3 of effective
}

export interface DiveCalculation {
  sections: SectionResult[];
  totalBackGas: number;
  stageReservation: number;
  effectiveBackGas: number;
  usableBackGas: number;
  bottomGasVolume: number;
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  'swim': 'Swim',
  't-left': 'T Left',
  't-right': 'T Right',
  'jump-left': 'Jump Left',
  'jump-right': 'Jump Right',
};

export function getBottomGasVolume(type: string): number {
  return BOTTOM_GAS_TYPES.find(b => b.name === type)?.volume ?? 22;
}

export function getStageVolume(type: string): number {
  return STAGE_TANK_TYPES.find(s => s.name === type)?.volume ?? 11;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
