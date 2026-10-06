DROP TABLE IF EXISTS SurnameStatistics;

CREATE TABLE SurnameStatistics AS
WITH counts AS (
    SELECT SurnameRomaji, SurnameKanji, COUNT(*) AS Count
    FROM ImmigrantGroupShipPrefecture
    GROUP BY SurnameRomaji, SurnameKanji
)
SELECT
    SurnameRomaji,
    SurnameKanji,
    Count,
    RANK() OVER (ORDER BY Count DESC) AS Rank
FROM counts;

CREATE INDEX stats_surname_top
    ON SurnameStatistics (
        Count DESC,
        SurnameRomaji,
        SurnameKanji
    );

CREATE INDEX stats_surname_lookup
    ON SurnameStatistics (
        SurnameRomaji COLLATE NOCASE,
        Count DESC,
        SurnameRomaji,
        SurnameKanji
    );
