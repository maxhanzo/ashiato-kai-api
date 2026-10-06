import type { Repository, Search } from './models';
export class ImmigrantService {
  constructor(private readonly repository: Repository) {}
  search(filters: Search) { return this.repository.search(filters); }
  async group(id: number) {
    const rows = await this.repository.group(id);
    if (!rows.length) return null;
    const { groupID, Destination, Year, Farm, ArrivalDate, DepartureDate, ShipName, PrefectureName } = rows[0];
    const shared = { groupID, Destination, Year, Farm, ArrivalDate, DepartureDate, ShipName, PrefectureName };
    for (const row of rows) {
      for (const key of Object.keys(shared) as (keyof typeof shared)[]) {
        if (row[key] !== shared[key]) throw new Error('Inconsistent group attributes');
      }
    }
    return { ...shared, immigrants: rows.map(({ immigrantID, NameRomaji, SurnameRomaji, SurnameKanji, NameKanji }) =>
      ({ immigrantID, NameRomaji, SurnameRomaji, SurnameKanji, NameKanji })) };
  }
}
