import { describe, it, expect } from 'vitest';
import { calculateDive } from './gasCalculations';
import type { StandingData, Section } from './types';

const standingData: StandingData = {
  scr: 20,
  swimSpeed: 15,
  bottomGasType: '2x80',
  bottomGasFillPressure: 220,
  conservatism: 0,
  stageStandingTime: 2,
  stages: [],
};

const standingDataWithStage: StandingData = {
  scr: 20,
  swimSpeed: 15,
  bottomGasType: '2x80',
  bottomGasFillPressure: 220,
  conservatism: 0,
  stageStandingTime: 2,
  stages: [
    { id: 's1', tankType: 'alu80', fillPressure: 210, reserveInBackGas: false },
  ],
};

// 2x80 (22L) at 220 bar → 4840L total, usable = 4840/3 ≈ 1613L
// turnPressureBar = ceil((4840 - 1613) / 22 / 10) * 10 = 150

describe('recalculation turn pressure (backgas-reentry)', () => {
  /**
   * Scenario A: recalcTurnPressure (170) HIGHER than original (150).
   *
   *   [0] Swim in   200m @ 10m  → remaining ≈ 4307L (196 bar)
   *   [1] Turnaround
   *   [2] Swim out  100m @ 10m  → remaining ≈ 4040L (184 bar)
   *   [3] Recalculation          (184 bar)
   *   [4] Swim in   200m @ 10m  → remaining ≈ 3507L (159 bar)
   *   [5] Turnaround
   *   [6] Swim out  200m @ 10m  → remaining ≈ 2973L (135 bar)
   *
   * Section [4] bar ≈ 159: above original 150, below recalc 170 → SHOULD warn.
   */
  it('warns when bar is below recalc turn pressure but above original', () => {
    const sections: Section[] = [
      { id: 'a', type: 'swim', avgDepth: 10, distance: 200 },
      { id: 'b', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'c', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'd', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 'e', type: 'swim', avgDepth: 10, distance: 200 },
      { id: 'f', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'g', type: 'swim', avgDepth: 10, distance: 200 },
    ];

    const calc = calculateDive(standingData, sections);
    const results = calc.sections;

    expect(results[3].recalculation!.recalcTurnPressureBar).toBe(170);
    const swim = results[4];
    expect(swim.isWayBack).toBe(false);
    expect(swim.remainingBackGasBar).toBeGreaterThan(150);
    expect(swim.remainingBackGasBar).toBeLessThan(170);
    expect(swim.turnWarning).toBe(true);
  });

  /**
   * Scenario B: recalcTurnPressure (130) LOWER than original (150).
   *
   * The diver consumes more gas on the way in so back gas is closer to
   * the original turn pressure at the recalculation point.
   *
   *   [0] Swim in   450m @ 10m  → remaining = 3640L (165 bar)
   *   [1] Turnaround
   *   [2] Swim out   45m @ 10m  → remaining = 3520L (160 bar)
   *   [3] Recalculation          (160 bar)
   *   [4] Swim in   100m @ 10m  → remaining ≈ 3253L (148 bar)
   *   [5] Turnaround
   *   [6] Swim out  100m @ 10m  → remaining ≈ 2987L (136 bar)
   *
   * Recalc: available rounded = 30 bar, recalcTurn = ceil((160-30)/10)*10 = 130
   *
   * Section [4] bar ≈ 148: below original 150, above recalc 130.
   * With recalc turn pressure → should NOT warn.
   * With original turn pressure → would incorrectly warn.
   */
  it('does not warn when bar is above recalc turn pressure but below original', () => {
    const sections: Section[] = [
      { id: 'a', type: 'swim', avgDepth: 10, distance: 450 },
      { id: 'b', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'c', type: 'swim', avgDepth: 10, distance: 45 },
      { id: 'd', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 'e', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'f', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'g', type: 'swim', avgDepth: 10, distance: 100 },
    ];

    const calc = calculateDive(standingData, sections);
    const results = calc.sections;

    // Verify original turn pressure is 150
    const originalTurn = Math.ceil(
      (calc.totalBackGas - calc.usableBackGas) / calc.bottomGasVolume / 10
    ) * 10;
    expect(originalTurn).toBe(150);

    // Verify recalc turn pressure is 130
    expect(results[3].recalculation!.recalcTurnPressureBar).toBe(130);

    const swim = results[4];
    expect(swim.isWayBack).toBe(false);
    // Bar is between recalc turn (130) and original turn (150)
    expect(swim.remainingBackGasBar).toBeGreaterThan(130);
    expect(swim.remainingBackGasBar).toBeLessThan(150);

    // Must use recalc turn pressure → turn warning should be FALSE
    expect(swim.turnWarning).toBe(false);
  });

  it('swim on way back after side-passage turnaround has no turn warning', () => {
    const sections: Section[] = [
      { id: 'a', type: 'swim', avgDepth: 10, distance: 200 },
      { id: 'b', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'c', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'd', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 'e', type: 'swim', avgDepth: 10, distance: 200 },
      { id: 'f', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'g', type: 'swim', avgDepth: 10, distance: 200 },
    ];

    const calc = calculateDive(standingData, sections);
    const results = calc.sections;
    expect(results[6].isWayBack).toBe(true);
    expect(results[6].turnWarning).toBe(false);
  });

  it('sections before the recalculation still use original turn pressure', () => {
    const sections: Section[] = [
      { id: 'a', type: 'swim', avgDepth: 10, distance: 200 },
      { id: 'b', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'c', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'd', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 'e', type: 'swim', avgDepth: 10, distance: 200 },
      { id: 'f', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'g', type: 'swim', avgDepth: 10, distance: 200 },
    ];

    const calc = calculateDive(standingData, sections);
    const results = calc.sections;

    expect(results[0].turnWarning).toBe(false);
    expect(results[0].remainingBackGasBar).toBeGreaterThan(150);

    expect(results[2].isWayBack).toBe(true);
    expect(results[2].turnWarning).toBe(false);
  });
});

