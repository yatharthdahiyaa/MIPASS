#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "==> cargo fmt --all" -ForegroundColor Cyan
cargo fmt --all --check

Write-Host "==> cargo clippy" -ForegroundColor Cyan
cargo clippy --workspace --all-targets -- -D warnings

Write-Host "==> cargo test (workspace crates)" -ForegroundColor Cyan
cargo test -p doctor-core
cargo test -p store
cargo test -p audit
cargo test -p infer
cargo test -p infer-worker

if (Test-Path "ui/package.json") {
    Write-Host "==> pnpm --dir ui test" -ForegroundColor Cyan
    pnpm --dir ui test --run
}

Write-Host "All checks passed successfully." -ForegroundColor Green
