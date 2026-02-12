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

  function stageIndex(stageId: string): number {
    return stages.findIndex(s => s.id === stageId);
  }

  function stageTag(stageId: string): string {
    const idx = stageIndex(stageId);
    return idx >= 0 ? `S${idx + 1}` : '??';
  }

  function stageName(state: StageState): string {
    const tag = stageTag(state.id);
    const tank = STAGE_TANK_TYPES.find(t => t.name === state.tankType);
    return `${tag} ${tank ? tank.label : state.tankType}`;
  }

  function stageLabel(entry: StageEntry): string {
    const tag = stageTag(entry.id);
    const tank = STAGE_TANK_TYPES.find(t => t.name === entry.tankType);
    return `${tag} ${tank ? tank.label : entry.tankType}`;
  }

  function gasSourceLabel(result: SectionResult): string {
    const parts: string[] = [];
    for (const id of result.breathedStageIds) {
      parts.push(stageTag(id));
    }
    if (result.breathedBackGas) {
      parts.push('BG');
    }
    if (parts.length === 0) {
      const active = result.stageStates.find(s => !s.dropped);
      if (active) {
        parts.push(stageTag(active.id));
      } else {
        parts.push('BG');
      }
    }
    return parts.join(' → ');
  }

  function activeStages(states: StageState[]): StageState[] {
    return states.filter(s => !s.dropped);
  }

  function getBackGasUsed(sectionIndex: number): number {
    if (sectionIndex === 0) {
      const result = results[0];
      if (!result) return 0;
      return 0;
    }
    const prevResult = results[sectionIndex - 1];
    const currentResult = results[sectionIndex];
    if (!prevResult || !currentResult) return 0;
    return prevResult.remainingBackGasBar - currentResult.remainingBackGasBar;
  }

  function getStageGasUsed(sectionIndex: number, stageId: string): number {
    if (sectionIndex === 0) {
      const result = results[0];
      if (!result) return 0;
      const stageState = result.stageStates.find(s => s.id === stageId);
      if (!stageState) return 0;
      const stageEntry = stages.find(s => s.id === stageId);
      if (!stageEntry) return 0;
      return stageEntry.fillPressure - stageState.currentPressure;
    }
    const prevResult = results[sectionIndex - 1];
    const currentResult = results[sectionIndex];
    if (!prevResult || !currentResult) return 0;
    const prevStage = prevResult.stageStates.find(s => s.id === stageId);
    const currentStage = currentResult.stageStates.find(s => s.id === stageId);
    if (!prevStage || !currentStage) return 0;
    return prevStage.currentPressure - currentStage.currentPressure;
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

{#snippet addButtons()}
  <div class="add-buttons">
    <button onclick={() => addSection('swim')}>+ Swim</button>
    <button onclick={() => addSection('t-left')}>+ T Left</button>
    <button onclick={() => addSection('t-right')}>+ T Right</button>
    <button onclick={() => addSection('jump-left')}>+ Jump Left</button>
    <button onclick={() => addSection('jump-right')}>+ Jump Right</button>
    <button onclick={() => addSection('stage-drop')}>+ Stage Pick-up/Drop-off</button>
  </div>
{/snippet}

<div class="section-list">
  <h2>Dive Sections</h2>

  <div class="top-bar">
    {@render addButtons()}
    {#if sections.length > 0}
      <button class="btn-clear" onclick={clearAll}>Clear All</button>
    {/if}
  </div>

  {#if sections.length > 0}
    <div class="card-list">
      {#each sections as section, i (section.id)}
        {@const result = getResult(section.id)}
        {@const swim = section.type === 'swim'}
        {@const carried = result ? activeStages(result.stageStates) : []}
        <div
          class="section-card"
          class:drag-over={dragOverIndex === i && dragIndex !== i}
          class:warning-card={result?.turnWarning ?? false}
          class:wayback-card={section.wayBack ?? false}
          draggable="true"
          role="listitem"
          ondragstart={(e: DragEvent) => handleDragStart(e, i)}
          ondragover={(e: DragEvent) => handleDragOver(e, i)}
          ondrop={(e: DragEvent) => handleDrop(e, i)}
          ondragend={handleDragEnd}
        >
          <!-- Card header -->
          <div class="card-header">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <span class="row-num">{i + 1}</span>
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
            {#if result?.turnWarning}
              <span class="badge turn">TURN</span>
            {/if}
            <div class="header-spacer"></div>
            <label class="wayback-label">
              <input
                type="checkbox"
                checked={section.wayBack ?? false}
                onchange={(e: Event) =>
                  updateSection(section.id, 'wayBack', (e.currentTarget as HTMLInputElement).checked)}
              />
              <span class="wayback-text">Way back</span>
            </label>
            <button class="btn-remove" onclick={() => removeSection(section.id)} title="Remove section">✕</button>
          </div>

          <!-- Data fields -->
          <div class="card-data">
            {#if swim}
              <div class="field">
                <span class="field-label">Depth</span>
                <span class="field-value">
                  <input
                    type="number"
                    value={section.avgDepth}
                    min="0"
                    step="1"
                    onchange={(e: Event) =>
                      updateSection(section.id, 'avgDepth', Number((e.currentTarget as HTMLInputElement).value))}
                  /><span class="unit">m</span>
                </span>
              </div>
              <div class="field">
                <span class="field-label">Distance</span>
                <span class="field-value">
                  <input
                    type="number"
                    value={section.distance}
                    min="0"
                    step="10"
                    onchange={(e: Event) =>
                      updateSection(section.id, 'distance', Number((e.currentTarget as HTMLInputElement).value))}
                  /><span class="unit">m</span>
                </span>
              </div>
            {:else if result}
              <div class="field">
                <span class="field-label">Depth</span>
                <span class="field-value inherited">{formatNum(result.depth, 0)}m</span>
              </div>
            {/if}

            {#if result}
              {@const backGasUsed = getBackGasUsed(i)}
              {#if swim}
                <div class="field">
                  <span class="field-label">Time</span>
                  <span class="field-value">{formatTime(result.time)}</span>
                </div>
              {/if}
              <div class="field">
                <span class="field-label">Gas Used</span>
                <span class="field-value">{formatNum(result.gasConsumed, 0)} L</span>
              </div>
              <div class="field">
                <span class="field-label">Source</span>
                <span class="field-value source">{gasSourceLabel(result)}</span>
              </div>
              <div class="field">
                <span class="field-label">Run Time</span>
                <span class="field-value">{formatTime(result.runningTime)}</span>
              </div>
              <div class="field">
                <span class="field-label">Avg Depth</span>
                <span class="field-value">{formatNum(result.runningAvgDepth, 1)}m</span>
              </div>
              <div class="field">
                <span class="field-label">Back Gas</span>
                <span class="field-value" class:over-turn={result.turnWarning} class:low-gas={!result.turnWarning && result.remainingBackGasBar < 50}>
                  {#if result.turnWarning}&#9888; {/if}{formatNum(result.remainingBackGasBar, 0)} bar
                  {#if backGasUsed > 0}
                    <span class="gas-used">(-{formatNum(backGasUsed, 0)})</span>
                  {/if}
                  <span class="sub">({formatNum(result.remainingBackGasLiters, 0)}L)</span>
                  {#if result.turnWarning && swim}
                    <button class="btn-fix" onclick={() => fixDistance(i)}>Fix</button>
                  {/if}
                </span>
              </div>
              {#if carried.length > 0}
                <div class="field">
                  <span class="field-label">Stages</span>
                  <span class="field-value">
                    {#each carried as st}
                      {@const stageUsed = getStageGasUsed(i, st.id)}
                      <span class="stage-pill">
                        {stageName(st)}: {formatNum(st.currentPressure, 0)} bar
                        {#if stageUsed > 0}
                          <span class="gas-used">(-{formatNum(stageUsed, 0)})</span>
                        {/if}
                      </span>
                    {/each}
                  </span>
                </div>
              {/if}
            {/if}
          </div>

          <!-- Notes -->
          <div class="card-footer">
            <input
              type="text"
              class="note-input"
              placeholder="Add a note..."
              value={section.note ?? ''}
              onchange={(e: Event) =>
                updateSection(section.id, 'note', (e.currentTarget as HTMLInputElement).value)}
            />
          </div>
        </div>
      {/each}
    </div>

    {@render addButtons()}

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

  /* ── Top bar ── */
  .top-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .add-buttons {
    display: contents;
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

  /* ── Card list ── */
  .card-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .section-card {
    background: #12122a;
    border: 1px solid #2a2a4a;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    transition: border-color 0.15s, background 0.15s;
  }

  .section-card:hover {
    border-color: #3a3a5a;
  }

  .section-card.drag-over {
    border-top: 2px solid #4fc3f7;
  }

  .section-card.warning-card {
    border-color: rgba(255, 183, 77, 0.3);
    background: rgba(255, 183, 77, 0.04);
  }

  .section-card.wayback-card {
    border-left: 3px solid #3a3a5a;
  }

  .section-card.wayback-card.warning-card {
    border-color: rgba(255, 183, 77, 0.3);
    border-left: 3px solid rgba(255, 183, 77, 0.3);
  }

  /* ── Card header ── */
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }

  .drag-handle {
    cursor: grab;
    color: #555;
    font-size: 1rem;
    user-select: none;
    line-height: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .row-num {
    color: #666;
    font-size: 0.75rem;
    font-weight: 600;
    min-width: 1.2rem;
  }

  .card-header select {
    background: #16213e;
    border: 1px solid #333;
    border-radius: 3px;
    color: #e0e0e0;
    padding: 0.25rem 0.4rem;
    font-size: 1rem;
  }

  .card-header select:focus {
    outline: none;
    border-color: #4fc3f7;
  }

  .stage-picker {
    font-size: 1rem;
  }

  .header-spacer {
    flex: 1;
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

  .btn-remove {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
    line-height: 1;
  }

  .btn-remove:hover {
    background: rgba(229, 115, 115, 0.15);
    color: #e57373;
  }

  .badge {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .badge.turn {
    background: rgba(244, 67, 54, 0.2);
    color: #ef5350;
    border: 1px solid #f44336;
  }

  /* ── Card data ── */
  .card-data {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 1.25rem;
    padding: 0.35rem 0 0.25rem 1.7rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .field-label {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #777;
    line-height: 1;
  }

  .field-value {
    font-size: 0.85rem;
    color: #e0e0e0;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    line-height: 1.3;
  }

  .field-value.inherited {
    color: #888;
    font-style: italic;
    font-size: 0.8rem;
  }

  .field-value.source {
    color: #81d4fa;
    font-weight: 500;
  }

  .field-value input[type='number'] {
    background: #16213e;
    border: 1px solid #333;
    border-radius: 3px;
    color: #e0e0e0;
    padding: 0.2rem 0.3rem;
    font-size: 1rem;
    width: 4rem;
  }

  .field-value input[type='number']:focus {
    outline: none;
    border-color: #4fc3f7;
  }

  .unit {
    color: #777;
    font-size: 0.72rem;
  }

  .sub {
    color: #777;
    font-size: 0.72rem;
  }

  .gas-used {
    color: #888;
    font-size: 0.72rem;
    font-weight: 400;
  }

  .over-turn { color: #f44336; font-weight: 600; }
  .over-turn .sub { color: #f44336; }
  .over-turn .gas-used { color: #f44336; }

  .low-gas { color: #e57373; font-weight: 600; }
  .low-gas .sub { color: #e57373; }
  .low-gas .gas-used { color: #e57373; }

  .btn-fix {
    background: rgba(244, 67, 54, 0.15);
    border: 1px solid #f44336;
    color: #ef5350;
    padding: 0.05rem 0.35rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.65rem;
    font-weight: 600;
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
    font-size: 0.72rem;
    white-space: nowrap;
  }

  /* ── Card footer ── */
  .card-footer {
    padding: 0.15rem 0 0 1.7rem;
  }

  .note-input {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    color: #ccc;
    padding: 0.15rem 0.3rem;
    font-size: 1rem;
    width: 100%;
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

  /* ── Bottom actions ── */
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

  /* ── Mobile ── */
  @media (max-width: 900px) {
    .card-data {
      padding-left: 0;
      gap: 0.15rem 1rem;
    }

    .card-footer {
      padding-left: 0;
    }
  }
</style>