/**
 * Kill-stage scenario: diver picks up a stage on the way back, then
 * recalculates. The stage covers gas for the side-passage entry, so back
 * gas should stay roughly constant. The recalc turn pressure must NOT be
 * above the current back gas bar, otherwise a false turn warning fires
 * on every section even though no back gas is being consumed.
 *
 * Setup: Alu80 (11L) at 210 bar, drop at (210/2)+15 = 120 bar.
 *   Stage usable going in: (210-120)*11 = 990L. Picked up on way back
 *   at 120 bar, breathed down toward 0 (dropPressure set to 0 on pickup).
 *
 * Plan:
 *   [0] Swim in    100m @ 10m   (consumes from stage)
 *   [1] Stage drop S1           (drop at 120 bar)
 *   [2] Swim in    100m @ 10m   (consumes from back gas)
 *   [3] Turnaround
 *   [4] Swim out   100m @ 10m   (back gas)
 *   [5] Stage pickup S1         (pickup, re-activates at 120 bar)
 *   [6] Swim out    50m @ 10m   (consumes from stage)
 *   [7] Recalculation
 *   [8] Swim in     50m @ 10m   (should consume from stage, NOT back gas)
 *   [9] Turnaround
 *  [10] Swim out    50m @ 10m
 */
describe('recalculation turn pressure (kill-stage)', () => {
  it('does not false-warn when back gas is constant during stage-powered re-entry', () => {
    const sections: Section[] = [
      { id: 'a', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'b', type: 'stage-drop', avgDepth: 0, distance: 0, stageId: 's1' },
      { id: 'c', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'd', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'e', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 'f', type: 'stage-drop', avgDepth: 0, distance: 0, stageId: 's1' },
      { id: 'g', type: 'swim', avgDepth: 10, distance: 50 },
      { id: 'h', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 'i', type: 'swim', avgDepth: 10, distance: 50 },
      { id: 'j', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 'k', type: 'swim', avgDepth: 10, distance: 50 },
    ];

    const calc = calculateDive(standingDataWithStage, sections);
    const results = calc.sections;

    // Recalculation should detect kill-stage scenario
    const recalc = results[7].recalculation;
    expect(recalc).toBeDefined();
    expect(recalc!.scenario).toBe('kill-stage');

    // Section [8]: swim after recalc, "way in", breathing from stage
    const swimAfterRecalc = results[8];
    expect(swimAfterRecalc.isWayBack).toBe(false);

    // Stage should be covering gas, so back gas should be roughly the same
    // as at the recalculation point
    const backGasAtRecalc = results[7].remainingBackGasBar;
    const backGasAtSwim = swimAfterRecalc.remainingBackGasBar;

    // If stage covers the swim, back gas delta should be 0 or very small
    const backGasDelta = backGasAtRecalc - backGasAtSwim;
    expect(backGasDelta).toBeLessThan(1);

    // The recalc turn pressure should NOT be above the current back gas bar
    expect(recalc!.recalcTurnPressureBar).toBeLessThanOrEqual(
      Math.floor(backGasAtRecalc / 10) * 10
    );

    // No false turn warning on the swim section
    expect(swimAfterRecalc.turnWarning).toBe(false);
  });
});
