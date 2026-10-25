import React from "react";
import { ChainVerifyResponse } from "../api/tauri";

interface Props {
  status: ChainVerifyResponse | null;
  onDismiss?: () => void;
}

export const AuditAlert: React.FC<Props> = ({ status, onDismiss }) => {
  if (!status || status.ok) {
    return null;
  }

  return (
    <div className="alert-banner" role="alert" data-testid="audit-alert">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "1.2rem" }}>⚠️</span>
        <div>
          <strong style={{ display: "block" }}>Security Alert: Audit Log Tamper Detected</strong>
          <span style={{ fontSize: "0.9rem" }}>{status.message}</span>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            color: "#fca5a5",
            fontSize: "1.1rem",
            padding: "4px 8px",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
