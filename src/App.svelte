<script lang="ts">
  import StandingDataComponent from './lib/StandingData.svelte';
  import SectionList from './lib/SectionList.svelte';
  import { calculateDive } from './lib/gasCalculations';
  import {
    loadStandingData,
    saveStandingData,
    loadSections,
    saveSections,
  } from './lib/storage';
  import type { StandingData, Section, SectionResult, DiveCalculation } from './lib/types';
  import { generateId, STAGE_TANK_TYPES } from './lib/types';

  let standingData: StandingData = $state(loadStandingData() ?? {
    scr: 20,
    swimSpeed: 15,
    bottomGasType: '2x80',
    bottomGasFillPressure: 220,
    stages: [],
  });

  let sections: Section[] = $state(loadSections() ?? []);

  let calculation: DiveCalculation = $derived(calculateDive(standingData, sections));
  let results: SectionResult[] = $derived(calculation.sections);

  $effect(() => {
    saveStandingData(standingData);
  });

  $effect(() => {
    saveSections(sections);
  });

  // Auto-insert stage-drop sections when the calculation detects a stage
  // reaching drop pressure without an explicit stage-drop section.
  // Processes one insert per cycle; the reactive loop handles the rest.
  $effect(() => {
    const inserts = calculation.pendingDropInserts;
    if (inserts.length === 0) return;

    const insert = inserts[0];
    const updated = [...sections];
    const idx = updated.findIndex((s) => s.id === insert.afterSectionId);
    if (idx === -1) return;

    const target = updated[idx];
    const dropSection: Section = {
      id: generateId(),
      type: 'stage-drop',
      avgDepth: 0,
      distance: 0,
      stageId: insert.stageId,
    };

    if (
      insert.splitAtDistance !== undefined &&
      insert.splitAtDistance > 0 &&
      insert.splitAtDistance < target.distance &&
      target.type === 'swim'
    ) {
      // Split the swim: shorten original, insert drop + remainder
      const remainder: Section = {
        id: generateId(),
        type: 'swim',
        avgDepth: target.avgDepth,
        distance: target.distance - insert.splitAtDistance,
        wayBack: target.wayBack,
      };
      updated[idx] = { ...target, distance: insert.splitAtDistance };
      updated.splice(idx + 1, 0, dropSection, remainder);
    } else {
      updated.splice(idx + 1, 0, dropSection);
    }

    sections = updated;
  });

  function formatNum(n: number, d: number = 0): string {
    return n.toFixed(d);
  }

  function ceilTo10(n: number): number {
    return Math.ceil(n / 10) * 10;
  }

  function floorTo10(n: number): number {
    return Math.floor(n / 10) * 10;
  }

  function stageLabel(tankType: string): string {
    return STAGE_TANK_TYPES.find(t => t.name === tankType)?.label ?? tankType;
  }
</script>

<main>
  <header>
    <h1>Cave Dive Planner</h1>
  </header>

  <div class="layout">
    <aside>
      <StandingDataComponent bind:data={standingData} />

      <div class="summary-card">
        <h2>Gas Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">Total Back Gas</span>
            <span class="summary-value">{formatNum(calculation.totalBackGas, 0)} L</span>
          </div>
          {#if calculation.stageReservation > 0}
            <div class="summary-item">
              <span class="summary-label">Stage Reservation</span>
              <span class="summary-value warn">&minus;{formatNum(calculation.stageReservation, 0)} L / {formatNum(calculation.bottomGasVolume > 0 ? ceilTo10(calculation.stageReservation / calculation.bottomGasVolume) : 0, 0)} bar</span>
            </div>
          {/if}
          <div class="summary-item">
            <span class="summary-label">Effective Back Gas</span>
            <span class="summary-value">{formatNum(calculation.effectiveBackGas, 0)} L / {formatNum(calculation.bottomGasVolume > 0 ? calculation.effectiveBackGas / calculation.bottomGasVolume : 0, 0)} bar</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Usable (1/3 rule)</span>
            <span class="summary-value highlight">{formatNum(calculation.usableBackGas, 0)} L / {formatNum(calculation.bottomGasVolume > 0 ? floorTo10(calculation.usableBackGas / calculation.bottomGasVolume) : 0, 0)} bar</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Turn Pressure</span>
            <span class="summary-value highlight">
              {formatNum(
                ceilTo10(calculation.bottomGasVolume > 0
                  ? (calculation.totalBackGas - calculation.usableBackGas) / calculation.bottomGasVolume
                  : 0),
                0
              )} bar
            </span>
          </div>
          {#each standingData.stages as stage}
            <div class="summary-item">
              <span class="summary-label">{stageLabel(stage.tankType)} drop</span>
              <span class="summary-value">{formatNum(ceilTo10(stage.fillPressure / 2 + 15), 0)} bar</span>
            </div>
          {/each}
        </div>
      </div>
    </aside>

    <section class="main-content">
      <SectionList bind:sections={sections} {results} stages={standingData.stages} usableBackGas={calculation.usableBackGasRounded} />
    </section>
  </div>
</main>

<style>
  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }

  header {
    margin-bottom: 1rem;
  }

  h1 {
    font-size: 1.4rem;
    font-weight: 600;
    color: #4fc3f7;
    margin: 0;
  }

  .layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 1rem;
    align-items: start;
  }

  aside {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: sticky;
    top: 1rem;
  }

  .main-content {
    min-width: 0;
  }

  .summary-card {
    background: #1a1a2e;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .summary-card h2 {
    margin: 0 0 0.75rem 0;
    font-size: 1.1rem;
    color: #e0e0e0;
  }

  .summary-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-label {
    font-size: 0.8rem;
    color: #aaa;
  }

  .summary-value {
    font-size: 0.85rem;
    font-weight: 500;
    color: #e0e0e0;
  }

  .summary-value.warn {
    color: #ffb74d;
  }

  .summary-value.highlight {
    color: #4fc3f7;
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    aside {
      position: static;
    }
  }
</style>
