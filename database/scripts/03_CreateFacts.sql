-- Fact (Olay) Tabloları
-- Bu tablolar ölçümleri ve metrikleri tutar
-- JOIN'ler önceden yapılmış, raporlama sırasında sadece SELECT

USE Raporlama_DW;
GO

-- Çalışan Özet Fact (Örnek - Patrondan rapor gelince gerçek Fact'ler eklenecek)
-- Bu tablo çalışan bilgilerini önceden join'lenmiş halde tutar
CREATE TABLE Fact_CalisanOzet (
    CalisanOzetKey BIGINT PRIMARY KEY IDENTITY(1,1),
    
    -- Dimension Keys (Foreign Keys)
    TarihID INT NOT NULL,
    CalisanKey INT NOT NULL,
    DepartmanKey INT NOT NULL,
    PozisyonKey INT NOT NULL,
    
    -- Ölçümler (Metrics) - Önceden hesaplanmış
    Maas DECIMAL(18,2),
    MaasKDVli DECIMAL(18,2),
    Prim DECIMAL(18,2) DEFAULT 0,
    ToplamUcret AS (Maas + Prim) PERSISTED,
    
    -- Denormalize edilmiş alanlar (JOIN yapmamak için)
    CalisanAdi NVARCHAR(100),
    CalisanSoyadi NVARCHAR(100),
    DepartmanAdi NVARCHAR(255),
    PozisyonAdi NVARCHAR(255),
    
    -- Durum bilgileri
    AktifMi BIT DEFAULT 1,
    
    -- Metadata
    EklenmeTarihi DATETIME DEFAULT GETDATE(),
    GuncellenmeTarihi DATETIME DEFAULT GETDATE(),
    
    -- Foreign Keys
    FOREIGN KEY (TarihID) REFERENCES Dim_Tarih(TarihID),
    FOREIGN KEY (CalisanKey) REFERENCES Dim_Calisan(CalisanKey),
    FOREIGN KEY (DepartmanKey) REFERENCES Dim_Departman(DepartmanKey),
    FOREIGN KEY (PozisyonKey) REFERENCES Dim_Pozisyon(PozisyonKey)
);
GO

-- Performans için Index'ler
CREATE INDEX IX_Fact_CalisanOzet_TarihID ON Fact_CalisanOzet(TarihID);
CREATE INDEX IX_Fact_CalisanOzet_CalisanKey ON Fact_CalisanOzet(CalisanKey);
CREATE INDEX IX_Fact_CalisanOzet_DepartmanKey ON Fact_CalisanOzet(DepartmanKey);
CREATE INDEX IX_Fact_CalisanOzet_PozisyonKey ON Fact_CalisanOzet(PozisyonKey);
CREATE INDEX IX_Fact_CalisanOzet_Tarih_Departman ON Fact_CalisanOzet(TarihID, DepartmanKey);
GO

-- İleride eklenecek Fact tabloları için template
-- Patrondan rapor gelince bu template'i kullanarak yeni Fact tabloları oluşturulacak

/*
CREATE TABLE Fact_[RaporAdi] (
    [RaporAdi]Key BIGINT PRIMARY KEY IDENTITY(1,1),
    
    -- Dimension Keys
    TarihID INT NOT NULL,
    -- Diğer dimension key'ler...
    
    -- Ölçümler (önceden hesaplanmış)
    -- ...
    
    -- Denormalize edilmiş alanlar (JOIN yapmamak için)
    -- ...
    
    -- Metadata
    EklenmeTarihi DATETIME DEFAULT GETDATE(),
    GuncellenmeTarihi DATETIME DEFAULT GETDATE(),
    
    FOREIGN KEY (TarihID) REFERENCES Dim_Tarih(TarihID)
);
*/

PRINT 'Fact tabloları başarıyla oluşturuldu.';
GO


