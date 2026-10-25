# Clinical safety rules
- Wording: UI and reports say "AI suggests" or "model finding", never "diagnosis is". The doctor's decision is the record.
- Every AI result stores: model id, version, SHA-256 of the model bundle, input reference, timestamp, confidence, and the doctor's action (accepted / edited / rejected) with user id.
- AI output is never written to the final record without an explicit doctor action.
- Load models only from signed bundles. Verify signature and hash at load; refuse otherwise. Show the model version in the UI.
- Audit log covers every login, record view, AI run, doctor action and export. Append-only and hash-chained. Verify the chain at startup and show an alert if it is broken.
- Per-doctor accounts (Argon2id). Auto-lock after inactivity. No shared logins.
- Patient data never appears in logs, panic messages, crash dumps or file names. Encrypt the DB with SQLCipher; keep the key in the OS credential store, never in source or config.
- Show confidence and limitations. "No finding" must look different from "not analyzed". Refuse low-quality input with a stated reason.
- Never claim regulatory approval or compliance in code or UI. Leave TODO(reg) comments where CDSCO, ABDM or DPDP work is needed.
