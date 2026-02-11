import type { StandingData, Section } from './types';

const STANDING_DATA_KEY = 'cave-planner-standing-data';
const SECTIONS_KEY = 'cave-planner-sections';

export function loadStandingData(): StandingData | null {
  try {
    const raw = localStorage.getItem(STANDING_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StandingData;
  } catch {
    return null;
  }
}

export function saveStandingData(data: StandingData): void {
  localStorage.setItem(STANDING_DATA_KEY, JSON.stringify(data));
}

export function loadSections(): Section[] | null {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Section[];
  } catch {
    return null;
  }
}

export function saveSections(sections: Section[]): void {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
}
