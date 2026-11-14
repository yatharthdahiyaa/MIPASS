/**
 * Chest X-ray screening: model labels, thresholds and agents, mirrored from the backend
 * (apps/backend/models/chest_xray.py and app/agents/*). The sample studies are illustrative,
 * not real patients or real model output.
 */

export type Pathology =
  | 'Atelectasis'
  | 'Cardiomegaly'
  | 'Consolidation'
  | 'Edema'
  | 'Effusion'
  | 'Emphysema'
  | 'Fibrosis'
  | 'Hernia'
  | 'Infiltration'
  | 'Mass'
  | 'Nodule'
  | 'Pleural_Thickening'
  | 'Pneumonia'
  | 'Pneumothorax';

/** Per-class decision thresholds (DEFAULT_THRESHOLDS in models/chest_xray.py). */
export const THRESHOLDS: Record<Pathology, number> = {
  Atelectasis: 0.28,
  Cardiomegaly: 0.25,
  Consolidation: 0.26,
  Edema: 0.22,
  Effusion: 0.3,
  Emphysema: 0.16,
  Fibrosis: 0.18,
  Hernia: 0.12,
  Infiltration: 0.32,
  Mass: 0.18,
  Nodule: 0.15,
  Pleural_Thickening: 0.24,
  Pneumonia: 0.22,
  Pneumothorax: 0.2,
};

export const PATHOLOGIES = Object.keys(THRESHOLDS) as Pathology[];

/** Pathologies the Triage & Escalation agent pages STAT (CRITICAL_PATHOLOGY_SET). */
export const CRITICAL: ReadonlySet<Pathology> = new Set(['Pneumothorax']);

export const label = (p: Pathology) => p.replace('_', ' ');

