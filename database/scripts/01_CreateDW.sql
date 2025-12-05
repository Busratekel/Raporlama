-- Veri Ambarı (Data Warehouse) Veritabanı Oluşturma
-- Bu script sadece bir kez çalıştırılacak

USE master;
GO

-- Eğer varsa sil
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'Raporlama_DW')
BEGIN
    ALTER DATABASE Raporlama_DW SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE Raporlama_DW;
END
GO

-- Veri Ambarı oluştur
CREATE DATABASE Raporlama_DW;
GO

USE Raporlama_DW;
GO

PRINT 'Raporlama_DW veritabanı başarıyla oluşturuldu.';
GO




