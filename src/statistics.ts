import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { ValidationError } from './validation';

export interface SurnameRanking {
  Rank: number;
  SurnameRomaji: string;
  SurnameKanji: string | null;
  Count: number;
}
export interface NameRanking {
  Rank: number;
  NameRomaji: string;
  NameKanji: string | null;
  Count: number;
}
export interface PrefectureRanking {
  Rank: number;
  PrefectureName: string | null;
  Count: number;
}
// Counts and GLOBAL ranks are persisted by sql/create-statistics.sql.
// Request-time queries read only the small, indexed snapshot tables.
export class StatisticsRepository {
  constructor(private readonly db: D1Database) {}
  async topSurnames(): Promise<SurnameRanking[]> {
    const { results } = await this.db.prepare(`
      SELECT Rank, SurnameRomaji, SurnameKanji, Count FROM SurnameStatistics
      ORDER BY Count DESC, SurnameRomaji, SurnameKanji LIMIT 10`).bind().all<SurnameRanking>();
    return results;
  }
  async topNames(): Promise<NameRanking[]> {
    const { results } = await this.db.prepare(`
      SELECT Rank, NameRomaji, NameKanji, Count FROM NameStatistics
      ORDER BY Count DESC, NameRomaji, NameKanji LIMIT 10`).bind().all<NameRanking>();
    return results;
  }
  async topPrefectures(): Promise<PrefectureRanking[]> {
    const { results } = await this.db.prepare(`
      SELECT Rank, PrefectureName, Count FROM PrefectureStatistics
      ORDER BY Count DESC, PrefectureName LIMIT 10`).bind().all<PrefectureRanking>();
    return results;
  }
  async surname(value: string): Promise<SurnameRanking[]> {
    const { results } = await this.db.prepare(`
      SELECT Rank, SurnameRomaji, SurnameKanji, Count FROM SurnameStatistics
      WHERE SurnameRomaji = ? COLLATE NOCASE
      ORDER BY Count DESC, SurnameRomaji, SurnameKanji`).bind(value).all<SurnameRanking>();
    return results;
  }
  async name(value: string): Promise<NameRanking[]> {
    const { results } = await this.db.prepare(`
      SELECT Rank, NameRomaji, NameKanji, Count FROM NameStatistics
      WHERE NameRomaji = ? COLLATE NOCASE
      ORDER BY Count DESC, NameRomaji, NameKanji`).bind(value).all<NameRanking>();
    return results;
  }
  async prefecture(value: string): Promise<PrefectureRanking[]> {
    const { results } = await this.db.prepare(`
      SELECT Rank, PrefectureName, Count FROM PrefectureStatistics
      WHERE PrefectureName = ? COLLATE NOCASE
      ORDER BY Count DESC, PrefectureName`).bind(value).all<PrefectureRanking>();
    return results;
  }
}

const statistics = new Hono<{ Bindings: { ashiato_kai: D1Database } }>();
// This dataset changes rarely. Only successful GET responses are cached.
// Bump cacheName after a dataset import to avoid serving old rankings.
statistics.use('*', cache({
  cacheName: 'ashiato-statistics-v4',
  cacheControl: 'public, max-age=3600',
}));
statistics.get('/surnames/top', async c => {
  if ([...new URL(c.req.url).searchParams].length) throw new ValidationError('This endpoint accepts no query parameters');
  return c.json(await new StatisticsRepository(c.env.ashiato_kai).topSurnames());
});
statistics.get('/names/top', async c => {
  if ([...new URL(c.req.url).searchParams].length) throw new ValidationError('This endpoint accepts no query parameters');
  return c.json(await new StatisticsRepository(c.env.ashiato_kai).topNames());
});
statistics.get('/prefectures/top', async c => {
  if ([...new URL(c.req.url).searchParams].length) throw new ValidationError('This endpoint accepts no query parameters');
  return c.json(await new StatisticsRepository(c.env.ashiato_kai).topPrefectures());
});
statistics.get('/surnames', async c => {
  const params = new URL(c.req.url).searchParams;
  if ([...params.keys()].some(key => key !== 'SurnameRomaji') || params.getAll('SurnameRomaji').length !== 1)
    throw new ValidationError('Supply SurnameRomaji exactly once, with no other parameters');
  const surname = params.get('SurnameRomaji')!.trim();
  if (!surname || surname.length > 200) throw new ValidationError('SurnameRomaji must contain 1–200 characters');
  return c.json(await new StatisticsRepository(c.env.ashiato_kai).surname(surname));
});
statistics.get('/names', async c => {
  const params = new URL(c.req.url).searchParams;
  if ([...params.keys()].some(key => key !== 'NameRomaji') || params.getAll('NameRomaji').length !== 1)
    throw new ValidationError('Supply NameRomaji exactly once, with no other parameters');
  const name = params.get('NameRomaji')!.trim();
  if (!name || name.length > 200) throw new ValidationError('NameRomaji must contain 1–200 characters');
  return c.json(await new StatisticsRepository(c.env.ashiato_kai).name(name));
});
statistics.get('/prefectures', async c => {
  const params = new URL(c.req.url).searchParams;
  if ([...params.keys()].some(key => key !== 'PrefectureName') || params.getAll('PrefectureName').length !== 1)
    throw new ValidationError('Supply PrefectureName exactly once, with no other parameters');
  const prefecture = params.get('PrefectureName')!.trim();
  if (!prefecture || prefecture.length > 200) throw new ValidationError('PrefectureName must contain 1–200 characters');
  return c.json(await new StatisticsRepository(c.env.ashiato_kai).prefecture(prefecture));
});
export default statistics;
