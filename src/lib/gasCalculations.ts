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
 *
 * Stage-drop sections: explicit markers for when a stage is dropped.
 *   Auto-inserted by the UI when the calculation detects a stage reaching
 *   drop pressure. If an explicit stage-drop section exists for a stage,
 *   the drop is deferred to that section.
 *
 * Stage-pickup sections: reverse of stage-drop, used on the way back.
 *   Re-activates a dropped stage and breathes remaining gas (down to 0).
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

  // Build set of stage IDs that have explicit stage-drop sections (not pickups)
  const explicitDropStageIds = new Set(
    sections
      .filter((s) => s.type === 'stage-drop' && s.stageId && !s.wayBack)
      .map((s) => s.stageId!)
  );

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
  const pendingDropInserts: { afterSectionId: string; stageId: string }[] = [];

  for (const section of sections) {
    let time: number;
    let depth: number;

    if (section.type === 'stage-drop') {
      time = 0;
      depth = currentDepth;
      const stage = stageStates.find((s) => s.id === section.stageId);
      if (stage) {
        if (section.wayBack) {
          // Pickup: re-activate a dropped stage and breathe remaining gas
          if (stage.dropped) {
            stage.dropped = false;
            stage.dropPressure = 0;
          }
        } else {
          // Drop: mark stage as dropped
          if (!stage.dropped) {
            stage.dropped = true;
          }
        }
      }
    } else if (section.type === 'swim') {
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

    // Stages skipped this section (at drop pressure, deferred to explicit stage-drop)
    const skippedStageIds = new Set<string>();

    // Consume from stages first
    while (remaining > 0) {
      const activeStage = stageStates.find(
        (s) => !s.dropped && !skippedStageIds.has(s.id)
      );
      if (!activeStage) break;

      const availableFromStage =
        (activeStage.currentPressure - activeStage.dropPressure) *
        activeStage.volume;

      if (availableFromStage <= 0) {
        if (explicitDropStageIds.has(activeStage.id)) {
          // Explicit stage-drop section exists — skip, don't drop inline
          skippedStageIds.add(activeStage.id);
        } else {
          // No explicit section — drop inline and record for auto-insertion
          activeStage.dropped = true;
          droppedThisSection.push(activeStage.id);
          const consumed = gasNeeded - remaining;
          pendingDropInserts.push({
            afterSectionId: section.id,
            stageId: activeStage.id,
            splitAtDistance:
              section.type === 'swim' && gasNeeded > 0
                ? Math.round((consumed / gasNeeded) * section.distance)
                : undefined,
          });
        }
        continue;
      }

      if (remaining <= availableFromStage) {
        activeStage.currentPressure -= remaining / activeStage.volume;
        remaining = 0;
      } else {
        // Exhaust this stage to its drop pressure
        remaining -= availableFromStage;
        activeStage.currentPressure = activeStage.dropPressure;

        if (explicitDropStageIds.has(activeStage.id)) {
          // Defer the actual drop to the explicit stage-drop section
          skippedStageIds.add(activeStage.id);
        } else {
          activeStage.dropped = true;
          droppedThisSection.push(activeStage.id);
          const consumed = gasNeeded - remaining;
          pendingDropInserts.push({
            afterSectionId: section.id,
            stageId: activeStage.id,
            splitAtDistance:
              section.type === 'swim' && gasNeeded > 0
                ? Math.round((consumed / gasNeeded) * section.distance)
                : undefined,
          });
        }
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
    pendingDropInserts,
  };
}