/** A focus-map hot spot, in the 0–100 coordinate space of the film. */
export interface FocusRegion {
  pathology: Pathology;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type Priority = 'ROUTINE' | 'URGENT' | 'STAT';

export interface SampleStudy {
  id: string;
  title: string;
  summary: string;
  accession: string;
  age: string;
  view: 'PA' | 'AP';
  scores: Record<Pathology, number>;
  regions: FocusRegion[];
  /** Pneumothorax line drawn on the film. */
  pneumothorax?: boolean;
  effusion?: boolean;
  nodule?: boolean;
  priority: Priority;
  prior?: string;
  report: Array<{ text: string; finding?: Pathology }>;
  followUp?: string;
}

const base: Record<Pathology, number> = {
  Atelectasis: 0.09,
  Cardiomegaly: 0.11,
  Consolidation: 0.06,
  Edema: 0.04,
  Effusion: 0.08,
  Emphysema: 0.05,
  Fibrosis: 0.04,
  Hernia: 0.01,
  Infiltration: 0.12,
  Mass: 0.03,
  Nodule: 0.05,
  Pleural_Thickening: 0.06,
  Pneumonia: 0.05,
  Pneumothorax: 0.03,
};

export const STUDIES: SampleStudy[] = [
  {
    id: 'critical',
    title: 'Right pneumothorax',
    summary: 'Critical finding, paged STAT',
    accession: 'CR-2041',
    age: '34 M',
    view: 'PA',
    scores: { ...base, Pneumothorax: 0.71, Effusion: 0.34, Atelectasis: 0.22, Pleural_Thickening: 0.14 },
    regions: [
      { pathology: 'Pneumothorax', cx: 31, cy: 28, rx: 11, ry: 14 },
      { pathology: 'Effusion', cx: 30, cy: 70, rx: 10, ry: 6 },
    ],
    pneumothorax: true,
    effusion: true,
    priority: 'STAT',
    report: [
      { text: 'PA chest radiograph.' },
      { text: 'Visceral pleural line at the right apex with absent peripheral lung markings, in keeping with a right pneumothorax.', finding: 'Pneumothorax' },
      { text: 'Small right pleural effusion blunting the costophrenic angle.', finding: 'Effusion' },
      { text: 'Heart size within normal limits. No mediastinal shift.' },
      { text: 'Impression: right pneumothorax. Urgent clinical correlation advised.' },
    ],
  },
  {
    id: 'followup',
    title: 'Solitary nodule',
    summary: 'Urgent, follow-up scheduled',
    accession: 'CR-2047',
    age: '61 F',
    view: 'PA',
    scores: { ...base, Nodule: 0.46, Mass: 0.12, Infiltration: 0.17, Fibrosis: 0.09 },
    regions: [{ pathology: 'Nodule', cx: 66, cy: 44, rx: 5, ry: 5 }],
    nodule: true,
    priority: 'URGENT',
    prior: 'CR-1733 · 14 months earlier: nodule not visible.',
    report: [
      { text: 'PA chest radiograph, compared with CR-1733.' },
      { text: 'New well-defined nodular opacity in the left mid zone, approximately 9 mm.', finding: 'Nodule' },
      { text: 'Lungs otherwise clear. Heart size normal. No pleural effusion.' },
      { text: 'Impression: new left mid-zone nodule. CT chest recommended.' },
    ],
    followUp: 'CT chest within 3 months (Fleischner, solid nodule 8 mm or larger).',
  },
  {
    id: 'normal',
    title: 'No acute findings',
    summary: 'Routine, report ready',
    accession: 'CR-2052',
    age: '28 F',
    view: 'PA',
    scores: { ...base },
    regions: [],
    priority: 'ROUTINE',
    report: [
      { text: 'PA chest radiograph.' },
      { text: 'Lungs clear. No focal consolidation, effusion or pneumothorax.' },
      { text: 'Heart size and mediastinal contour within normal limits.' },
      { text: 'Impression: no acute cardiopulmonary abnormality.' },
    ],
  },
];

export const positives = (s: SampleStudy) =>
  PATHOLOGIES.filter((p) => s.scores[p] >= THRESHOLDS[p]).sort((a, b) => s.scores[b] - s.scores[a]);

export type Autonomy = 'L0' | 'L1' | 'L2';

export const AUTONOMY: Record<Autonomy, string> = {
  L0: 'Suggests only',
  L1: 'Acts after approval',
  L2: 'Acts on non-clinical tasks',
};

export interface PipelineStep {
  key: string;
  name: string;
  kind: 'agent' | 'model';
  autonomy?: Autonomy;
  /** What the step reports for a given study. */
  output: (s: SampleStudy) => string[];
}

const SLA: Record<Priority, string> = { STAT: '15 min', URGENT: '60 min', ROUTINE: '24 h' };

/** The order a chest X-ray study moves through the platform. */
export const PIPELINE: PipelineStep[] = [
  {
    key: 'intake',
    name: 'Intake & Quality',
    kind: 'agent',
    autonomy: 'L2',
    output: (s) => [
      `DICOM conformant · modality CR · body part CHEST`,
      `View ${s.view} detected · laterality marker found`,
      'Exposure and positioning acceptable · quality 0.95',
    ],
  },
  {
    key: 'privacy',
    name: 'Consent & Privacy',
    kind: 'agent',
    autonomy: 'L2',
    output: () => ['Consent on file for clinical care', 'Burned-in text and PHI tags removed before inference'],
  },
  {
    key: 'routing',
    name: 'Routing',
    kind: 'agent',
    autonomy: 'L2',
    output: () => ['Chest X-ray → DenseNet-121 (14 labels)', 'Fallback ready: ResNet-18 on the same labels'],
  },
  {
    key: 'model',
    name: 'DenseNet-121 inference',
    kind: 'model',
    output: (s) => {
      const pos = positives(s);
      return [
        '14 sigmoid scores vs per-class thresholds',
        pos.length ? `Above threshold: ${pos.map((p) => `${label(p)} ${s.scores[p].toFixed(2)}`).join(', ')}` : 'No label above its threshold',
        s.regions.length ? `${s.regions.length} focus map${s.regions.length > 1 ? 's' : ''} generated` : 'Focus maps: nothing to localise',
      ];
    },
  },
  {
    key: 'triage',
    name: 'Triage & Escalation',
    kind: 'agent',
    autonomy: 'L1',
    output: (s) => {
      const crit = positives(s).filter((p) => CRITICAL.has(p));
      return [
        `Priority ${s.priority} · read within ${SLA[s.priority]}`,
        crit.length ? `Critical: ${crit.map(label).join(', ')} · pager drafted, awaiting radiologist approval` : 'No critical finding · worklist re-ranked',
      ];
    },
  },
  {
    key: 'longitudinal',
    name: 'Longitudinal comparison',
    kind: 'agent',
    autonomy: 'L0',
    output: (s) => [s.prior ?? 'No prior chest imaging found'],
  },
  {
    key: 'report',
    name: 'Report drafting',
    kind: 'agent',
    autonomy: 'L0',
    output: (s) => [`${s.report.length} sentences drafted, each grounded in a finding or a normal check`, 'Waiting for radiologist review and e-sign'],
  },
  {
    key: 'referral',
    name: 'Referral & Follow-up',
    kind: 'agent',
    autonomy: 'L1',
    output: (s) => [s.followUp ? `Suggested: ${s.followUp}` : 'No follow-up guideline triggered'],
  },
  {
    key: 'qa',
    name: 'Model QA',
    kind: 'agent',
    autonomy: 'L0',
    output: () => ['Scores logged for drift monitoring (PSI)', 'Radiologist edits will count toward the override rate'],
  },
];

export const AGENTS: Array<{ name: string; autonomy: Autonomy; role: string }> = [
  { name: 'Intake & Quality', autonomy: 'L2', role: 'Rejects wrong body part, view or laterality, and under-exposed films, before any model sees them.' },
  { name: 'Consent & Privacy', autonomy: 'L2', role: 'Checks purpose-specific consent and strips PHI, including burned-in text on the radiograph.' },
  { name: 'Routing', autonomy: 'L2', role: 'Sends the study to DenseNet-121 and falls back to ResNet-18 if the primary endpoint fails.' },
  { name: 'Triage & Escalation', autonomy: 'L1', role: 'Re-ranks the worklist, runs SLA timers and drafts a STAT page for a pneumothorax. A human approves it.' },
  { name: 'Longitudinal comparison', autonomy: 'L0', role: 'Finds prior chest films and summarises interval change, such as a new nodule.' },
  { name: 'Report drafting', autonomy: 'L0', role: 'Drafts the report in the hospital template. Every sentence points to a finding. Nothing is sent unsigned.' },
  { name: 'Referral & Follow-up', autonomy: 'L1', role: 'Matches findings to guidelines such as Fleischner and tracks the follow-up until it is closed.' },
  { name: 'Model QA', autonomy: 'L0', role: 'Watches override rates, score drift and per-site scanner differences, and raises alerts.' },
  { name: 'Support', autonomy: 'L0', role: 'Answers PACS, DICOM and API configuration questions for the imaging team.' },
];
