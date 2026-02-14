import { describe, it, expect } from 'vitest';
import { calculateDive, computeFixedDistance } from './gasCalculations';
import type { StandingData, Section } from './types';

/**
 * Helper to create a minimal standing data object.
 */
function makeStandingData(overrides: Partial<StandingData> = {}): StandingData {
  return {
    scr: 20,
    swimSpeed: 10,
    bottomGasType: '2x80',        // 22L volume
    bottomGasFillPressure: 220,   // 4840L total
    conservatism: 0,
    stageStandingTime: 2,
    stages: [],
    ...overrides,
  };
}

describe('recalculation backGasToExit', () => {
  it('should show zero bars-to-exit when recalculation is at the cave exit (with side passage)', () => {
    // Scenario:
    //   1. Swim 100m in at 10m depth
    //   2. Turnaround
    //   3. Swim 100m back at 10m depth  (now at exit)
    //   4. Recalculation               (at exit — bars to exit should be 0)
    //   5. Swim 50m into side passage
    //   6. Turnaround
    //   7. Swim 50m back from side passage
    const sections: Section[] = [
      { id: 's1', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's2', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's3', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's4', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 's5', type: 'swim', avgDepth: 10, distance: 50 },
      { id: 's6', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's7', type: 'swim', avgDepth: 10, distance: 50 },
    ];

    const standingData = makeStandingData();
    const result = calculateDive(standingData, sections);

    // Find the recalculation section result
    const recalcResult = result.sections.find(s => s.sectionId === 's4');
    expect(recalcResult).toBeDefined();
    expect(recalcResult!.recalculation).toBeDefined();

    // At section s4, the diver has swum 100m in and 100m back — they are at the exit.
    // backGasToExitLiters and backGasToExitBar should both be 0.
    expect(recalcResult!.recalculation!.backGasToExitLiters).toBe(0);
    expect(recalcResult!.recalculation!.backGasToExitBar).toBe(0);
  });

  it('should show zero bars-to-exit when recalculation is at exit (no side passage)', () => {
    // Simplest case: swim in, turn, swim back, recalculation at exit
    const sections: Section[] = [
      { id: 's1', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's2', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's3', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's4', type: 'recalculation', avgDepth: 0, distance: 0 },
    ];

    const standingData = makeStandingData();
    const result = calculateDive(standingData, sections);

    const recalcResult = result.sections.find(s => s.sectionId === 's4');
    expect(recalcResult).toBeDefined();
    expect(recalcResult!.recalculation).toBeDefined();
    expect(recalcResult!.recalculation!.backGasToExitLiters).toBe(0);
    expect(recalcResult!.recalculation!.backGasToExitBar).toBe(0);
  });

  it('should show correct nonzero bars-to-exit when recalculation is partway back', () => {
    // Swim 100m in, turnaround, swim only 50m back, recalculation (still 50m from exit)
    const sections: Section[] = [
      { id: 's1', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's2', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's3', type: 'swim', avgDepth: 10, distance: 50 },
      { id: 's4', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 's5', type: 'swim', avgDepth: 10, distance: 50 },
      { id: 's6', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's7', type: 'swim', avgDepth: 10, distance: 50 },
    ];

    const standingData = makeStandingData();
    const result = calculateDive(standingData, sections);

    const recalcResult = result.sections.find(s => s.sectionId === 's4');
    expect(recalcResult).toBeDefined();
    expect(recalcResult!.recalculation).toBeDefined();

    // At the recalculation, we're 50m from exit at 10m depth.
    // Time to exit = 50m / 10 m/min = 5 min
    // ATA = 10/10 + 1 = 2
    // Gas to exit = 20 * 2 * 5 = 200 free liters
    // Bar = 200 / 22 ≈ 9.09 bar
    expect(recalcResult!.recalculation!.backGasToExitLiters).toBeCloseTo(200, 1);
    expect(recalcResult!.recalculation!.backGasToExitBar).toBeCloseTo(200 / 22, 1);
  });
});

