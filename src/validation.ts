import type { Search } from './models';
export class ValidationError extends Error {}
const textKeys = ['NameRomaji', 'SurnameRomaji', 'NameKanji', 'SurnameKanji', 'Destination', 'Farm', 'ShipName', 'PrefectureName', 'ArrivalDate', 'DepartureDate'] as const;
export function parseSearch(params: URLSearchParams): Search {
  const allowed = new Set<string>([...textKeys, 'Year']);
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new ValidationError(`Unknown parameter: ${key}`);
    if (params.getAll(key).length !== 1) throw new ValidationError(`Repeated parameter: ${key}`);
  }
  const result: Record<string, string | number> = {};
  for (const key of textKeys) {
    const value = params.get(key)?.trim();
    if (value === undefined) continue;
    if (!value || value.length > 200) throw new ValidationError(`${key} must contain 1–200 characters`);
    if (key === 'ArrivalDate' || key === 'DepartureDate') {
      const date = new Date(value + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
        throw new ValidationError(`${key} must be a valid YYYY-MM-DD date`);
    }
    result[key] = value;
  }
  if (params.has('Year')) {
    const year = params.get('Year')!.trim();
    if (!/^\d{4}$/.test(year) || Number(year) < 1) throw new ValidationError('Year must be a four-digit year');
    result.Year = Number(year);
  }
  if (Object.keys(result).length === 0) throw new ValidationError('At least one search parameter is required');
  return result as Search;
}
export function parseGroupID(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
    throw new ValidationError('groupID must be a positive safe integer');
  return Number(value);
}
