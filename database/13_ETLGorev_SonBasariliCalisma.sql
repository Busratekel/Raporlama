-- ETL görevleri: son başarılı çalışma zamanı
-- BellonaRapor veritabanında çalıştırın.

USE BellonaRapor;
GO

IF COL_LENGTH('dbo.ETLGorevleri', 'SonBasariliCalisma') IS NULL
BEGIN
    ALTER TABLE dbo.ETLGorevleri
        ADD SonBasariliCalisma DATETIME NULL;
END
GO
