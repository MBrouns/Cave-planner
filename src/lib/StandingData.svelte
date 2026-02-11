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
      fillPressure: 200,
    };
    data = { ...data, stages: [...data.stages, entry] };
  }

  function removeStage(id: string) {
    data = { ...data, stages: data.stages.filter((s) => s.id !== id) };
  }

  function updateStage(id: string, field: keyof StageEntry, value: string | number) {
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
      <input type="number" bind:value={data.scr} min="0" step="1" />
    </label>

    <label>
      Swim Speed (m/min)
      <input type="number" bind:value={data.swimSpeed} min="0" step="1" />
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
        bind:value={data.bottomGasFillPressure}
        min="0"
        step="10"
      />
    </label>
  </div>

  <div class="stages-section">
    <div class="stages-header">
      <h3>Stages</h3>
      <label class="checkbox-label">
        <input
          type="checkbox"
          bind:checked={data.reserveStageInBackGas}
        />
        Reserve ½ stage gas in back gas
      </label>
    </div>

    {#if data.stages.length > 0}
      <table class="stages-table">
        <thead>
          <tr>
            <th>Tank</th>
            <th>Fill (bar)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.stages as stage (stage.id)}
            <tr>
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
                  oninput={(e: Event) =>
                    updateStage(
                      stage.id,
                      'fillPressure',
                      Number((e.currentTarget as HTMLInputElement).value)
                    )}
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
    font-size: 0.85rem;
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

  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #aaa;
    cursor: pointer;
  }

  .checkbox-label input[type='checkbox'] {
    accent-color: #4fc3f7;
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
