import type {
  StandingData,
  Section,
  SectionResult,
  StageState,
  DiveCalculation,
} from './types';
import { getBottomGasVolume, getStageVolume } from './types';

/**
 * Calculate the full dive plan from standing data and sections.
 *
 * Gas model:
 *  - Gas consumed per section = SCR × ATA × time  (free liters)
 *  - ATA = depth/10 + 1
 *  - Stages breathed first, in list order.
 *  - Stage dropped when it reaches (initialPressure / 2) + 15 bar.
 *  - Remaining gas for a section after stage drop comes from next stage or back gas.
 *  - If "reserve stage in back gas" is on, half of each stage's free liters
 *    is deducted from back gas capacity.
 *  - Usable back gas = effectiveBackGas / 3 (rule of thirds).
 *  - Turn warning when that third is consumed.
 */
export function calculateDive(
  standingData: StandingData,
  sections: Section[]
): DiveCalculation {
  const bottomGasVolume = getBottomGasVolume(standingData.bottomGasType);
  const totalBackGas = bottomGasVolume * standingData.bottomGasFillPressure;

  // Stage reservations deducted from back gas (per-stage setting)
  let stageReservation = 0;
  for (const stage of standingData.stages) {
    if (stage.reserveInBackGas) {
      const vol = getStageVolume(stage.tankType);
      stageReservation += (stage.fillPressure * vol) / 2;
    }
  }

  const effectiveBackGas = totalBackGas - stageReservation;
  const usableBackGas = effectiveBackGas / 3;

  // Mutable stage tracking
  const stageStates: StageState[] = standingData.stages.map((s) => {
    const volume = getStageVolume(s.tankType);
    return {
      id: s.id,
      tankType: s.tankType,
      initialPressure: s.fillPressure,
      currentPressure: s.fillPressure,
      volume,
      dropPressure: s.fillPressure / 2 + 15,
      dropped: false,
    };
  });

  let remainingBackGasLiters = totalBackGas;
  let backGasUsedTotal = 0;
  let runningTime = 0;
  let timeDepthProduct = 0;
  let currentDepth = 0;

  const results: SectionResult[] = [];

  for (const section of sections) {
    let time: number;
    let depth: number;

    if (section.type === 'swim') {
      time =
        standingData.swimSpeed > 0
          ? section.distance / standingData.swimSpeed
          : 0;
      depth = section.avgDepth;
      currentDepth = depth;
    } else if (section.type === 't-left' || section.type === 't-right') {
      time = 0;
      depth = currentDepth;
    } else {
      // jump-left, jump-right: 2 minutes
      time = 2;
      depth = currentDepth;
    }

    const ata = depth / 10 + 1;
    const gasNeeded = standingData.scr * ata * time;

    let remaining = gasNeeded;
    const droppedThisSection: string[] = [];

    // Consume from stages first
    while (remaining > 0) {
      const activeStage = stageStates.find((s) => !s.dropped);
      if (!activeStage) break;

      const availableFromStage =
        (activeStage.currentPressure - activeStage.dropPressure) *
        activeStage.volume;

      if (availableFromStage <= 0) {
        activeStage.dropped = true;
        droppedThisSection.push(activeStage.id);
        continue;
      }

      if (remaining <= availableFromStage) {
        activeStage.currentPressure -= remaining / activeStage.volume;
        remaining = 0;
      } else {
        // Exhaust this stage to its drop pressure
        remaining -= availableFromStage;
        activeStage.currentPressure = activeStage.dropPressure;
        activeStage.dropped = true;
        droppedThisSection.push(activeStage.id);
      }
    }

    // Remaining gas from back gas
    if (remaining > 0) {
      remainingBackGasLiters -= remaining;
      backGasUsedTotal += remaining;
      remaining = 0;
    }

    runningTime += time;
    timeDepthProduct += time * depth;
    const runningAvgDepth = runningTime > 0 ? timeDepthProduct / runningTime : 0;

    const turnWarning = backGasUsedTotal >= usableBackGas && usableBackGas > 0;

    results.push({
      sectionId: section.id,
      time,
      depth,
      gasConsumed: gasNeeded,
      runningTime,
      runningAvgDepth,
      remainingBackGasLiters,
      remainingBackGasBar:
        bottomGasVolume > 0
          ? remainingBackGasLiters / bottomGasVolume
          : 0,
      stageStates: stageStates.map((s) => ({ ...s })),
      stageDroppedIds: droppedThisSection,
      turnWarning,
      backGasUsedTotal,
      effectiveBackGas,
      usableBackGas,
    });
  }

  return {
    sections: results,
    totalBackGas,
    stageReservation,
    effectiveBackGas,
    usableBackGas,
    bottomGasVolume,
  };
}