describe('computeFixedDistance', () => {
  it('should compute positive max distance for swim after recalculation (not zero)', () => {
    // Scenario: swim 200m into main passage, turn around, swim back 200m
    // to exit, recalculation, then swim 500m into side passage (exceeds budget).
    //
    // The bug: fixDistance used the original usable back gas (1/3 rule) as
    // the budget. After the main passage round-trip consumes more than that
    // budget, usableBackGas - prevBackGasUsed <= 0, yielding distance = 0.
    //
    // The fix: after a recalculation, use the recalc turn pressure to
    // determine the available gas for the section.
    const sections: Section[] = [
      { id: 's1', type: 'swim', avgDepth: 20, distance: 200 },
      { id: 's2', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's3', type: 'swim', avgDepth: 20, distance: 200 },
      { id: 's4', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 's5', type: 'swim', avgDepth: 20, distance: 500 },
    ];

    const standingData = makeStandingData();
    const calc = calculateDive(standingData, sections);

    // Verify the side-passage swim triggers a turn warning
    expect(calc.sections[4].turnWarning).toBe(true);

    // The old buggy code would return 0 here because usableBackGas < prevBackGasUsed.
    // The fix should return a positive distance.
    const fixed = computeFixedDistance(
      sections, calc.sections, calc.usableBackGasRounded, calc.bottomGasVolume, 4,
    );
    expect(fixed).not.toBeNull();
    expect(fixed).toBeGreaterThan(0);

    // Verify: re-running the calculation with the fixed distance should
    // no longer trigger a turn warning on the side-passage swim.
    const fixedSections: Section[] = sections.map((s, i) =>
      i === 4 ? { ...s, distance: fixed! } : s,
    );
    const fixedCalc = calculateDive(standingData, fixedSections);
    expect(fixedCalc.sections[4].turnWarning).toBe(false);
  });

  it('should still work correctly for non-recalculation swim sections', () => {
    // A single long swim that exceeds the original back gas budget.
    const sections: Section[] = [
      { id: 's1', type: 'swim', avgDepth: 20, distance: 500 },
    ];

    const standingData = makeStandingData();
    const calc = calculateDive(standingData, sections);

    expect(calc.sections[0].turnWarning).toBe(true);

    const fixed = computeFixedDistance(
      sections, calc.sections, calc.usableBackGasRounded, calc.bottomGasVolume, 0,
    );
    expect(fixed).not.toBeNull();
    expect(fixed).toBeGreaterThan(0);

    // Re-running with the fixed distance should clear the turn warning.
    const fixedSections: Section[] = [{ ...sections[0], distance: fixed! }];
    const fixedCalc = calculateDive(standingData, fixedSections);
    expect(fixedCalc.sections[0].turnWarning).toBe(false);
  });

  it('should account for stage gas in kill-stage recalculation scenario', () => {
    // Scenario: swim in with a stage, drop it, turn around, swim back and
    // pick it up, recalculation (kill-stage), then swim into side passage.
    // The side-passage swim breathes stage gas first, then back gas. The fix
    // must include the stage gas as part of the available budget.
    const standingData = makeStandingData({
      stages: [{ id: 'stg1', tankType: 'alu80', fillPressure: 200, reserveInBackGas: false }],
    });

    const sections: Section[] = [
      { id: 's1', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's2', type: 'stage-drop', avgDepth: 0, distance: 0, stageId: 'stg1' },
      { id: 's3', type: 'turnaround', avgDepth: 0, distance: 0 },
      { id: 's4', type: 'swim', avgDepth: 10, distance: 100 },
      { id: 's5', type: 'stage-drop', avgDepth: 0, distance: 0, stageId: 'stg1' },
      { id: 's6', type: 'recalculation', avgDepth: 0, distance: 0 },
      { id: 's7', type: 'swim', avgDepth: 10, distance: 500 },
    ];

    const calc = calculateDive(standingData, sections);

    // Verify kill-stage scenario
    const recalcResult = calc.sections.find(s => s.sectionId === 's6');
    expect(recalcResult?.recalculation?.scenario).toBe('kill-stage');

    // The side-passage swim should trigger a turn warning
    const s7Result = calc.sections.find(s => s.sectionId === 's7');
    expect(s7Result?.turnWarning).toBe(true);

    const s7Index = sections.findIndex(s => s.id === 's7');
    const fixed = computeFixedDistance(
      sections, calc.sections, calc.usableBackGasRounded, calc.bottomGasVolume, s7Index,
    );

    // Must return a positive distance — not 0
    expect(fixed).not.toBeNull();
    expect(fixed).toBeGreaterThan(0);
  });

  it('should return null for non-swim sections', () => {
    const sections: Section[] = [
      { id: 's1', type: 'turnaround', avgDepth: 0, distance: 0 },
    ];
    const calc = calculateDive(makeStandingData(), sections);

    const fixed = computeFixedDistance(
      sections, calc.sections, calc.usableBackGasRounded, calc.bottomGasVolume, 0,
    );
    expect(fixed).toBeNull();
  });
});
