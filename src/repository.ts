import type { Immigrant, Repository, Search } from './models';
const table = 'ImmigrantGroupShipPrefecture';
const columns = 'immigrantID, groupID, Destination, Year, Farm, ArrivalDate, DepartureDate, ShipName, PrefectureName, NameRomaji, SurnameRomaji, SurnameKanji, NameKanji';
const allowed = ['NameRomaji', 'SurnameRomaji', 'NameKanji', 'SurnameKanji', 'Destination', 'Year', 'Farm', 'ArrivalDate', 'DepartureDate', 'ShipName', 'PrefectureName'] as const;
export class D1Repository implements Repository {
  constructor(private readonly db: D1Database) {}
  async search(filters: Search): Promise<Immigrant[]> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    for (const key of allowed) {
      const value = filters[key];
      if (value === undefined || value === null) continue;
      conditions.push(`${key} = ?${typeof value === 'string' ? ' COLLATE NOCASE' : ''}`);
      values.push(value);
    }
    const result = await this.db.prepare(`SELECT ${columns} FROM ${table} WHERE ${conditions.join(' AND ')} ORDER BY immigrantID`).bind(...values).all<Immigrant>();
    return result.results;
  }
  async group(id: number): Promise<Immigrant[]> {
    const result = await this.db.prepare(`SELECT ${columns} FROM ${table} WHERE groupID = ? ORDER BY immigrantID`).bind(id).all<Immigrant>();
    return result.results;
  }
}
