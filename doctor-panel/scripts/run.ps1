# Run the offline mipaas Doctor Panel desktop application
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
Set-Location $BaseDir

# Terminate any previously running app/worker to release WebView2 file locks
Get-Process -Name "app", "infer-worker" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

$Exe = Join-Path $BaseDir "target\debug\app.exe"
if (-not (Test-Path $Exe)) {
    Write-Host "Building application..." -ForegroundColor Cyan
    cargo build -p app
}

Write-Host "Starting mipaas Doctor Panel..." -ForegroundColor Green
Start-Process -FilePath $Exe -WorkingDirectory $BaseDir
