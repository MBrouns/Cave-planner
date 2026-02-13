import type {
  StandingData,
  Section,
  SectionResult,
  StageState,
  DiveCalculation,
} from './types';
import { getBottomGasVolume, getStageVolume, STAGE_TANK_TYPES } from './types';

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
 *
 * Recalculation sections: placed on the way back, they compute whether
 *   the diver can re-enter the cave on a different path. Two scenarios:
 *   1. Kill-stage: empty a picked-up stage going back in, exit on back gas.
 *   2. Back-gas re-entry: use a portion of back gas for re-entry when
 *      stages haven't been picked up yet.
 *   Sections after a recalculation are "way in" until the next turnaround.
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
      const dropPressure = stage.fillPressure / 2 + 15;
      stageReservation += (stage.fillPressure - dropPressure) * vol;
    }
  }

  const effectiveBackGas = totalBackGas - stageReservation;
  const conservatismLiters = (standingData.conservatism ?? 0) * bottomGasVolume;
  const usableBackGas = effectiveBackGas / 3 - conservatismLiters;

  // Rounded bar values used for turn warning comparison
  const turnPressureBar = bottomGasVolume > 0
    ? Math.ceil((totalBackGas - usableBackGas) / bottomGasVolume / 10) * 10
    : 0;
  const usableBackGasRounded = bottomGasVolume > 0
    ? Math.floor(usableBackGas / bottomGasVolume / 10) * 10 * bottomGasVolume
    : usableBackGas;

  // Build set of stage IDs that have explicit stage-drop sections while going in.
  // Direction tracks recalculation boundaries: after a recalculation, sections
  // are "way in" again until the next turnaround.
  const explicitDropStageIds = new Set<string>();
  {
    let wb = false;
    for (const s of sections) {
      if (s.type === 'turnaround') wb = !wb;
      else if (s.type === 'recalculation') wb = false;
      if (s.type === 'stage-drop' && s.stageId && !wb) {
        explicitDropStageIds.add(s.stageId);
      }
    }
  }

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
  const pendingDropInserts: { afterSectionId: string; stageId: string; splitAtDistance?: number }[] = [];

  // Direction state: tracks whether we're on the way back.
  // Toggled by turnaround, reset to false (way in) by recalculation.
  let isWayBack = false;

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    const sectionIsWayBack = isWayBack;

    // Update direction for NEXT section
    if (section.type === 'turnaround') {
      isWayBack = !isWayBack;
    } else if (section.type === 'recalculation') {
      isWayBack = false;
    }

    let time: number;
    let depth: number;

    if (section.type === 'turnaround' || section.type === 'recalculation') {
      time = 0;
      depth = currentDepth;
    } else if (section.type === 'stage-drop') {
      time = standingData.stageStandingTime ?? 2;
      depth = currentDepth;
      const stage = stageStates.find((s) => s.id === section.stageId);
      if (stage) {
        if (sectionIsWayBack) {
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
    const breathedStageIds: string[] = [];
    let breathedBackGas = false;

    // Stages skipped this section (at drop pressure, deferred to explicit stage-drop)
    const skippedStageIds = new Set<string>();

    // Stage-drop standing time is consumed from back gas only
    // Consume from stages first for all other sections
    while (remaining > 0 && section.type !== 'stage-drop') {
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
        if (!breathedStageIds.includes(activeStage.id)) breathedStageIds.push(activeStage.id);
      } else {
        // Exhaust this stage to its drop pressure
        remaining -= availableFromStage;
        activeStage.currentPressure = activeStage.dropPressure;
        if (availableFromStage > 0 && !breathedStageIds.includes(activeStage.id)) breathedStageIds.push(activeStage.id);

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
      breathedBackGas = true;
      remaining = 0;
    }

    runningTime += time;
    timeDepthProduct += time * depth;
    const runningAvgDepth = runningTime > 0 ? timeDepthProduct / runningTime : 0;

    const remainingBackGasBar = bottomGasVolume > 0
      ? remainingBackGasLiters / bottomGasVolume
      : 0;
    const turnWarning = !sectionIsWayBack && remainingBackGasBar < turnPressureBar && turnPressureBar > 0;

    results.push({
      sectionId: section.id,
      time,
      depth,
      gasConsumed: gasNeeded,
      runningTime,
      runningAvgDepth,
      remainingBackGasLiters,
      remainingBackGasBar,
      stageStates: stageStates.map((s) => ({ ...s })),
      stageDroppedIds: droppedThisSection,
      turnWarning,
      backGasUsedTotal,
      effectiveBackGas,
      usableBackGas,
      breathedStageIds,
      breathedBackGas,
      isWayBack: sectionIsWayBack,
    });
  }

  // ── Second pass: compute recalculation results and fix turn warnings ──
  const totalBackGasUsedAtEnd = results.length > 0
    ? results[results.length - 1].backGasUsedTotal
    : 0;

  // Track the active recalc turn pressure for post-recalculation "way in" sections.
  // Set when a recalculation is encountered, cleared when we return to way-back.
  let activeRecalcTurnPressure: number | null = null;

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    const result = results[si];

    if (section.type === 'recalculation') {
      const backGasToExit = totalBackGasUsedAtEnd - result.backGasUsedTotal;
      const backGasToExitBar = bottomGasVolume > 0 ? backGasToExit / bottomGasVolume : 0;

      // Find the first active (non-dropped) stage with gas remaining
      const activeStage = result.stageStates.find(
        (s) => !s.dropped && s.currentPressure > 0
      );
      // Find dropped stages that still have gas (not yet picked up)
      const droppedStagesWithGas = result.stageStates.filter(
        (s) => s.dropped && s.currentPressure > 0
      );

      if (activeStage) {
        // SCENARIO 1: Kill the stage
        // Condition: backGasToExit + stageRemaining ≤ remainingBackGas / 2
        const stageRemaining = activeStage.currentPressure * activeStage.volume;
        const possible =
          (backGasToExit + stageRemaining) <= (result.remainingBackGasLiters / 2);

        const tankLabel = STAGE_TANK_TYPES.find(
          (t) => t.name === activeStage.tankType
        )?.label ?? activeStage.tankType;

        const roundedBar = Math.floor(activeStage.currentPressure / 10) * 10;
        const roundedLiters = roundedBar * activeStage.volume;
        // Back gas isn't consumed during kill-stage re-entry (stage covers it),
        // so the turn pressure stays at the current back gas level.
        // Floor to avoid false warnings when bar isn't a clean multiple of 10.
        const recalcTurn = Math.floor(result.remainingBackGasBar / 10) * 10;

        result.recalculation = {
          possible,
          scenario: 'kill-stage',
          availableGasLiters: roundedLiters,
          availableGasBar: roundedBar,
          gasSourceLabel: tankLabel,
          gasSourceVolume: activeStage.volume,
          backGasToExitLiters: backGasToExit,
          backGasToExitBar,
          recalcTurnPressureBar: recalcTurn,
          stageRemainingLiters: roundedLiters,
          stageRemainingBar: roundedBar,
        };
      } else if (droppedStagesWithGas.length > 0) {
        // SCENARIO 2: Back gas re-entry
        // available = (remainingBackGas - stageReservation - 2 × backGasToExit) / 3
        const actualStageReservation = droppedStagesWithGas.reduce(
          (sum, s) => sum + s.currentPressure * s.volume,
          0
        );
        const available =
          (result.remainingBackGasLiters - actualStageReservation - 2 * backGasToExit) / 3;

        const rawBar = bottomGasVolume > 0 ? Math.max(0, available) / bottomGasVolume : 0;
        const roundedBar = Math.floor(rawBar / 10) * 10;
        const roundedLiters = roundedBar * bottomGasVolume;
        const recalcTurn = Math.ceil(
          (result.remainingBackGasBar - roundedBar) / 10
        ) * 10;

        result.recalculation = {
          possible: roundedBar > 0,
          scenario: 'backgas-reentry',
          availableGasLiters: roundedLiters,
          availableGasBar: roundedBar,
          gasSourceLabel: 'Back Gas',
          gasSourceVolume: bottomGasVolume,
          backGasToExitLiters: backGasToExit,
          backGasToExitBar,
          recalcTurnPressureBar: recalcTurn,
          stageReservationLiters: actualStageReservation,
        };
      } else {
        // No stages at all — back gas re-entry without stage reservation
        const available =
          (result.remainingBackGasLiters - 2 * backGasToExit) / 3;

        const rawBar = bottomGasVolume > 0 ? Math.max(0, available) / bottomGasVolume : 0;
        const roundedBar = Math.floor(rawBar / 10) * 10;
        const roundedLiters = roundedBar * bottomGasVolume;
        const recalcTurn = Math.ceil(
          (result.remainingBackGasBar - roundedBar) / 10
        ) * 10;

        result.recalculation = {
          possible: roundedBar > 0,
          scenario: 'backgas-reentry',
          availableGasLiters: roundedLiters,
          availableGasBar: roundedBar,
          gasSourceLabel: 'Back Gas',
          gasSourceVolume: bottomGasVolume,
          backGasToExitLiters: backGasToExit,
          backGasToExitBar,
          recalcTurnPressureBar: recalcTurn,
        };
      }

      activeRecalcTurnPressure = result.recalculation.possible
        ? result.recalculation.recalcTurnPressureBar
        : result.remainingBackGasBar;
      continue;
    }

    // Fix turn warnings for "way in" sections after a recalculation
    if (activeRecalcTurnPressure !== null) {
      if (!result.isWayBack) {
        // Way in after recalc — use recalc turn pressure instead of original
        result.turnWarning =
          result.remainingBackGasBar < activeRecalcTurnPressure &&
          activeRecalcTurnPressure > 0;
      } else {
        // Way back — past the side-passage turnaround, clear recalc state
        activeRecalcTurnPressure = null;
      }
    }
  }

  return {
    sections: results,
    totalBackGas,
    stageReservation,
    effectiveBackGas,
    usableBackGas,
    usableBackGasRounded,
    bottomGasVolume,
    pendingDropInserts,
  };
}
