import React, { useCallback, useEffect, useState } from 'react';
import { api, CommandError, type Doctor, type ServerInfo } from '../api';
import { Logo, Spinner } from './ui';

const ORBS = [
  { top: '12%', left: '16%', size: 120, bg: 'radial-gradient(circle at 35% 30%, #ffd1f0, #3fb4ff 55%, #6f7bff)' },
  { top: '8%', left: '60%', size: 80, bg: 'radial-gradient(circle at 35% 30%, #fffaf0, #ffd78a 55%, #f2a65a)' },
  { top: '38%', left: '74%', size: 96, bg: 'radial-gradient(circle at 35% 30%, #ffb3a3, #d44c3c 55%, #3a5b8c)' },
  { top: '56%', left: '10%', size: 86, bg: 'radial-gradient(circle at 35% 30%, #e8ff8a, #38b6a0 55%, #2f3fbf)' },
];

export default function Login({ notice, onSignedIn }: { notice: string | null; onSignedIn: (d: Doctor) => void }) {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [serverDraft, setServerDraft] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True once the server has asked for a two-step verification code. */
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');

  const check = useCallback(async () => {
    const info = await api.serverStatus();
    setServer(info);
    return info;
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function saveServer(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    try {
      await api.setServerUrl(serverDraft);
      await check();
      setEditing(false);
    } catch (err) {
      setServerError(err instanceof CommandError ? err.message : 'Invalid address.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      onSignedIn(await api.login(identifier, password, needsCode ? code : undefined));
    } catch (err) {
      setPending(false);
      if (err instanceof CommandError && err.code === 'MFA_REQUIRED') {
        // Password accepted: keep it in memory for the second step and ask for the code.
        setNeedsCode(true);
        setCode('');
        return;
      }
      setError(err instanceof CommandError ? err.message : 'Sign-in failed.');
      if (needsCode) {
        setCode('');
      } else {
        setPassword('');
      }
    }
  }

  return (
    <div className="login">
      <div className="login-form">
        <header className="row" style={{ justifyContent: 'space-between' }}>
          <span className="brand">
            <Logo /> MIPAAS
          </span>
          <span className="label">Diagnostic panel</span>
        </header>

        <main>
          <div>
            <h1>Sign in to review studies.</h1>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.5, marginTop: 12 }}>
              For verified doctors. Your session stays on this computer and ends when you close the app.
            </p>

            <div className="card" style={{ marginTop: 26, padding: 12 }}>
              {!editing ? (
                <div className="server-row">
                  <span
                    className="dot"
                    style={{ background: server == null ? '#55585f' : server.reachable ? '#0ca30c' : '#ff6b6b' }}
                    aria-hidden="true"
                  />
                  <span className="truncate" style={{ flex: 1 }}>
                    {server == null ? 'Checking server…' : server.reachable ? 'Connected to ' : 'Can’t reach '}
                    {server && <span className="mono" style={{ color: 'var(--text-2)' }}>{server.server_url}</span>}
                  </span>
                  <button className="btn btn-quiet btn-sm" type="button" onClick={() => void check()} aria-label="Check again">
                    Retry
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    type="button"
                    onClick={() => {
                      setServerDraft(server?.server_url ?? '');
                      setEditing(true);
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <form onSubmit={saveServer} className="stack" style={{ gap: 8 }}>
                  <label className="field">
                    <span>
                      MIPAAS server address <em>http only for this computer</em>
                    </span>
                    <input className="input mono" value={serverDraft} onChange={(e) => setServerDraft(e.target.value)} placeholder="http://127.0.0.1:8080" autoFocus />
                  </label>
                  {serverError && <div className="alert alert-error">{serverError}</div>}
                  <div className="row">
                    <button className="btn btn-light btn-sm" type="submit">
                      Save
                    </button>
                    <button className="btn btn-quiet btn-sm" type="button" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <form onSubmit={submit} className="stack" style={{ marginTop: 22 }}>
              {notice && <div className="alert alert-info">{notice}</div>}
              {error && (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              )}
              {needsCode ? (
                <>
                  <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                    Two-step verification is on for <strong>{identifier}</strong>. Enter the 6-digit code from your authenticator app, or a recovery code.
                  </p>
                  <label className="field">
                    <span>Verification code</span>
                    <input
                      className="input mono"
                      autoFocus
                      autoComplete="one-time-code"
                      spellCheck={false}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      style={{ height: 42 }}
                    />
                  </label>
                  <button className="btn btn-light" type="submit" disabled={pending || !code.trim()} style={{ height: 42, marginTop: 6 }}>
                    {pending && <Spinner />}
                    {pending ? 'Verifying…' : 'Verify'}
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    type="button"
                    onClick={() => {
                      setNeedsCode(false);
                      setCode('');
                      setPassword('');
                      setError(null);
                    }}
                  >
                    Use a different account
                  </button>
                </>
              ) : (
                <>
              <label className="field">
                <span>Email or username</span>
                <input
                  className="input"
                  autoFocus
                  autoComplete="username"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  style={{ height: 42 }}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ height: 42 }}
                />
              </label>
              <button className="btn btn-light" type="submit" disabled={pending || !identifier || !password} style={{ height: 42, marginTop: 6 }}>
                {pending && <Spinner />}
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                No account yet? Register as a doctor on the MIPAAS website. Access opens once your medical registration is verified.
              </p>
                </>
              )}
            </form>
          </div>
        </main>
      </div>

      <aside className="login-art" aria-hidden="true">
        {ORBS.map((o, i) => (
          <span key={i} className="orb" style={{ top: o.top, left: o.left, width: o.size, height: o.size, background: o.bg, animationDelay: `${-i * 2}s` }} />
        ))}
        <p className="label" style={{ position: 'absolute', left: 44, bottom: 150, color: 'rgb(15 16 16 / 0.7)' }}>
          Imaging AI
        </p>
        <p className="big">Every scan explained. Every report signed.</p>
      </aside>
    </div>
  );
}
