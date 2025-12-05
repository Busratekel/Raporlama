-- Bekleyen Süreçler için Fact Tablosu
-- View_eBABekleyen VIEW'ından beslenir

USE [BoytasWH];
GO

-- Fact_BekleyenSurecler tablosu
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Fact_BekleyenSurecler]') AND type in (N'U'))
BEGIN
    CREATE TABLE Fact_BekleyenSurecler (
        BekleyenSurecKey BIGINT PRIMARY KEY IDENTITY(1,1),
        
        -- Tarih Boyutu
        TarihID INT NOT NULL,
        
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
        
        -- Organizasyon Bilgileri
        UserName NVARCHAR(255),
        MudurlukAdi NVARCHAR(255),
        DirektorlukAdi NVARCHAR(255),
        
        -- Metadata
        EklenmeTarihi DATETIME DEFAULT GETDATE(),
        GuncellenmeTarihi DATETIME DEFAULT GETDATE(),
        
        FOREIGN KEY (TarihID) REFERENCES Dim_Tarih(TarihID)
    );
    
    PRINT '✓ Fact_BekleyenSurecler tablosu oluşturuldu.';
    
    -- Index'ler
    CREATE INDEX IX_Fact_BekleyenSurecler_TarihID ON Fact_BekleyenSurecler(TarihID);
    CREATE INDEX IX_Fact_BekleyenSurecler_SurecNo ON Fact_BekleyenSurecler(SurecNo);
    CREATE INDEX IX_Fact_BekleyenSurecler_FormuBekletenBolum ON Fact_BekleyenSurecler(FormuBekletenBolum);
    CREATE INDEX IX_Fact_BekleyenSurecler_BekleyenGun ON Fact_BekleyenSurecler(BekleyenGun);
    CREATE INDEX IX_Fact_BekleyenSurecler_Mudurluk ON Fact_BekleyenSurecler(MudurlukAdi);
    
    PRINT '✓ Index''ler oluşturuldu.';
END
ELSE
    PRINT '- Fact_BekleyenSurecler tablosu zaten mevcut.';
GO

PRINT '';
PRINT 'Fact_BekleyenSurecler tablosu hazır!';
PRINT 'ETL Service bu tabloyu View_eBABekleyen VIEW''ından dolduracak.';
GO



