<script lang="ts">
  import {
    BOTTOM_GAS_TYPES,
    STAGE_TANK_TYPES,
    generateId,
    type StandingData,
    type StageEntry,
  } from './types';

  let { data = $bindable() }: { data: StandingData } = $props();

  function addStage() {
    const entry: StageEntry = {
      id: generateId(),
      tankType: 'alu80',
      fillPressure: 210,
      reserveInBackGas: true,
    };
    data = { ...data, stages: [...data.stages, entry] };
  }

  function removeStage(id: string) {
    data = { ...data, stages: data.stages.filter((s) => s.id !== id) };
  }

  function updateStage(id: string, field: keyof StageEntry, value: string | number | boolean) {
    data = {
      ...data,
      stages: data.stages.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    };
  }
</script>

<div class="standing-data">
  <h2>Standing Data</h2>

  <div class="form-grid">
    <label>
      SCR (L/min/ATA)
      <input type="number" value={data.scr} min="0" step="1"
        onchange={(e: Event) => { data = { ...data, scr: Number((e.currentTarget as HTMLInputElement).value) }; }} />
    </label>

    <label>
      Swim Speed (m/min)
      <input type="number" value={data.swimSpeed} min="0" step="1"
        onchange={(e: Event) => { data = { ...data, swimSpeed: Number((e.currentTarget as HTMLInputElement).value) }; }} />
    </label>

    <label>
      Bottom Gas
      <select bind:value={data.bottomGasType}>
        {#each BOTTOM_GAS_TYPES as bt}
          <option value={bt.name}>{bt.label}</option>
        {/each}
      </select>
    </label>

    <label>
      Fill Pressure (bar)
      <input
        type="number"
        value={data.bottomGasFillPressure}
        min="0"
        step="10"
        onchange={(e: Event) => { data = { ...data, bottomGasFillPressure: Number((e.currentTarget as HTMLInputElement).value) }; }}
      />
    </label>

    <label>
      Conservatism (bar)
      <input
        type="number"
        value={data.conservatism ?? 0}
        min="0"
        step="1"
        onchange={(e: Event) => { data = { ...data, conservatism: Number((e.currentTarget as HTMLInputElement).value) }; }}
      />
    </label>

    <label>
      Stage Standing Time (min)
      <input
        type="number"
        value={data.stageStandingTime ?? 2}
        min="0"
        step="0.5"
        onchange={(e: Event) => { data = { ...data, stageStandingTime: Number((e.currentTarget as HTMLInputElement).value) }; }}
      />
    </label>
  </div>

  <div class="stages-section">
    <div class="stages-header">
      <h3>Stages</h3>
    </div>

    {#if data.stages.length > 0}
      <table class="stages-table">
        <thead>
          <tr>
            <th class="col-id"></th>
            <th>Tank</th>
            <th>Fill (bar)</th>
            <th>Reserve</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.stages as stage, i (stage.id)}
            <tr>
              <td class="stage-id">S{i + 1}</td>
              <td>
                <select
                  value={stage.tankType}
                  onchange={(e: Event) =>
                    updateStage(stage.id, 'tankType', (e.currentTarget as HTMLSelectElement).value)}
                >
                  {#each STAGE_TANK_TYPES as st}
                    <option value={st.name}>{st.label}</option>
                  {/each}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={stage.fillPressure}
                  min="0"
                  step="10"
                  onchange={(e: Event) =>
                    updateStage(
                      stage.id,
                      'fillPressure',
                      Number((e.currentTarget as HTMLInputElement).value)
                    )}
                />
              </td>
              <td class="center">
                <input
                  type="checkbox"
                  checked={stage.reserveInBackGas}
                  onchange={(e: Event) =>
                    updateStage(stage.id, 'reserveInBackGas', (e.currentTarget as HTMLInputElement).checked)}
                />
              </td>
              <td>
                <button
                  class="btn-remove"
                  onclick={() => removeStage(stage.id)}
                  title="Remove stage"
                >✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <button class="btn-add" onclick={addStage}>+ Add Stage</button>
  </div>
</div>

<style>
  .standing-data {
    background: #1a1a2e;
    border-radius: 8px;
    padding: 1.25rem;
  }

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #e0e0e0;
  }

  h3 {
    margin: 0;
    font-size: 0.95rem;
    color: #e0e0e0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: #aaa;
  }

  input[type='number'],
  select {
    background: #16213e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #e0e0e0;
    padding: 0.4rem 0.5rem;
    font-size: 1rem;
  }

  input[type='number']:focus,
  select:focus {
    outline: none;
    border-color: #4fc3f7;
  }

  .stages-section {
    margin-top: 1rem;
    border-top: 1px solid #333;
    padding-top: 1rem;
  }

  .stages-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stages-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.5rem;
  }

  .stages-table th {
    text-align: left;
    font-size: 0.75rem;
    color: #888;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid #333;
  }

  .stages-table td {
    padding: 0.3rem 0.5rem;
  }

  .stages-table td.center {
    text-align: center;
  }

  .col-id { width: 2.5rem; }

  .stage-id {
    color: #81d4fa;
    font-weight: 600;
    font-size: 0.8rem;
    text-align: center;
  }

  .stages-table input[type='checkbox'] {
    accent-color: #4fc3f7;
  }

  .stages-table select,
  .stages-table input {
    width: 100%;
  }

  .btn-remove {
    background: none;
    border: none;
    color: #e57373;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
  }

  .btn-remove:hover {
    background: rgba(229, 115, 115, 0.15);
  }

  .btn-add {
    background: #16213e;
    border: 1px dashed #555;
    color: #4fc3f7;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }

  .btn-add:hover {
    background: #1a2744;
    border-color: #4fc3f7;
  }
</style>
