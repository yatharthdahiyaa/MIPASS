import React, { useEffect, useState } from "react";
import {
  api,
  AiResult,
  Case,
  DoctorAction,
  ModelInfo,
  Patient,
} from "../api/tauri";
import { AiPanel } from "../components/AiPanel";

interface Props {
  patientId: string;
  onBack: () => void;
}

export const PatientDetail: React.FC<Props> = ({ patientId, onBack }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [findings, setFindings] = useState<AiResult[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPatientData = async () => {
    setLoading(true);
    try {
      const data = await api.getPatient(patientId);
      setPatient(data.patient);
      setCases(data.cases);
      if (data.cases.length > 0) {
        setSelectedCaseId(data.cases[0].id);
      }
      const model = await api.getModelInfo();
      setModelInfo(model);
    } catch (err) {
      console.error("Failed to load patient detail:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseFindings = async (cid: string) => {
    try {
      const caseDetail = await api.getCase(cid);
      setFindings(caseDetail.findings);
    } catch (err) {
      console.error("Failed to load case findings:", err);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseFindings(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleRunAi = async (inputRef: string) => {
    if (!selectedCaseId) return;
    try {
      const results = await api.runAi(selectedCaseId, inputRef);
      setFindings((prev) => [...results, ...prev]);
    } catch (err: unknown) {
      alert(typeof err === "string" ? err : "Inference run failed");
    }
  };

  const handleRecordAction = async (findingId: string, action: DoctorAction) => {
    try {
      await api.recordDoctorAction(findingId, action);
      if (selectedCaseId) {
        await loadCaseFindings(selectedCaseId);
      }
    } catch (err: unknown) {
      alert(typeof err === "string" ? err : "Failed to record doctor action");
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading patient...</div>;
  }

  if (!patient) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Patient not found.</div>;
  }

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <div data-testid="patient-detail">
      {/* Navigation and Top Demographics */}
      <div style={{ marginBottom: "20px" }}>
        <button
          className="btn-secondary"
          onClick={onBack}
          style={{ marginBottom: "16px", fontSize: "0.85rem" }}
          data-testid="back-to-patients-btn"
        >
          ← Back to Patient Directory
        </button>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>{patient.name}</h2>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginTop: "6px",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                }}
              >
                <span>DOB: <strong style={{ color: "var(--text-main)" }}>{patient.dob}</strong></span>
                <span>Sex: <strong style={{ color: "var(--text-main)" }}>{patient.sex}</strong></span>
                <span>UUID: <code style={{ fontSize: "0.8rem" }}>{patient.id}</code></span>
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  padding: "4px 10px",
                  background: "#1e293b",
                  borderRadius: "16px",
                  color: "#38bdf8",
                }}
              >
                {cases.length} Clinical Case{cases.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Case Selector and Case Details */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
        {/* Cases Sidebar */}
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "10px" }}>
            Patient Cases
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {cases.map((c, idx) => (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${
                    selectedCaseId === c.id ? "var(--accent-blue)" : "var(--border-color)"
                  }`,
                  backgroundColor:
                    selectedCaseId === c.id ? "var(--bg-secondary)" : "var(--bg-card)",
                  cursor: "pointer",
                }}
                data-testid={`case-tab-${c.id}`}
              >
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  Case #{idx + 1}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Created: {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Case Findings & AI Panel */}
        <div>
          {selectedCase && (
            <div className="card" style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "6px" }}>
                Case Notes
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                {selectedCase.notes || "No additional clinical notes recorded."}
              </p>
            </div>
          )}

          {selectedCaseId && (
            <AiPanel
              caseId={selectedCaseId}
              findings={findings}
              modelInfo={modelInfo}
              onRunAi={handleRunAi}
              onRecordAction={handleRecordAction}
            />
          )}
        </div>
      </div>
    </div>
  );
};
