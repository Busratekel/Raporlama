-- BellonaRapor - Basit Kurulum
-- Sadece ihtiyacımız olanlar!

USE [BellonaRapor];
GO

PRINT 'BellonaRapor - Fact Tablosu Oluşturuluyor...';
PRINT '';
GO

-- =====================================================
-- FACT TABLOSU: Bekleyen Süreçler
-- View_eBABekleyen VIEW'ından beslenecek
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Fact_BekleyenSurecler]') AND type in (N'U'))
BEGIN
    CREATE TABLE Fact_BekleyenSurecler (
        ID BIGINT PRIMARY KEY IDENTITY(1,1),
        
        -- Süreç Bilgileri
        SurecNo NVARCHAR(50),
        FormAdi NVARCHAR(255),
        
        -- Formu Dolduran
        FormuDolduranSicil NVARCHAR(50),
        FormuDolduran NVARCHAR(255),
        FormuGonderenBolum NVARCHAR(255),
        
        -- Formu Bekleten
        FormuBekletenSicil NVARCHAR(50),
        FormuBekleten NVARCHAR(255),
        FormuBekletenBolum NVARCHAR(255),
        
        -- Tarihler
        SurecBaslangicTarihi DATETIME,
        SurecBekleteneGelisTarihi DATETIME,
        
        -- Ölçümler
        BekleyenGun INT,
        
        -- Organizasyon
        UserName NVARCHAR(255),
        MudurlukAdi NVARCHAR(255),
        DirektorlukAdi NVARCHAR(255),
        
        -- Metadata
        EklenmeTarihi DATETIME DEFAULT GETDATE(),
        GuncellenmeTarihi DATETIME DEFAULT GETDATE()
    );
    
    PRINT '✓ Fact_BekleyenSurecler tablosu oluşturuldu.';
    
    -- Index'ler (Performans için)
    CREATE INDEX IX_Fact_BekleyenSurecler_SurecNo ON Fact_BekleyenSurecler(SurecNo);
    CREATE INDEX IX_Fact_BekleyenSurecler_FormuBekletenBolum ON Fact_BekleyenSurecler(FormuBekletenBolum);
    CREATE INDEX IX_Fact_BekleyenSurecler_BekleyenGun ON Fact_BekleyenSurecler(BekleyenGun);
    CREATE INDEX IX_Fact_BekleyenSurecler_Mudurluk ON Fact_BekleyenSurecler(MudurlukAdi);
    CREATE INDEX IX_Fact_BekleyenSurecler_EklenmeTarihi ON Fact_BekleyenSurecler(EklenmeTarihi);
    
    PRINT '✓ Index''ler oluşturuldu.';
END
ELSE
    PRINT '- Fact_BekleyenSurecler tablosu zaten mevcut.';
GO

PRINT '';
PRINT '==============================================';
PRINT 'Kurulum tamamlandı!';
PRINT '==============================================';
PRINT '';
PRINT 'Oluşturulan:';
PRINT '  ✓ Fact_BekleyenSurecler';
PRINT '';
PRINT 'Mevcut (kullanılacak):';
PRINT '  ✓ View_eBABekleyen';
PRINT '';
PRINT 'Sonraki adım: ETL Service''i çalıştır';
PRINT 'cd src/Raporlama.ETL';
PRINT 'dotnet run';
PRINT '';
GO



