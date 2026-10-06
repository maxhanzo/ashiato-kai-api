CREATE INDEX IF NOT EXISTS api_name_surname_nocase ON ImmigrantGroupShipPrefecture (NameRomaji COLLATE NOCASE, SurnameRomaji COLLATE NOCASE, immigrantID);
CREATE INDEX IF NOT EXISTS GroupIndex ON ImmigrantGroupShipPrefecture (groupID);

CREATE INDEX IF NOT EXISTS api_name_kanji_nocase ON ImmigrantGroupShipPrefecture (NameKanji COLLATE NOCASE, immigrantID);
CREATE INDEX IF NOT EXISTS api_surname_kanji_nocase ON ImmigrantGroupShipPrefecture (SurnameKanji COLLATE NOCASE, immigrantID);
