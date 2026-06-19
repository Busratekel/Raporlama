#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Raporlama.ETL Windows Service kurulum / kaldırma scripti.

.EXAMPLE
  .\install-etl-service.ps1 -Action Install -InstallPath "C:\Services\Raporlama.ETL"
  .\install-etl-service.ps1 -Action Uninstall
  .\install-etl-service.ps1 -Action Status
#>
param(
    [ValidateSet("Install", "Uninstall", "Start", "Stop", "Status")]
    [string]$Action = "Install",
    [string]$InstallPath = "C:\Services\Raporlama.ETL",
    [string]$ServiceName = "Raporlama.ETL",
    [string]$ServiceAccount = "",
    [string]$ServicePassword = ""
)

$ErrorActionPreference = "Stop"
$ExePath = Join-Path $InstallPath "Raporlama.ETL.exe"

function Write-Step($msg) { Write-Host ">> $msg" -ForegroundColor Cyan }

switch ($Action) {
    "Install" {
        if (-not (Test-Path $ExePath)) {
            throw "Exe bulunamadı: $ExePath`nÖnce publish alın: dotnet publish src/Raporlama.ETL/Raporlama.ETL.csproj -c Release -r win-x64 --self-contained true -o `"$InstallPath`""
        }

        $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Step "Mevcut servis durduruluyor..."
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            sc.exe delete $ServiceName | Out-Null
            Start-Sleep -Seconds 2
        }

        Write-Step "Windows Service oluşturuluyor: $ServiceName"
        New-Service -Name $ServiceName `
            -BinaryPathName "`"$ExePath`"" `
            -DisplayName "Bellona Raporlama ETL" `
            -Description "Rapor verilerini cron ile BellonaRapor veritabanına aktarır. IIS'ten bağımsız çalışır." `
            -StartupType Automatic | Out-Null

        if ($ServiceAccount) {
            Write-Step "Servis hesabı ayarlanıyor: $ServiceAccount"
            if (-not $ServicePassword) { throw "ServiceAccount verildi ama ServicePassword boş." }
            & sc.exe config $ServiceName obj= $ServiceAccount password= $ServicePassword | Out-Null
        }

        Write-Step "Servis başlatılıyor..."
        Start-Service -Name $ServiceName
        Get-Service -Name $ServiceName
        Write-Host "`nKurulum tamam. Log: $InstallPath\logs\" -ForegroundColor Green
        Write-Host "Manuel tetikleme (sunucuda): POST http://127.0.0.1:5010/api/etl/run/{gorevId}" -ForegroundColor Yellow
    }

    "Uninstall" {
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (-not $svc) { Write-Host "Servis zaten yok."; return }
        Write-Step "Servis durduruluyor..."
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Write-Host "Servis kaldırıldı." -ForegroundColor Green
    }

    "Start"  { Start-Service -Name $ServiceName; Get-Service -Name $ServiceName }
    "Stop"   { Stop-Service -Name $ServiceName -Force; Get-Service -Name $ServiceName }
    "Status" { Get-Service -Name $ServiceName -ErrorAction SilentlyContinue; if (Test-Path "$InstallPath\logs") { Get-ChildItem "$InstallPath\logs\etl-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object { Write-Host "`nSon log: $($_.FullName)" } } }
}
