-- Dimension (Boyut) Tabloları
-- Bu tablolar referans verileri tutar

USE Raporlama_DW;
GO

-- Tarih Dimension (Her raporlama sisteminde olması gereken temel tablo)
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
GO

-- Departman Dimension (EBA'dan gelecek)
CREATE TABLE Dim_Departman (
    DepartmanKey INT PRIMARY KEY IDENTITY(1,1),
    DepartmanID INT NOT NULL,
    DepartmanAdi NVARCHAR(255),
    UstDepartmanID INT NULL,
    Aktif BIT DEFAULT 1,
    EklenmeTarihi DATETIME DEFAULT GETDATE(),
    GuncellenmeTarihi DATETIME DEFAULT GETDATE()
);
GO

-- Pozisyon Dimension (EBA'dan gelecek)
CREATE TABLE Dim_Pozisyon (
    PozisyonKey INT PRIMARY KEY IDENTITY(1,1),
    PozisyonID INT NOT NULL,
    PozisyonAdi NVARCHAR(255),
    Seviye INT NULL,
    Aktif BIT DEFAULT 1,
    EklenmeTarihi DATETIME DEFAULT GETDATE(),
    GuncellenmeTarihi DATETIME DEFAULT GETDATE()
);
GO

-- Çalışan Dimension (EBA'dan gelecek)
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
GO

-- Index'ler (Performans için)
CREATE INDEX IX_Dim_Tarih_Tarih ON Dim_Tarih(Tarih);
CREATE INDEX IX_Dim_Tarih_Yil_Ay ON Dim_Tarih(Yil, Ay);
CREATE INDEX IX_Dim_Departman_DepartmanID ON Dim_Departman(DepartmanID);
CREATE INDEX IX_Dim_Pozisyon_PozisyonID ON Dim_Pozisyon(PozisyonID);
CREATE INDEX IX_Dim_Calisan_CalisanID ON Dim_Calisan(CalisanID);
CREATE INDEX IX_Dim_Calisan_DepartmanKey ON Dim_Calisan(DepartmanKey);
CREATE INDEX IX_Dim_Calisan_PozisyonKey ON Dim_Calisan(PozisyonKey);
GO

PRINT 'Dimension tabloları başarıyla oluşturuldu.';
GO


