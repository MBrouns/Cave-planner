import { describe, it, expect } from 'vitest';
import { calculateDive } from './gasCalculations';
import type { StandingData, Section } from './types';
import { generateId } from './types';

describe('gasCalculations', () => {
  describe('recalculation gas-to-exit calculation', () => {
    it('should show zero bars to exit when swimming in 100m, turnaround, recalc, and swim back 100m', () => {
      // Setup: Simple dive with no stages
      const standingData: StandingData = {
        scr: 20, // L/min/ATA
        swimSpeed: 20, // m/min
        bottomGasType: '2x80',
        bottomGasFillPressure: 200, // bar
        conservatism: 0,
        stageStandingTime: 2,
        stages: [],
      };

      // Scenario: Swim in 100m at 20m depth, turnaround, recalc, swim back 100m
      const sections: Section[] = [
        {
          id: generateId(),
          type: 'swim',
          avgDepth: 20,
          distance: 100,
        },
        {
          id: generateId(),
          type: 'turnaround',
          avgDepth: 0,
          distance: 0,
        },
        {
          id: generateId(),
          type: 'recalculation',
          avgDepth: 0,
          distance: 0,
        },
        {
          id: generateId(),
          type: 'swim',
          avgDepth: 20,
          distance: 100,
        },
      ];

      const result = calculateDive(standingData, sections);

      // After swimming back 100m (section index 3), we should be at the exit
      const lastSection = result.sections[3];
      expect(lastSection.distanceFromExit).toBe(0);
      expect(lastSection.timeFromExit).toBe(0);
      expect(lastSection.freeLitersFromExit).toBe(0);

      // At the recalculation point (section index 2), we should be 100m from exit
      const recalcSection = result.sections[2];
      expect(recalcSection.distanceFromExit).toBe(100);

      // The recalculation should show the gas needed to swim back 100m
      expect(recalcSection.recalculation).toBeDefined();

      // After swimming back in the last section, bars to exit should be zero
      // (or close to zero, accounting for gas consumption)
      const finalBackGasBar = lastSection.remainingBackGasBar;
      const totalBackGasBar = standingData.bottomGasFillPressure;

      // We consumed gas going in and coming back, but we're at the exit now
      // The "freeLitersFromExit" should be 0 because we don't need any more gas to exit
      expect(lastSection.freeLitersFromExit).toBe(0);
    });

    it('should correctly calculate distance from exit after recalculation without side passage', () => {
      const standingData: StandingData = {
        scr: 20,
        swimSpeed: 20,
        bottomGasType: '2x80',
        bottomGasFillPressure: 200,
        conservatism: 0,
        stageStandingTime: 2,
        stages: [],
      };

      // Swim in 100m, turnaround, swim back 50m, recalc, swim back 50m more
      const sections: Section[] = [
        {
          id: generateId(),
          type: 'swim',
          avgDepth: 20,
          distance: 100,
        },
        {
          id: generateId(),
          type: 'turnaround',
          avgDepth: 0,
          distance: 0,
        },
        {
          id: generateId(),
          type: 'swim',
          avgDepth: 20,
          distance: 50,
        },
        {
          id: generateId(),
          type: 'recalculation',
          avgDepth: 0,
          distance: 0,
        },
        {
          id: generateId(),
          type: 'swim',
          avgDepth: 20,
          distance: 50,
        },
      ];

      const result = calculateDive(standingData, sections);

      // After swimming in 100m
      expect(result.sections[0].distanceFromExit).toBe(100);

      // After turnaround (no change)
      expect(result.sections[1].distanceFromExit).toBe(100);

      // After swimming back 50m
      expect(result.sections[2].distanceFromExit).toBe(50);

      // After recalculation (no change)
      expect(result.sections[3].distanceFromExit).toBe(50);

      // After swimming back 50m more - should be at exit (0m), not 100m!
      expect(result.sections[4].distanceFromExit).toBe(0);
    });
  });
});
