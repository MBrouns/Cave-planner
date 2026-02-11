<script lang="ts">
  import {
    SECTION_TYPE_LABELS,
    STAGE_TANK_TYPES,
    generateId,
    type Section,
    type SectionType,
    type SectionResult,
    type StageState,
  } from './types';

  let { sections = $bindable(), results }: { sections: Section[]; results: SectionResult[] } = $props();

  let dragIndex: number | null = $state(null);
  let dragOverIndex: number | null = $state(null);

  function addSection(type: SectionType) {
    const section: Section = {
      id: generateId(),
      type,
      avgDepth: type === 'swim' ? 20 : 0,
      distance: type === 'swim' ? 100 : 0,
    };
    sections = [...sections, section];
  }

  function removeSection(id: string) {
    sections = sections.filter((s) => s.id !== id);
  }

  function updateSection(id: string, field: keyof Section, value: string | number) {
    sections = sections.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
  }

  function handleDragStart(e: DragEvent, index: number) {
    dragIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      dragIndex = null;
      dragOverIndex = null;
      return;
    }

    const updated = [...sections];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    sections = updated;

    dragIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }

  function getResult(sectionId: string): SectionResult | undefined {
    return results.find((r) => r.sectionId === sectionId);
  }

  function formatNum(n: number, decimals: number = 0): string {
    return n.toFixed(decimals);
  }

  function formatTime(minutes: number): string {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function stageName(state: StageState): string {
    const tank = STAGE_TANK_TYPES.find(t => t.name === state.tankType);
    return tank ? tank.label : state.tankType;
  }

  function activeStages(states: StageState[]): StageState[] {
    return states.filter(s => !s.dropped);
  }

  function isSwim(type: SectionType): boolean {
    return type === 'swim';
  }

  const sectionTypeEntries = Object.entries(SECTION_TYPE_LABELS) as [SectionType, string][];
</script>

<div class="section-list">
  <h2>Dive Sections</h2>

  <div class="add-buttons">
    <button onclick={() => addSection('swim')}>+ Swim</button>
    <button onclick={() => addSection('t-left')}>+ T Left</button>
    <button onclick={() => addSection('t-right')}>+ T Right</button>
    <button onclick={() => addSection('jump-left')}>+ Jump Left</button>
    <button onclick={() => addSection('jump-right')}>+ Jump Right</button>
  </div>

  {#if sections.length > 0}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="col-drag"></th>
            <th class="col-num">#</th>
            <th class="col-type">Type</th>
            <th class="col-depth">Depth (m)</th>
            <th class="col-dist">Dist (m)</th>
            <th class="col-time">Time</th>
            <th class="col-gas">Gas Used (L)</th>
            <th class="col-run-time">Run Time</th>
            <th class="col-avg-depth">Avg Depth</th>
            <th class="col-backgas">Back Gas</th>
            <th class="col-stages">Stages</th>
            <th class="col-notes">Notes</th>
            <th class="col-remove"></th>
          </tr>
        </thead>
        <tbody>
          {#each sections as section, i (section.id)}
            {@const result = getResult(section.id)}
            <tr
              class:drag-over={dragOverIndex === i && dragIndex !== i}
              class:warning-row={result?.turnWarning ?? false}
              draggable="true"
              ondragstart={(e: DragEvent) => handleDragStart(e, i)}
              ondragover={(e: DragEvent) => handleDragOver(e, i)}
              ondrop={(e: DragEvent) => handleDrop(e, i)}
              ondragend={handleDragEnd}
            >
              <td class="col-drag drag-handle" title="Drag to reorder">⠿</td>
              <td class="col-num">{i + 1}</td>
              <td class="col-type">
                <select
                  value={section.type}
                  onchange={(e: Event) => {
                    const newType = (e.currentTarget as HTMLSelectElement).value as SectionType;
                    updateSection(section.id, 'type', newType);
                    if (newType !== 'swim') {
                      updateSection(section.id, 'avgDepth', 0);
                      updateSection(section.id, 'distance', 0);
                    }
                  }}
                >
                  {#each sectionTypeEntries as [val, label]}
                    <option value={val}>{label}</option>
                  {/each}
                </select>
              </td>
              <td class="col-depth">
                {#if isSwim(section.type)}
                  <input
                    type="number"
                    value={section.avgDepth}
                    min="0"
                    step="1"
                    oninput={(e: Event) =>
                      updateSection(
                        section.id,
                        'avgDepth',
                        Number((e.currentTarget as HTMLInputElement).value)
                      )}
                  />
                {:else}
                  <span class="dim">&mdash;</span>
                {/if}
              </td>
              <td class="col-dist">
                {#if isSwim(section.type)}
                  <input
                    type="number"
                    value={section.distance}
                    min="0"
                    step="10"
                    oninput={(e: Event) =>
                      updateSection(
                        section.id,
                        'distance',
                        Number((e.currentTarget as HTMLInputElement).value)
                      )}
                  />
                {:else}
                  <span class="dim">&mdash;</span>
                {/if}
              </td>
              <td class="col-time">
                {#if result}
                  {formatTime(result.time)}
                {/if}
              </td>
              <td class="col-gas">
                {#if result}
                  {formatNum(result.gasConsumed, 0)}
                {/if}
              </td>
              <td class="col-run-time">
                {#if result}
                  {formatTime(result.runningTime)}
                {/if}
              </td>
              <td class="col-avg-depth">
                {#if result}
                  {formatNum(result.runningAvgDepth, 1)}m
                {/if}
              </td>
              <td class="col-backgas">
                {#if result}
                  <span class:low-gas={result.remainingBackGasBar < 50}>
                    {formatNum(result.remainingBackGasBar, 0)} bar
                  </span>
                  <span class="sub">({formatNum(result.remainingBackGasLiters, 0)}L)</span>
                {/if}
              </td>
              <td class="col-stages">
                {#if result}
                  {#each activeStages(result.stageStates) as st}
                    <span class="stage-pill">
                      {stageName(st)}: {formatNum(st.currentPressure, 0)} bar
                    </span>
                  {/each}
                  {#if activeStages(result.stageStates).length === 0}
                    <span class="dim">none</span>
                  {/if}
                {/if}
              </td>
              <td class="col-notes">
                {#if result}
                  {#each result.stageDroppedIds as droppedId}
                    {@const dropped = result.stageStates.find(s => s.id === droppedId)}
                    {#if dropped}
                      <span class="badge drop">DROP {stageName(dropped)}</span>
                    {/if}
                  {/each}
                  {#if result.turnWarning}
                    <span class="badge turn">TURN</span>
                  {/if}
                {/if}
              </td>
              <td class="col-remove">
                <button
                  class="btn-remove"
                  onclick={() => removeSection(section.id)}
                  title="Remove section"
                >✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty-hint">Add sections to start planning your dive.</p>
  {/if}
</div>

<style>
  .section-list {
    background: #1a1a2e;
    border-radius: 8px;
    padding: 1.25rem;
  }

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #e0e0e0;
  }

  .add-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .add-buttons button {
    background: #16213e;
    border: 1px solid #444;
    color: #4fc3f7;
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .add-buttons button:hover {
    background: #1a2744;
    border-color: #4fc3f7;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  thead th {
    text-align: left;
    color: #888;
    font-weight: 500;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #333;
    white-space: nowrap;
  }

  tbody tr {
    border-bottom: 1px solid #222;
    transition: background 0.15s;
  }

  tbody tr:hover {
    background: rgba(79, 195, 247, 0.04);
  }

  tbody tr.drag-over {
    border-top: 2px solid #4fc3f7;
  }

  tbody tr.warning-row {
    background: rgba(255, 183, 77, 0.08);
  }

  td {
    padding: 0.4rem 0.5rem;
    color: #e0e0e0;
    vertical-align: middle;
  }

  .drag-handle {
    cursor: grab;
    color: #555;
    font-size: 1rem;
    user-select: none;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  select,
  input[type='number'] {
    background: #16213e;
    border: 1px solid #333;
    border-radius: 3px;
    color: #e0e0e0;
    padding: 0.25rem 0.35rem;
    font-size: 0.8rem;
    width: 100%;
  }

  select:focus,
  input:focus {
    outline: none;
    border-color: #4fc3f7;
  }

  .col-drag { width: 2rem; text-align: center; }
  .col-num { width: 2rem; text-align: center; color: #666; }
  .col-type { min-width: 6rem; }
  .col-depth { width: 5rem; }
  .col-dist { width: 5rem; }
  .col-time { width: 4.5rem; }
  .col-gas { width: 5rem; }
  .col-run-time { width: 5rem; }
  .col-avg-depth { width: 5rem; }
  .col-backgas { width: 7rem; }
  .col-stages { min-width: 8rem; }
  .col-notes { min-width: 7rem; }
  .col-remove { width: 2rem; }

  input[type='number'] {
    width: 4rem;
  }

  .dim { color: #555; }

  .sub {
    color: #777;
    font-size: 0.72rem;
    margin-left: 0.25rem;
  }

  .low-gas { color: #e57373; font-weight: 600; }

  .stage-pill {
    display: inline-block;
    background: #16213e;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    margin: 0.1rem;
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .badge {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 600;
    margin: 0.1rem;
    white-space: nowrap;
  }

  .badge.drop {
    background: rgba(255, 152, 0, 0.2);
    color: #ffb74d;
    border: 1px solid #ff9800;
  }

  .badge.turn {
    background: rgba(244, 67, 54, 0.2);
    color: #ef5350;
    border: 1px solid #f44336;
  }

  .btn-remove {
    background: none;
    border: none;
    color: #e57373;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
  }

  .btn-remove:hover {
    background: rgba(229, 115, 115, 0.15);
  }

  .empty-hint {
    color: #666;
    font-size: 0.85rem;
    text-align: center;
    padding: 2rem 0;
  }
</style>
