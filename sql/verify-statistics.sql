SELECT 'SurnameStatistics' AS StatisticsTable, COUNT(*) AS Categories, SUM(Count) AS Immigrants FROM SurnameStatistics
UNION ALL
SELECT 'NameStatistics', COUNT(*), SUM(Count) FROM NameStatistics
UNION ALL
SELECT 'PrefectureStatistics', COUNT(*), SUM(Count) FROM PrefectureStatistics;
SELECT Rank, SurnameRomaji, SurnameKanji, Count FROM SurnameStatistics
WHERE SurnameRomaji = 'Ueda' COLLATE NOCASE ORDER BY Count DESC, SurnameRomaji, SurnameKanji;
SELECT Rank, NameRomaji, NameKanji, Count FROM NameStatistics
WHERE NameRomaji = 'Tadanobu' COLLATE NOCASE ORDER BY Count DESC, NameRomaji, NameKanji;
SELECT Rank, PrefectureName, Count FROM PrefectureStatistics
WHERE PrefectureName = 'Ehime' COLLATE NOCASE;
