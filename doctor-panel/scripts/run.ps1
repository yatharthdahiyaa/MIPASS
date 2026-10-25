# Run the offline mipaas Doctor Panel desktop application
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
Set-Location $BaseDir

$Exe = Join-Path $BaseDir "target\debug\app.exe"
if (-not (Test-Path $Exe)) {
    Write-Host "Building application..." -ForegroundColor Cyan
    cargo build -p app
}

Write-Host "Starting mipaas Doctor Panel..." -ForegroundColor Green
Start-Process -FilePath $Exe -WorkingDirectory $BaseDir
