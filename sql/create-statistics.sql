-- Static snapshots. Safe to rerun: existing snapshots are NOT refreshed.
-- The source table and its records are never modified.
CREATE TABLE IF NOT EXISTS SurnameStatistics AS
WITH counts AS (
 SELECT SurnameRomaji, SurnameKanji, COUNT(*) AS Count
 FROM ImmigrantGroupShipPrefecture
 GROUP BY SurnameRomaji, SurnameKanji
)
SELECT SurnameRomaji, SurnameKanji, Count,
 RANK() OVER (ORDER BY Count DESC) AS Rank
FROM counts;

CREATE INDEX IF NOT EXISTS stats_surname_top
 ON SurnameStatistics (Count DESC, SurnameRomaji, SurnameKanji);
CREATE INDEX IF NOT EXISTS stats_surname_lookup
 ON SurnameStatistics (SurnameRomaji COLLATE NOCASE, Count DESC, SurnameRomaji, SurnameKanji);


CREATE TABLE IF NOT EXISTS NameStatistics AS
WITH counts AS (
 SELECT NameRomaji, NameKanji, COUNT(*) AS Count
 FROM ImmigrantGroupShipPrefecture
 GROUP BY NameRomaji, NameKanji
)
SELECT NameRomaji, NameKanji, Count,
 RANK() OVER (ORDER BY Count DESC) AS Rank
FROM counts;

CREATE INDEX IF NOT EXISTS stats_name_top
 ON NameStatistics (Count DESC, NameRomaji, NameKanji);
CREATE INDEX IF NOT EXISTS stats_name_lookup
 ON NameStatistics (NameRomaji COLLATE NOCASE, Count DESC, NameRomaji, NameKanji);

CREATE TABLE IF NOT EXISTS PrefectureStatistics AS
WITH counts AS (
 SELECT PrefectureName, COUNT(*) AS Count
 FROM ImmigrantGroupShipPrefecture GROUP BY PrefectureName
)
SELECT PrefectureName, Count,
 RANK() OVER (ORDER BY Count DESC) AS Rank
FROM counts;

CREATE INDEX IF NOT EXISTS stats_prefecture_top
 ON PrefectureStatistics (Count DESC, PrefectureName);
CREATE INDEX IF NOT EXISTS stats_prefecture_lookup
 ON PrefectureStatistics (PrefectureName COLLATE NOCASE, Count DESC, PrefectureName);
