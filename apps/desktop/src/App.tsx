import { useCallback, useEffect, useState } from 'react';
import { api, type Doctor } from './api';
import Login from './components/Login';
import Workspace from './components/Workspace';

export default function App() {
  const [doctor, setDoctor] = useState<Doctor | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.currentUser().then(setDoctor, () => setDoctor(null));
  }, []);

  const onSignedOut = useCallback((reason?: string) => {
    setNotice(reason ?? null);
    setDoctor(null);
  }, []);

  if (doctor === undefined) return null;
  if (!doctor) {
    return (
      <Login
        notice={notice}
        onSignedIn={(d) => {
          setNotice(null);
          setDoctor(d);
        }}
      />
    );
  }
  return <Workspace doctor={doctor} onSignedOut={onSignedOut} />;
}
