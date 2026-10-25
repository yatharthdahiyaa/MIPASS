import React, { useState } from "react";
import { AiResult, DoctorAction, ModelInfo } from "../api/tauri";

interface Props {
  caseId: string;
  findings: AiResult[];
  modelInfo: ModelInfo | null;
  onRunAi: (inputRef: string) => Promise<void>;
  onRecordAction: (findingId: string, action: DoctorAction) => Promise<void>;
}

export const AiPanel: React.FC<Props> = ({
  caseId: _caseId,
  findings,
  modelInfo,
  onRunAi,
  onRecordAction,
}) => {
  const [running, setRunning] = useState(false);
  const [inputRef, setInputRef] = useState("synth_cxr_frontal_01.png");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showModelDetails, setShowModelDetails] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      await onRunAi(inputRef);
    } finally {
      setRunning(false);
    }
  };

  const getConfidenceClass = (conf: number) => {
    if (conf >= 0.8) return "confidence-high";
    if (conf >= 0.6) return "confidence-mid";
    return "confidence-low";
  };

  return (
    <div className="card" data-testid="ai-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Decision Support (On-Device AI)
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            AI suggestions are for decision support only. Physician review is mandatory.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            value={inputRef}
            onChange={(e) => setInputRef(e.target.value)}
            placeholder="Input image reference"
            style={{ width: "220px", fontSize: "0.85rem" }}
          />
          <button
            className="btn-primary"
            onClick={handleRun}
            disabled={running}
            data-testid="run-ai-btn"
          >
            {running ? "Running Model..." : "▶ Run AI Model"}
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div style={{ marginTop: "16px" }}>
        {findings.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              border: "1px dashed var(--border-color)",
              borderRadius: "var(--radius)",
              color: "var(--text-muted)",
            }}
          >
            <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "8px" }}>
              📋
            </span>
            <strong>Not Analyzed</strong>
            <p style={{ fontSize: "0.85rem" }}>
              Click "Run AI Model" to execute on-device inference for this case.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {findings.map((res) => {
              const confPct = Math.round(res.finding.confidence * 100);
              const isNoFinding = res.finding.label.toLowerCase().includes("no ");

              return (
                <div
                  key={res.id}
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius)",
                    padding: "16px",
                  }}
                  data-testid="finding-card"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--text-muted)",
                        }}
                      >
                        Model Suggestion:
                      </span>
                      <h4
                        style={{
                          fontSize: "1rem",
                          fontWeight: 600,
                          marginTop: "2px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{isNoFinding ? "🟢" : "⚠️"}</span>
                        <span>AI suggests: {res.finding.label}</span>
                      </h4>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color:
                            confPct >= 80
                              ? "var(--status-green)"
                              : confPct >= 60
                              ? "var(--status-amber)"
                              : "var(--status-red)",
                        }}
                      >
                        {confPct}% Confidence
                      </span>
                      <div className="confidence-bar-bg" style={{ width: "90px" }}>
                        <div
                          className={`confidence-bar-fill ${getConfidenceClass(
                            res.finding.confidence
                          )}`}
                          style={{ width: `${confPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Doctor Action Section */}
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px solid #1e293b",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      {res.doctor_action ? (
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#1e293b",
                            color: "#38bdf8",
                          }}
                        >
                          Doctor Decision:{" "}
                          {typeof res.doctor_action === "string"
                            ? res.doctor_action
                            : `Edited (${res.doctor_action.Edited.new_text})`}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--status-amber)",
                            fontStyle: "italic",
                          }}
                        >
                          Pending doctor review (Not written to permanent record)
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {editingId === res.id ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            placeholder="Corrected finding text"
                            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                          />
                          <button
                            className="btn-accept"
                            onClick={async () => {
                              await onRecordAction(res.id, {
                                Edited: { new_text: editText },
                              });
                              setEditingId(null);
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => setEditingId(null)}
                            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="btn-accept"
                            onClick={() => onRecordAction(res.id, "Accepted")}
                            data-testid="accept-btn"
                          >
                            ✓ Accept
                          </button>
                          <button
                            className="btn-edit"
                            onClick={() => {
                              setEditingId(res.id);
                              setEditText(res.finding.label);
                            }}
                            data-testid="edit-btn"
                          >
                            ✎ Edit
                          </button>
                          <button
                            className="btn-reject"
                            onClick={() => onRecordAction(res.id, "Rejected")}
                            data-testid="reject-btn"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible Model Info Footer */}
      {modelInfo && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <button
            onClick={() => setShowModelDetails(!showModelDetails)}
            style={{
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{showModelDetails ? "▼" : "▶"}</span>
            <span>
              Model: <strong>{modelInfo.id}</strong> v{modelInfo.version}
            </span>
          </button>

          {showModelDetails && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                background: "var(--bg-secondary)",
                borderRadius: "4px",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                wordBreak: "break-all",
              }}
            >
              <div>Bundle SHA-256: {modelInfo.bundle_sha256}</div>
              <div>Execution Mode: Local On-Device (No cloud telemetry)</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
