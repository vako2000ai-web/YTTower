export type RunCategory = 'standard' | 'supported';
export const CATEGORY_NAMES: Record<RunCategory, string> = {
  standard: 'Обычный забег', supported: 'С поддержкой зрителей',
};

export function recordKey(config: object, category: RunCategory) {
  const entries = Object.entries(config).sort(([a], [b]) => a.localeCompare(b));
  return `yttower.record.v2:${JSON.stringify(entries)}:${category}`;
}

export function loadJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}

export function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Game remains usable without browser storage. */ }
}

export function readRecord(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : Infinity;
}
