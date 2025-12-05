-- Sadece Dimension ve Fact Tablolarını Oluştur
-- Not: Bu script mevcut veritabanında çalıştırılacak
-- CREATE DATABASE YOK!

USE [BoytasWH];
GO

PRINT 'Dimension ve Fact tabloları oluşturuluyor...';
PRINT '';
GO

-- =====================================================
-- 1. DIMENSION TABLOLARI
-- =====================================================

-- Dim_Tarih
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Dim_Tarih]') AND type in (N'U'))
BEGIN
    CREATE TABLE Dim_Tarih (
        TarihID INT PRIMARY KEY,
        Tarih DATE NOT NULL,
        Yil INT NOT NULL,
        Ay INT NOT NULL,
        Gun INT NOT NULL,
        AyAdi NVARCHAR(20) NOT NULL,
        Ceyrek INT NOT NULL,
        Hafta INT NOT NULL,
        HaftaninGunu INT NOT NULL,
        GunAdi NVARCHAR(20) NOT NULL,
        IsWeekday BIT NOT NULL,
        IsHoliday BIT DEFAULT 0,
        HolidayName NVARCHAR(100) NULL
    );
    PRINT '✓ Dim_Tarih tablosu oluşturuldu.';
END
ELSE
    PRINT '- Dim_Tarih tablosu zaten mevcut.';
GO

-- Dim_Departman
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Dim_Departman]') AND type in (N'U'))
BEGIN
    CREATE TABLE Dim_Departman (
        DepartmanKey INT PRIMARY KEY IDENTITY(1,1),
        DepartmanID INT NOT NULL,
        DepartmanAdi NVARCHAR(255),
        UstDepartmanID INT NULL,
        Aktif BIT DEFAULT 1,
        EklenmeTarihi DATETIME DEFAULT GETDATE(),
        GuncellenmeTarihi DATETIME DEFAULT GETDATE()
    );
    PRINT '✓ Dim_Departman tablosu oluşturuldu.';
END
ELSE
    PRINT '- Dim_Departman tablosu zaten mevcut.';
GO

-- Dim_Pozisyon
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Dim_Pozisyon]') AND type in (N'U'))
BEGIN
    CREATE TABLE Dim_Pozisyon (
        PozisyonKey INT PRIMARY KEY IDENTITY(1,1),
        PozisyonID INT NOT NULL,
        PozisyonAdi NVARCHAR(255),
        Seviye INT NULL,
        Aktif BIT DEFAULT 1,
        EklenmeTarihi DATETIME DEFAULT GETDATE(),
        GuncellenmeTarihi DATETIME DEFAULT GETDATE()
    );
    PRINT '✓ Dim_Pozisyon tablosu oluşturuldu.';
END
ELSE
    PRINT '- Dim_Pozisyon tablosu zaten mevcut.';
GO

-- Dim_Calisan
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Dim_Calisan]') AND type in (N'U'))
BEGIN
    CREATE TABLE Dim_Calisan (
        CalisanKey INT PRIMARY KEY IDENTITY(1,1),
        CalisanID INT NOT NULL,
        UserNo INT,
        Ad NVARCHAR(100),
        Soyad NVARCHAR(100),
        AdSoyad AS (Ad + ' ' + Soyad) PERSISTED,
        DepartmanKey INT,
        PozisyonKey INT,
        DogumTarihi DATE,
        IseGirisTarihi DATE,
        IstenCikisTarihi DATE NULL,
        Aktif BIT DEFAULT 1,
        EklenmeTarihi DATETIME DEFAULT GETDATE(),
        GuncellenmeTarihi DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (DepartmanKey) REFERENCES Dim_Departman(DepartmanKey),
        FOREIGN KEY (PozisyonKey) REFERENCES Dim_Pozisyon(PozisyonKey)
    );
    PRINT '✓ Dim_Calisan tablosu oluşturuldu.';
END
ELSE
    PRINT '- Dim_Calisan tablosu zaten mevcut.';
GO

-- =====================================================
-- 2. FACT TABLOLARI
-- =====================================================

