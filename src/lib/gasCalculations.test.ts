import { describe, it, expect } from 'vitest';
import { calculateDive } from './gasCalculations';
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
