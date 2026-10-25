import React, { useEffect, useState } from "react";
import { api, Patient } from "../api/tauri";

interface Props {
  onSelectPatient: (patientId: string) => void;
}

export const PatientList: React.FC<Props> = ({ onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await api.getPatients(query, sortBy);
      setPatients(data);
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [query, sortBy]);

  return (
    <div data-testid="patient-list">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Patient Directory</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Synthetic demo records — No real PHI present.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search by patient ID or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "280px" }}
            data-testid="patient-search-input"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: "140px" }}
            data-testid="patient-sort-select"
          >
            <option value="name">Sort: Name</option>
            <option value="dob">Sort: DOB</option>
            <option value="created">Sort: Created</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
            Loading patients...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
            No patients found. Click "Seed Data" in the top bar to generate synthetic patients.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "12px 20px" }}>Patient Name</th>
                <th style={{ padding: "12px 20px" }}>Date of Birth</th>
                <th style={{ padding: "12px 20px" }}>Sex</th>
                <th style={{ padding: "12px 20px" }}>Record ID</th>
                <th style={{ padding: "12px 20px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => onSelectPatient(p.id)}
                  data-testid={`patient-row-${p.id}`}
                >
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "14px 20px", color: "var(--text-muted)" }}>{p.dob}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        backgroundColor: "#1e293b",
                        color: "#93c5fd",
                      }}
                    >
                      {p.sex}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                    }}
                  >
                    {p.id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatient(p.id);
                      }}
                    >
                      Open Case →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