-- Fact_CalisanOzet (İlk örnek Fact tablosu)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Fact_CalisanOzet]') AND type in (N'U'))
BEGIN
    CREATE TABLE Fact_CalisanOzet (
        CalisanOzetKey BIGINT PRIMARY KEY IDENTITY(1,1),
        TarihID INT NOT NULL,
        CalisanKey INT NOT NULL,
        DepartmanKey INT NOT NULL,
        PozisyonKey INT NOT NULL,
        
        -- Ölçümler (denormalize edilmiş)
        Maas DECIMAL(18,2),
        MaasKDVli DECIMAL(18,2),
        Prim DECIMAL(18,2) DEFAULT 0,
        ToplamUcret AS (Maas + Prim) PERSISTED,
        
        -- Denormalize edilmiş alanlar (JOIN yapmamak için)
        CalisanAdi NVARCHAR(100),
        CalisanSoyadi NVARCHAR(100),
        DepartmanAdi NVARCHAR(255),
        PozisyonAdi NVARCHAR(255),
        
        AktifMi BIT DEFAULT 1,
        EklenmeTarihi DATETIME DEFAULT GETDATE(),
        GuncellenmeTarihi DATETIME DEFAULT GETDATE(),
        
        FOREIGN KEY (TarihID) REFERENCES Dim_Tarih(TarihID),
        FOREIGN KEY (CalisanKey) REFERENCES Dim_Calisan(CalisanKey),
        FOREIGN KEY (DepartmanKey) REFERENCES Dim_Departman(DepartmanKey),
        FOREIGN KEY (PozisyonKey) REFERENCES Dim_Pozisyon(PozisyonKey)
    );
    PRINT '✓ Fact_CalisanOzet tablosu oluşturuldu.';
END
ELSE
    PRINT '- Fact_CalisanOzet tablosu zaten mevcut.';
GO

-- =====================================================
-- 3. INDEX'LER (Performans için)
-- =====================================================

PRINT '';
PRINT 'Index''ler oluşturuluyor...';
GO

-- Dim_Tarih Index'leri
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Tarih_Tarih' AND object_id = OBJECT_ID('Dim_Tarih'))
BEGIN
    CREATE INDEX IX_Dim_Tarih_Tarih ON Dim_Tarih(Tarih);
    PRINT '✓ IX_Dim_Tarih_Tarih';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Tarih_Yil_Ay' AND object_id = OBJECT_ID('Dim_Tarih'))
BEGIN
    CREATE INDEX IX_Dim_Tarih_Yil_Ay ON Dim_Tarih(Yil, Ay);
    PRINT '✓ IX_Dim_Tarih_Yil_Ay';
END

-- Dim_Departman Index'leri
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Departman_DepartmanID' AND object_id = OBJECT_ID('Dim_Departman'))
BEGIN
    CREATE INDEX IX_Dim_Departman_DepartmanID ON Dim_Departman(DepartmanID);
    PRINT '✓ IX_Dim_Departman_DepartmanID';
END

-- Dim_Pozisyon Index'leri
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Pozisyon_PozisyonID' AND object_id = OBJECT_ID('Dim_Pozisyon'))
BEGIN
    CREATE INDEX IX_Dim_Pozisyon_PozisyonID ON Dim_Pozisyon(PozisyonID);
    PRINT '✓ IX_Dim_Pozisyon_PozisyonID';
END

-- Dim_Calisan Index'leri
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Calisan_CalisanID' AND object_id = OBJECT_ID('Dim_Calisan'))
BEGIN
    CREATE INDEX IX_Dim_Calisan_CalisanID ON Dim_Calisan(CalisanID);
    PRINT '✓ IX_Dim_Calisan_CalisanID';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Calisan_DepartmanKey' AND object_id = OBJECT_ID('Dim_Calisan'))
BEGIN
    CREATE INDEX IX_Dim_Calisan_DepartmanKey ON Dim_Calisan(DepartmanKey);
    PRINT '✓ IX_Dim_Calisan_DepartmanKey';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Dim_Calisan_PozisyonKey' AND object_id = OBJECT_ID('Dim_Calisan'))
BEGIN
    CREATE INDEX IX_Dim_Calisan_PozisyonKey ON Dim_Calisan(PozisyonKey);
    PRINT '✓ IX_Dim_Calisan_PozisyonKey';
END

-- Fact_CalisanOzet Index'leri
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Fact_CalisanOzet_TarihID' AND object_id = OBJECT_ID('Fact_CalisanOzet'))
BEGIN
    CREATE INDEX IX_Fact_CalisanOzet_TarihID ON Fact_CalisanOzet(TarihID);
    PRINT '✓ IX_Fact_CalisanOzet_TarihID';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Fact_CalisanOzet_CalisanKey' AND object_id = OBJECT_ID('Fact_CalisanOzet'))
