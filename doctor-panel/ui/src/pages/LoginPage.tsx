import React, { useState } from "react";
import { api, SessionResponse } from "../api/tauri";

interface Props {
  onLoginSuccess: (session: SessionResponse) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("dr_demo");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await api.login(username, password);
      onLoginSuccess(session);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
      }}
      data-testid="login-page"
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>
            mipaas <span style={{ color: "#38bdf8" }}>Doctor Panel</span>
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Offline Clinical Decision Support Desktop
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              border: "1px solid var(--status-red)",
              color: "#fca5a5",
              borderRadius: "var(--radius)",
              fontSize: "0.85rem",
              marginBottom: "16px",
            }}
            data-testid="login-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginBottom: "6px",
              }}
            >
              Doctor Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: "100%" }}
              data-testid="username-input"
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%" }}
              data-testid="password-input"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "10px", fontSize: "0.95rem" }}
            data-testid="login-submit-btn"
          >
            {loading ? "Authenticating..." : "Sign In to Clinic"}
          </button>
        </form>

        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "var(--radius)",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          🔐 Pre-seeded synthetic test: <code>dr_demo</code> / <code>Demo@1234</code>
        </div>
      </div>
    </div>
  );
};
