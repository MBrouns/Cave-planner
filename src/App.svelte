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

  let standingData: StandingData = $state(loadStandingData() ?? {
    scr: 20,
    swimSpeed: 15,
    bottomGasType: '2x80',
    bottomGasFillPressure: 200,
    stages: [],
    reserveStageInBackGas: true,
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

  function formatNum(n: number, d: number = 0): string {
    return n.toFixed(d);
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
              <span class="summary-value warn">&minus;{formatNum(calculation.stageReservation, 0)} L</span>
            </div>
          {/if}
          <div class="summary-item">
            <span class="summary-label">Effective Back Gas</span>
            <span class="summary-value">{formatNum(calculation.effectiveBackGas, 0)} L</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Usable (1/3 rule)</span>
            <span class="summary-value highlight">{formatNum(calculation.usableBackGas, 0)} L</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Turn Pressure</span>
            <span class="summary-value highlight">
              {formatNum(
                calculation.bottomGasVolume > 0
                  ? (calculation.totalBackGas - calculation.usableBackGas) / calculation.bottomGasVolume
                  : 0,
                0
              )} bar
            </span>
          </div>
        </div>
      </div>
    </aside>

    <section class="main-content">
      <SectionList bind:sections={sections} {results} />
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
