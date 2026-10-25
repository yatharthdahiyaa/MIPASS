import React, { useState } from "react";
import { api, SessionResponse } from "../api/tauri";

interface Props {
  username: string;
  onUnlock: (session: SessionResponse) => void;
}

export const LockScreen: React.FC<Props> = ({ username, onUnlock }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await api.login(username, password);
      onUnlock(session);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Incorrect password. Session remains locked.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 15, 25, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      data-testid="lock-screen"
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "380px",
          textAlign: "center",
          padding: "32px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔒</div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "4px" }}>
          Session Locked
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px" }}>
          Doctor: <strong>{username}</strong>
        </p>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              border: "1px solid var(--status-red)",
              color: "#fca5a5",
              borderRadius: "var(--radius)",
              fontSize: "0.8rem",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock}>
          <input
            type="password"
            placeholder="Enter password to unlock"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            style={{ width: "100%", marginBottom: "16px", textAlign: "center" }}
            data-testid="unlock-password-input"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
            data-testid="unlock-submit-btn"
          >
            {loading ? "Unlocking..." : "Unlock Session"}
          </button>
        </form>
      </div>
    </div>
  );
};
