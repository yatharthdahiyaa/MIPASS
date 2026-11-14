import type { Doctor, Study } from './api';
import { SEVERITY, demographics, fmtDate, fmtDateTime, pathologyName, pct } from './format';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Self-contained, printable HTML report (no scripts, no external resources). */
export function buildReportHtml(study: Study, doctor: Doctor, images: { preview?: string; heatmap?: string }) {
  const sev = study.severity ? SEVERITY[study.severity] : null;
  const rows = [...(study.findings?.pathologies ?? [])]
    .sort((a, b) => b.probability - a.probability)
    .map(
      (p) =>
        `<tr${p.positive ? ' class="pos"' : ''}><td>${esc(pathologyName(p.name))}</td><td>${pct(p.probability)}</td><td>${pct(p.threshold)}</td><td>${p.positive ? 'Flagged' : ''}</td></tr>`,
    )
    .join('');
  const actions = (study.findings?.recommended_actions ?? []).map((a) => `<li>${esc(a)}</li>`).join('');
  const signed = study.report_status === 'signed';
  const kind = study.analyzer_name || 'Imaging study';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>${esc(kind)} report — ${esc(study.patient_name || study.patient_ref || study.original_filename)}</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;max-width:860px;margin:32px auto;padding:0 24px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#444}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px;border:1px solid #ddd;border-radius:8px;padding:14px 16px}
.meta b{display:block;font-size:11px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.imgs{display:flex;gap:12px}.imgs figure{margin:0;flex:1}.imgs img{width:100%;border-radius:6px;background:#000}figcaption{font-size:12px;color:#666}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #eee}tr.pos td{font-weight:600}
.sev{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;border:1px solid}
.impression{white-space:pre-wrap;border-left:3px solid #111;padding:6px 12px;background:#fafafa}
.sig{margin-top:24px;padding-top:12px;border-top:1px solid #ddd}.draft{color:#b45309;font-weight:600}
.note{font-size:12px;color:#666;margin-top:24px}
@media print{body{margin:0}}
</style></head><body>
<h1>${esc(kind)} report</h1>
<p>${signed ? '' : '<span class="draft">DRAFT — not signed</span>'}</p>
<div class="meta">
<div><b>Patient</b>${esc(study.patient_name || '—')}</div>
<div><b>Patient ID</b>${esc(study.patient_ref || '—')}</div>
<div><b>Age / sex</b>${esc(demographics(study) || '—')}</div>
<div><b>Study date</b>${esc(fmtDate(study.study_date || study.created_at))}</div>
<div><b>File</b>${esc(study.original_filename)}</div>
<div><b>AI model</b>${esc(study.model_name || '—')}</div>
<div><b>Referring notes</b>${esc(study.clinical_notes || '—')}</div>
</div>
${images.preview ? `<h2>Images</h2><div class="imgs"><figure><img src="${images.preview}" alt="${esc(kind)}"><figcaption>Study image</figcaption></figure>${images.heatmap ? `<figure><img src="${images.heatmap}" alt="AI attention map"><figcaption>AI attention map</figcaption></figure>` : ''}</div>` : ''}
<h2>Impression</h2>
<div class="impression">${esc(study.impression || '—')}</div>
<h2>AI decision support</h2>
<p>${sev ? `<span class="sev" style="color:${sev.color};border-color:${sev.color}">${esc(sev.label)}</span>` : ''} Primary: <b>${esc(study.primary_finding ? pathologyName(study.primary_finding) : '—')}</b></p>
${study.findings?.clinical_summary ? `<p>${esc(study.findings.clinical_summary)}</p>` : ''}
<table><thead><tr><th>Finding</th><th>Probability</th><th>Threshold</th><th></th></tr></thead><tbody>${rows}</tbody></table>
${actions ? `<h2>AI suggested actions</h2><ul>${actions}</ul>` : ''}
<div class="sig">${signed ? `Signed by <b>${esc(study.signed_by)}</b> on ${esc(fmtDateTime(study.signed_at))}` : `Prepared by ${esc(doctor.name)} — not yet signed`}</div>
<p class="note">Model: ${esc(study.model_name || '—')}. ${esc(study.findings?.disclaimer || 'AI output is decision support only and must be confirmed by a qualified clinician.')}</p>
</body></html>`;
}
