import React, { useEffect, useState } from 'react';
import { api, type Analyzer, type PatientFields, type PickedFile, type Study } from '../api';
import { bytes } from '../format';
import { Icon, Spinner } from './ui';

const EMPTY: PatientFields = { patient_ref: '', patient_name: '', patient_age: '', patient_sex: '', study_date: '', clinical_notes: '' };

export default function NewStudy({
  onCancel,
  onCreated,
  onError,
}: {
  onCancel: () => void;
  onCreated: (s: Study) => void;
  onError: (err: unknown) => string;
}) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fields, setFields] = useState<PatientFields>(EMPTY);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzers, setAnalyzers] = useState<Analyzer[]>([]);
  const [analyzer, setAnalyzer] = useState(''); // '' = let the server choose from the file

  useEffect(() => {
    api.analyzers().then(
      (r) => setAnalyzers(r.analyzers),
      () => setAnalyzers([]),
    );
  }, []);

  const chosen = analyzers.find((a) => a.id === analyzer) ?? (analyzers.length === 1 ? analyzers[0] : undefined);
  const noModel = chosen ? !chosen.available : analyzers.length > 0 && analyzers.every((a) => !a.available);

  const set = (k: keyof PatientFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function pick() {
    setError(null);
    setPicking(true);
    try {
      const picked = await api.pickStudyFile();
      if (picked) setFile(picked);
    } catch (err) {
      setError(onError(err));
    } finally {
      setPicking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || pending) return;
    if (fields.patient_age && !/^\d{1,3}$/.test(fields.patient_age)) {
      setError('Age must be a whole number.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const { study } = await api.uploadStudy(file.id, { ...fields, analyzer: analyzer || undefined });
      onCreated(study);
    } catch (err) {
      setError(onError(err));
      // The picked file id is single-use; ask for it again after a failed upload.
      setFile(null);
      setPending(false);
    }
  }

  return (
    <form className="main-inner stack" style={{ gap: 18, maxWidth: 920 }} onSubmit={submit}>
      <div>
        <h1 className="page-title">
          Upload a study
        </h1>
        <p className="muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
          Patient details from a DICOM header are filled in automatically; anything you type here takes priority.
        </p>
      </div>

      <div className="card">
        <div className="dropzone">
          <span style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--s2)' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <rect x="4" y="3" width="16" height="18" rx="2.5" />
              <path d="M12 7v10M9 9c-1.2.6-2 1.9-2 3.6M15 9c1.2.6 2 1.9 2 3.6M9.2 12.6 12 13.8l2.8-1.2" />
            </svg>
          </span>
          {file ? (
            <div>
              <div style={{ fontWeight: 600 }} className="selectable">
                {file.name}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {bytes(file.size)}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600 }}>Choose the image</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                DICOM (.dcm), PNG, JPG or WEBP · up to 25 MB
              </div>
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={pick} disabled={picking || pending}>
            {picking && <Spinner />}
            {file ? 'Choose another file' : 'Choose file…'}
          </button>
        </div>
      </div>

      {analyzers.length > 1 && (
        <div className="card">
          <label className="field">
            <span>Study type</span>
            <select className="input" value={analyzer} onChange={(e) => setAnalyzer(e.target.value)} disabled={pending}>
              <option value="">Detect from the file</option>
              {analyzers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                  {a.available ? '' : ' (no model installed)'}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {noModel && (
        <div className="alert alert-info" role="status">
          No trained model is installed for {chosen ? chosen.display_name : 'these study types'} yet. The study will be saved and analysed automatically
          once one is.
        </div>
      )}

      <div className="card">
        <h2>Patient</h2>
        <div className="grid-3">
          <label className="field">
            <span>
              Patient ID / MRN <em>optional</em>
            </span>
            <input className="input" value={fields.patient_ref} onChange={set('patient_ref')} maxLength={120} />
          </label>
          <label className="field" style={{ gridColumn: 'span 2' }}>
            <span>
              Name <em>optional</em>
            </span>
            <input className="input" value={fields.patient_name} onChange={set('patient_name')} maxLength={150} />
          </label>
          <label className="field">
            <span>Age</span>
            <input className="input tnum" inputMode="numeric" value={fields.patient_age} onChange={set('patient_age')} maxLength={3} />
          </label>
          <label className="field">
            <span>Sex</span>
            <select className="input" value={fields.patient_sex} onChange={set('patient_sex')}>
              <option value="">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="field">
            <span>Study date</span>
            <input className="input" type="date" value={fields.study_date} onChange={set('study_date')} />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>
              Indication / clinical history <em>optional</em>
            </span>
            <textarea className="input" value={fields.clinical_notes} onChange={set('clinical_notes')} maxLength={4000} placeholder="e.g. Productive cough and fever for 5 days" />
          </label>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="row">
        <button type="submit" className="btn btn-light" disabled={!file || pending} style={{ height: 40 }}>
          {pending ? <Spinner /> : <Icon name="check" />}
          {pending ? 'Uploading…' : noModel ? 'Upload' : 'Upload & analyse'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        {pending && !noModel && <span className="muted">Running {chosen?.display_name ?? 'the'} model. The first run after starting the server can take up to a minute.</span>}
      </div>
    </form>
  );
}
