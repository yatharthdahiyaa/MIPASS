import React, { useEffect, useState } from "react";
import { api, ChainVerifyResponse, SessionResponse } from "./api/tauri";
import { AuditAlert } from "./components/AuditAlert";
import { Header } from "./components/Header";
import { LockScreen } from "./pages/LockScreen";
import { LoginPage } from "./pages/LoginPage";
import { PatientDetail } from "./pages/PatientDetail";
import { PatientList } from "./pages/PatientList";

export const App: React.FC = () => {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [auditStatus, setAuditStatus] = useState<ChainVerifyResponse | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check audit chain integrity at startup
  const checkAuditIntegrity = async () => {
    try {
      const res = await api.verifyAuditChain();
      setAuditStatus(res);
    } catch (err) {
      console.error("Audit verification error:", err);
    }
  };

  useEffect(() => {
    checkAuditIntegrity();
  }, []);

  const handleLock = async () => {
    try {
      await api.lockScreen();
    } finally {
      setIsLocked(true);
    }
  };

  const handleSeedData = async () => {
    try {
      const msg = await api.seedSyntheticData();
      alert(msg);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      alert(typeof err === "string" ? err : "Failed to seed data");
    }
  };

  const handleManualVerify = async () => {
    try {
      const res = await api.verifyAuditChain();
      setAuditStatus(res);
      if (res.ok) {
        alert(res.message);
      }
    } catch (err: unknown) {
      alert("Verification call failed");
    }
  };

  if (!session) {
    return <LoginPage onLoginSuccess={(sess) => setSession(sess)} />;
  }

  return (
    <div className="app-shell">
      {isLocked && (
        <LockScreen
          username={session.username}
          onUnlock={(newSession) => {
            setSession(newSession);
            setIsLocked(false);
          }}
        />
      )}

      <Header
        username={session.username}
        onLock={handleLock}
        onVerifyAudit={handleManualVerify}
        onSeedData={handleSeedData}
      />

      <main className="main-content">
        <AuditAlert
          status={auditStatus}
          onDismiss={() => setAuditStatus(null)}
        />

        {selectedPatientId ? (
          <PatientDetail
            patientId={selectedPatientId}
            onBack={() => setSelectedPatientId(null)}
          />
        ) : (
          <PatientList
            key={refreshKey}
            onSelectPatient={(pid) => setSelectedPatientId(pid)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
