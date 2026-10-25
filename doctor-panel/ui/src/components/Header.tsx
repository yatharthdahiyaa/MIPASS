import React from "react";

interface Props {
  username: string;
  onLock: () => void;
  onVerifyAudit: () => void;
  onSeedData: () => void;
}

export const Header: React.FC<Props> = ({ username, onLock, onVerifyAudit, onSeedData }) => {
  return (
    <header className="app-header">
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>
          mipaas <span style={{ color: "#38bdf8", fontWeight: 400 }}>Doctor Panel</span>
        </h1>
        <span
          style={{
            fontSize: "0.75rem",
            background: "#065f46",
            color: "#6ee7b7",
            padding: "2px 8px",
            borderRadius: "12px",
            fontWeight: 600,
          }}
        >
          ● Offline Local-Only
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
          Doctor: <strong style={{ color: "#f8fafc" }}>{username}</strong>
        </span>

        <button
          className="btn-secondary"
          onClick={onSeedData}
          title="Seed synthetic patients for demo"
          style={{ fontSize: "0.85rem", padding: "6px 10px" }}
        >
          Seed Data
        </button>

        <button
          className="btn-secondary"
          onClick={onVerifyAudit}
          title="Verify SHA-256 audit chain integrity"
          style={{ fontSize: "0.85rem", padding: "6px 10px" }}
        >
          Verify Audit Log
        </button>

        <button
          className="btn-primary"
          onClick={onLock}
          style={{
            fontSize: "0.85rem",
            padding: "6px 12px",
            background: "#475569",
          }}
        >
          🔒 Lock Session
        </button>
      </div>
    </header>
  );
};
