<script lang="ts">
  import {
    SECTION_TYPE_LABELS,
    STAGE_TANK_TYPES,
    generateId,
    type Section,
    type SectionType,
    type SectionResult,
    type StageState,
    type StageEntry,
  } from './types';

  let { sections = $bindable(), results, stages, usableBackGas }: {
    sections: Section[];
    results: SectionResult[];
    stages: StageEntry[];
    usableBackGas: number;
  } = $props();

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

  function clearAll() {
    sections = [];
  }

  function updateSection(id: string, field: keyof Section, value: string | number | boolean) {
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

  function stageLabel(entry: StageEntry): string {
    const tank = STAGE_TANK_TYPES.find(t => t.name === entry.tankType);
    return tank ? tank.label : entry.tankType;
  }

  function activeStages(states: StageState[]): StageState[] {
    return states.filter(s => !s.dropped);
  }

  function isSwim(type: SectionType): boolean {
    return type === 'swim';
  }

  function fixDistance(sectionIndex: number) {
    const section = sections[sectionIndex];
    if (section.type !== 'swim' || section.distance === 0) return;
    const result = results[sectionIndex];
    if (!result) return;
    const prevBackGasUsed = sectionIndex > 0 ? results[sectionIndex - 1]?.backGasUsedTotal ?? 0 : 0;
    const backGasUsedInSection = result.backGasUsedTotal - prevBackGasUsed;
    const availableBackGas = usableBackGas - prevBackGasUsed;
    if (availableBackGas <= 0) {
      updateSection(section.id, 'distance', 0);
      return;
    }
    if (backGasUsedInSection <= 0) return;
    const maxDist = Math.floor(section.distance * availableBackGas / backGasUsedInSection);
    updateSection(section.id, 'distance', maxDist);
  }

  function addReturnSections() {
    const reversed = [...sections].reverse().map((s): Section => ({
      id: generateId(),
      type: s.type,
      avgDepth: s.avgDepth,
      distance: s.distance,
      stageId: s.stageId,
      wayBack: true,
    }));
    sections = [...sections, ...reversed];
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
    <button onclick={() => addSection('stage-drop')}>+ Stage</button>
    {#if sections.length > 0}
      <button class="btn-clear" onclick={clearAll}>Clear All</button>
    {/if}
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
            <th class="col-wayback">Way Back</th>
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
              <td class="col-type" data-label="Type">
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
                {#if section.type === 'stage-drop'}
                  <select
                    class="stage-picker"
                    value={section.stageId ?? ''}
                    onchange={(e: Event) =>
                      updateSection(section.id, 'stageId', (e.currentTarget as HTMLSelectElement).value)}
                  >
                    <option value="" disabled>Select stage</option>
                    {#each stages as stage}
                      <option value={stage.id}>{stageLabel(stage)}</option>
                    {/each}
                  </select>
                {/if}
              </td>
              <td class="col-depth" data-label="Depth">
                {#if isSwim(section.type)}
                  <input
                    type="number"
                    value={section.avgDepth}
                    min="0"
                    step="1"
                    onchange={(e: Event) =>
                      updateSection(
                        section.id,
                        'avgDepth',
                        Number((e.currentTarget as HTMLInputElement).value)
                      )}
                  />
                  <span class="unit">m</span>
                {:else if result}
                  <span class="inherited">{formatNum(result.depth, 0)}m</span>
                {/if}
              </td>
              <td class="col-dist" data-label="Dist">
                {#if isSwim(section.type)}
                  <input
                    type="number"
                    value={section.distance}
                    min="0"
                    step="10"
                    onchange={(e: Event) =>
                      updateSection(
                        section.id,
                        'distance',
                        Number((e.currentTarget as HTMLInputElement).value)
                      )}
                  />
                  <span class="unit">m</span>
                {:else}
                  <span class="dim">&mdash;</span>
                {/if}
              </td>
              <td class="col-time" data-label="Time">
                {#if result && isSwim(section.type)}
                  {formatTime(result.time)}
                {:else if !isSwim(section.type)}
                  <span class="dim">&mdash;</span>
                {/if}
              </td>
              <td class="col-gas" data-label="Gas">
                {#if result}
                  {formatNum(result.gasConsumed, 0)} L
                {/if}
              </td>
              <td class="col-run-time" data-label="Run">
                {#if result}
                  {formatTime(result.runningTime)}
                {/if}
              </td>
              <td class="col-avg-depth" data-label="Avg">
                {#if result}
                  {formatNum(result.runningAvgDepth, 1)}m
                {/if}
              </td>
              <td class="col-backgas" data-label="Back Gas">
                {#if result}
                  {#if result.turnWarning}
                    <span class="over-turn">&#9888; {formatNum(result.remainingBackGasBar, 0)} bar</span>
                    <span class="sub over-turn">({formatNum(result.remainingBackGasLiters, 0)}L)</span>
                    {#if isSwim(section.type)}
                      <button class="btn-fix" onclick={() => fixDistance(i)}>Fix</button>
                    {/if}
                  {:else}
                    <span class:low-gas={result.remainingBackGasBar < 50}>
                      {formatNum(result.remainingBackGasBar, 0)} bar
                    </span>
                    <span class="sub">({formatNum(result.remainingBackGasLiters, 0)}L)</span>
                  {/if}
                {/if}
              </td>
              <td class="col-stages" data-label="Stages">
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
              <td class="col-notes" data-label="">
                {#if result?.turnWarning}
                  <span class="badge turn">TURN</span>
                {/if}
                <input
                  type="text"
                  class="note-input"
                  placeholder="Note"
                  value={section.note ?? ''}
                  onchange={(e: Event) =>
                    updateSection(section.id, 'note', (e.currentTarget as HTMLInputElement).value)}
                />
              </td>
              <td class="col-wayback">
                <label class="wayback-label">
                  <input
                    type="checkbox"
                    checked={section.wayBack ?? false}
                    onchange={(e: Event) =>
                      updateSection(section.id, 'wayBack', (e.currentTarget as HTMLInputElement).checked)}
                  />
                  <span class="wayback-text">Way back</span>
                </label>
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

    <button class="btn-return" onclick={addReturnSections}>
      Add the sections on the way back
    </button>
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
  .col-wayback { width: 5.5rem; text-align: center; }
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

  .stage-picker {
    margin-top: 0.2rem;
    font-size: 0.75rem;
  }

  .note-input {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    color: #ccc;
    padding: 0.15rem 0.3rem;
    font-size: 0.75rem;
    width: 100%;
    min-width: 4rem;
  }

  .note-input:hover {
    border-color: #333;
  }

  .note-input:focus {
    background: #16213e;
    border-color: #4fc3f7;
    outline: none;
    color: #e0e0e0;
  }

  .note-input::placeholder {
    color: #444;
  }

  .wayback-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .wayback-text {
    font-size: 0.72rem;
    color: #888;
  }

  .wayback-label:has(input:checked) .wayback-text {
    color: #4fc3f7;
  }

  .btn-clear {
    background: #16213e;
    border: 1px solid #444;
    color: #e57373;
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    margin-left: auto;
  }

  .btn-clear:hover {
    background: rgba(229, 115, 115, 0.1);
    border-color: #e57373;
  }

  .inherited {
    color: #888;
    font-style: italic;
    font-size: 0.78rem;
  }

  .sub {
    color: #777;
    font-size: 0.72rem;
    margin-left: 0.25rem;
  }

  .low-gas { color: #e57373; font-weight: 600; }

  .over-turn { color: #f44336; font-weight: 600; }

  .btn-fix {
    display: inline-block;
    background: rgba(244, 67, 54, 0.15);
    border: 1px solid #f44336;
    color: #ef5350;
    padding: 0.05rem 0.35rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.68rem;
    font-weight: 600;
    margin-left: 0.25rem;
    vertical-align: middle;
  }

  .btn-fix:hover {
    background: rgba(244, 67, 54, 0.3);
  }

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

  .unit {
    color: #777;
    font-size: 0.72rem;
    margin-left: 0.15rem;
  }

  .btn-return {
    display: block;
    margin: 1rem auto 0;
    background: #16213e;
    border: 1px solid #444;
    color: #4fc3f7;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-return:hover {
    background: #1a2744;
    border-color: #4fc3f7;
  }

  .empty-hint {
    color: #666;
    font-size: 0.85rem;
    text-align: center;
    padding: 2rem 0;
  }

  @media (max-width: 900px) {
    thead {
      display: none;
    }

    tbody tr {
      display: grid;
      grid-template-columns: auto 1fr 1fr auto;
      gap: 0 0.5rem;
      padding: 0.6rem 0.5rem;
      border-bottom: 1px solid #333;
      align-items: center;
    }

    /* Row 1: drag | Type ▾ | [remove] */
    td.col-drag {
      grid-row: 1;
      grid-column: 1;
      width: auto;
    }

    td.col-num {
      display: none;
    }

    td.col-type {
      grid-row: 1;
      grid-column: 2 / 4;
    }

    td.col-remove {
      grid-row: 1;
      grid-column: 4;
      width: auto;
      text-align: right;
    }

    /* Row 2: depth | dist (swim inputs) */
    td.col-depth,
    td.col-dist {
      grid-row: 2;
      width: auto;
    }

    td.col-depth {
      grid-column: 2;
    }

    td.col-dist {
      grid-column: 3;
    }

    /* Row 3: computed values as a flowing grid */
    td.col-time,
    td.col-gas,
    td.col-run-time,
    td.col-avg-depth {
      width: auto;
      min-width: 0;
    }

    td.col-time {
      grid-row: 3;
      grid-column: 1 / 3;
    }

    td.col-gas {
      grid-row: 3;
      grid-column: 3 / 5;
    }

    td.col-run-time {
      grid-row: 4;
      grid-column: 1 / 3;
    }

    td.col-avg-depth {
      grid-row: 4;
      grid-column: 3 / 5;
    }

    /* Row 5: back gas */
    td.col-backgas {
      grid-row: 5;
      grid-column: 1 / 5;
      width: auto;
    }

    /* Row 6: stages */
    td.col-stages {
      grid-row: 6;
      grid-column: 1 / 5;
      min-width: 0;
    }

    /* Row 7: notes */
    td.col-notes {
      grid-row: 7;
      grid-column: 1 / 5;
      min-width: 0;
    }

    /* Row 8: way back */
    td.col-wayback {
      grid-row: 8;
      grid-column: 1 / 5;
      width: auto;
      text-align: left;
    }

    /* Show data-label as inline prefix on mobile */
    td[data-label]::before {
      content: attr(data-label);
      color: #888;
      font-size: 0.7rem;
      text-transform: uppercase;
      margin-right: 0.4rem;
    }

    td[data-label=""]::before {
      display: none;
    }

    /* Hide dash placeholders on non-swim rows */
    td.col-dist .dim {
      display: none;
    }

    /* Adjust input widths for mobile */
    select,
    input[type='number'] {
      width: auto;
      min-width: 0;
    }

    td.col-type select {
      width: 100%;
    }

    input[type='number'] {
      width: 4rem;
    }
  }
</style>