BEGIN
    CREATE INDEX IX_Fact_CalisanOzet_CalisanKey ON Fact_CalisanOzet(CalisanKey);
    PRINT '✓ IX_Fact_CalisanOzet_CalisanKey';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Fact_CalisanOzet_DepartmanKey' AND object_id = OBJECT_ID('Fact_CalisanOzet'))
BEGIN
    CREATE INDEX IX_Fact_CalisanOzet_DepartmanKey ON Fact_CalisanOzet(DepartmanKey);
    PRINT '✓ IX_Fact_CalisanOzet_DepartmanKey';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Fact_CalisanOzet_Tarih_Departman' AND object_id = OBJECT_ID('Fact_CalisanOzet'))
BEGIN
    CREATE INDEX IX_Fact_CalisanOzet_Tarih_Departman ON Fact_CalisanOzet(TarihID, DepartmanKey);
    PRINT '✓ IX_Fact_CalisanOzet_Tarih_Departman';
END
GO

-- =====================================================
-- 4. DIM_TARIH TABLOSUNU DOLDUR
-- =====================================================

PRINT '';
PRINT 'Dim_Tarih tablosu dolduruluyor...';
GO

DECLARE @StartDate DATE = '2020-01-01';
DECLARE @EndDate DATE = '2030-12-31';
DECLARE @CurrentDate DATE = @StartDate;
DECLARE @RowCount INT = 0;

IF NOT EXISTS (SELECT 1 FROM Dim_Tarih)
BEGIN
    WHILE @CurrentDate <= @EndDate
    BEGIN
        INSERT INTO Dim_Tarih (
            TarihID, Tarih, Yil, Ay, Gun, AyAdi, Ceyrek, Hafta, HaftaninGunu, GunAdi, IsWeekday
        )
        VALUES (
            CONVERT(INT, FORMAT(@CurrentDate, 'yyyyMMdd')),
            @CurrentDate,
            YEAR(@CurrentDate),
            MONTH(@CurrentDate),
            DAY(@CurrentDate),
            CASE MONTH(@CurrentDate)
                WHEN 1 THEN 'Ocak' WHEN 2 THEN 'Şubat' WHEN 3 THEN 'Mart'
                WHEN 4 THEN 'Nisan' WHEN 5 THEN 'Mayıs' WHEN 6 THEN 'Haziran'
                WHEN 7 THEN 'Temmuz' WHEN 8 THEN 'Ağustos' WHEN 9 THEN 'Eylül'
                WHEN 10 THEN 'Ekim' WHEN 11 THEN 'Kasım' WHEN 12 THEN 'Aralık'
            END,
            DATEPART(QUARTER, @CurrentDate),
            DATEPART(WEEK, @CurrentDate),
            DATEPART(WEEKDAY, @CurrentDate),
            CASE DATEPART(WEEKDAY, @CurrentDate)
                WHEN 1 THEN 'Pazar' WHEN 2 THEN 'Pazartesi' WHEN 3 THEN 'Salı'
                WHEN 4 THEN 'Çarşamba' WHEN 5 THEN 'Perşembe' WHEN 6 THEN 'Cuma'
                WHEN 7 THEN 'Cumartesi'
            END,
            CASE WHEN DATEPART(WEEKDAY, @CurrentDate) IN (1, 7) THEN 0 ELSE 1 END
        );
        
        SET @CurrentDate = DATEADD(DAY, 1, @CurrentDate);
        SET @RowCount = @RowCount + 1;
    END;
    
    PRINT '✓ Dim_Tarih tablosu dolduruldu: ' + CAST(@RowCount AS VARCHAR) + ' kayıt';
END
ELSE
BEGIN
    SELECT @RowCount = COUNT(*) FROM Dim_Tarih;
    PRINT '- Dim_Tarih tablosu zaten dolu: ' + CAST(@RowCount AS VARCHAR) + ' kayıt';
END
GO

-- =====================================================
-- ÖZET
-- =====================================================

PRINT '';
PRINT '==============================================';
PRINT 'Tablo kurulumu tamamlandı!';
PRINT '==============================================';
PRINT '';
PRINT 'Dimension Tabloları:';
PRINT '  ✓ Dim_Tarih';
PRINT '  ✓ Dim_Departman';
PRINT '  ✓ Dim_Pozisyon';
PRINT '  ✓ Dim_Calisan';
PRINT '';
PRINT 'Fact Tabloları:';
PRINT '  ✓ Fact_CalisanOzet';
PRINT '';
PRINT 'Sonraki adım: ETL Service''i çalıştır';
PRINT 'cd src/Raporlama.ETL';
PRINT 'dotnet run';
PRINT '';
GO

