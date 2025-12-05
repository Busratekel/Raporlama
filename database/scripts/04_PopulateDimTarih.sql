-- Dim_Tarih tablosunu doldur (2020-2030 arası)
-- Bu script bir kez çalıştırılacak

USE Raporlama_DW;
GO

DECLARE @StartDate DATE = '2020-01-01';
DECLARE @EndDate DATE = '2030-12-31';
DECLARE @CurrentDate DATE = @StartDate;

WHILE @CurrentDate <= @EndDate
BEGIN
    INSERT INTO Dim_Tarih (
        TarihID,
        Tarih,
        Yil,
        Ay,
        Gun,
        AyAdi,
        Ceyrek,
        Hafta,
        HaftaninGunu,
        GunAdi,
        IsWeekday
    )
    VALUES (
        CONVERT(INT, FORMAT(@CurrentDate, 'yyyyMMdd')),
        @CurrentDate,
        YEAR(@CurrentDate),
        MONTH(@CurrentDate),
        DAY(@CurrentDate),
        CASE MONTH(@CurrentDate)
            WHEN 1 THEN 'Ocak'
            WHEN 2 THEN 'Şubat'
            WHEN 3 THEN 'Mart'
            WHEN 4 THEN 'Nisan'
            WHEN 5 THEN 'Mayıs'
            WHEN 6 THEN 'Haziran'
            WHEN 7 THEN 'Temmuz'
            WHEN 8 THEN 'Ağustos'
            WHEN 9 THEN 'Eylül'
            WHEN 10 THEN 'Ekim'
            WHEN 11 THEN 'Kasım'
            WHEN 12 THEN 'Aralık'
        END,
        DATEPART(QUARTER, @CurrentDate),
        DATEPART(WEEK, @CurrentDate),
        DATEPART(WEEKDAY, @CurrentDate),
        CASE DATEPART(WEEKDAY, @CurrentDate)
            WHEN 1 THEN 'Pazar'
            WHEN 2 THEN 'Pazartesi'
            WHEN 3 THEN 'Salı'
            WHEN 4 THEN 'Çarşamba'
            WHEN 5 THEN 'Perşembe'
            WHEN 6 THEN 'Cuma'
            WHEN 7 THEN 'Cumartesi'
        END,
        CASE WHEN DATEPART(WEEKDAY, @CurrentDate) IN (1, 7) THEN 0 ELSE 1 END
    );
    
    SET @CurrentDate = DATEADD(DAY, 1, @CurrentDate);
END;

PRINT 'Dim_Tarih tablosu dolduruldu: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' kayıt eklendi.';
GO




