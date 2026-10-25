# Performance & Offline Verification Log

## Minimum Hardware Budget

| Component | Target Budget | Milestone 1 Projected |
|-----------|---------------|------------------------|
| Webview / UI | <= 400 MB | ~120 MB |
| Rust Core + Store | <= 150 MB | ~45 MB |
| Inference Worker | <= 1.5 GB | ~30 MB (MockModel) |
| Image Cache | <= 500 MB | 0 MB (M1 synthetic) |
| **Total** | **< 2.5 GB** | **~195 MB** |

## Measurement Methodology
1. **Memory**:
   - Launch application in Release profile.
   - Wait 60 seconds at idle.
   - Sample Private Working Set in Windows Task Manager / `Get-Process` for `app.exe` and `infer-worker.exe`.
2. **Offline Network Verification**:
   - `netstat -ano | findstr LISTEN`: Assert 0 listening TCP ports opened by `app.exe` or `infer-worker.exe`.
   - Wireshark capture with filter `not (ip.addr == 127.0.0.1 or ipv6.addr == ::1)`: Assert 0 outbound packets.
   - CSP header enforcing `'self'` and `connect-src ipc: asset:`, blocking all external telemetry and CDN requests.
