export interface Immigrant {
  immigrantID: number;
  groupID: number;
  Destination: string | null;
  Year: number | null;
  Farm: string | null;
  ArrivalDate: string | null;
  DepartureDate: string | null;
  ShipName: string | null;
  PrefectureName: string | null;
  NameRomaji: string;
  SurnameRomaji: string;
  SurnameKanji: string | null;
  NameKanji: string | null;
}
export type Search = Partial<Pick<Immigrant,
  'NameRomaji' | 'SurnameRomaji' | 'NameKanji' | 'SurnameKanji' | 'Destination' | 'Year' | 'Farm' | 'ArrivalDate' | 'DepartureDate' | 'ShipName' | 'PrefectureName'>>;
export interface Repository {
  search(filters: Search): Promise<Immigrant[]>;
  group(id: number): Promise<Immigrant[]>;
}
