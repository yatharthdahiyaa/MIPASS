# mipaas Doctor Panel (Milestone 1)

Offline-first Windows desktop application for doctors to review patients, run local on-device decision support models, and document findings.

## Quick Start

### 1. Prerequisites
- Rust stable (1.97.1+) with `clippy` and `rustfmt`
- Node.js 20+ and pnpm
- Windows 10/11 with WebView2 runtime (pre-installed on Win11)

### 2. Run All Automated Verification Tests
```powershell
./scripts/check.ps1
```

### 3. Launch in Development Mode
```powershell
cd ui
pnpm install
pnpm dev
```
In a second terminal:
```powershell
cargo tauri dev
```

### 4. Synthetic Demo Credentials
- **Username**: `dr_demo`
- **Password**: `Demo@1234`
*(Synthetic test account pre-seeded in local encrypted database; never real patient data)*
