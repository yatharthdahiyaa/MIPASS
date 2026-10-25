import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - node:sqlite built-in in Node 22+ runtime
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Priority order of accessible models on this key
const MODEL_CANDIDATES = [
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ReportedFinding {
  name?: string;
  pathology?: string;
  percentage?: number;
  probability?: number;
}

async function callGroqChat(messages: ChatMessage[], maxTokens = 1200, temperature = 0.3) {
  if (!GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is not configured. Set it in frontend/.env.local to enable AI narrative generation.'
    );
  }

  let lastError: Error | null = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MiPAAS-Clinical-Agent/1.0',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Groq] Model ${model} returned ${response.status}: ${errorText}`);
        lastError = new Error(`Groq ${model} status ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { content, modelUsed: model, usage: data.usage };
      }
    } catch (err: unknown) {
      console.warn(`[Groq] Failed with model ${model}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All Groq models failed to respond.');
}

function getDatabase(): DatabaseSync | null {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), '..', 'backend', 'mipaas_central.db'),
      path.resolve(process.cwd(), 'backend', 'mipaas_central.db'),
      path.resolve(process.cwd(), 'mipaas_central.db'),
    ];
    let targetPath = possiblePaths[0];
    for (const p of possiblePaths) {
      // @ts-ignore
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        targetPath = p;
        break;
      }
    }
    return new DatabaseSync(targetPath);
  } catch (err) {
    console.warn('Failed connecting to central db in AI route:', err);
    return null;
  }
}

function getPatientClinicalContext() {
  try {
    const db = getDatabase();
    if (!db) return { patient: null, report: null };

    // Use the most recent patient record as fallback context. The caller can
    // override this with the patient name/report from the active session.
    const patientRow = db.prepare("SELECT * FROM clinical_patients ORDER BY created_at DESC LIMIT 1").get() as any;

    // Get latest procedure report
    const reportRow = db.prepare("SELECT * FROM procedure_reports ORDER BY created_at DESC LIMIT 1").get() as any;

    const patientName = patientRow ? `${patientRow.fname || ''} ${patientRow.lname || ''}`.trim() : null;

    return {
      patient: patientRow ? {
        id: patientRow.id,
        name: patientName,
        mrn: patientRow.mrn,
        primaryDiagnosis: patientRow.conditions_json ? (JSON.parse(patientRow.conditions_json)[0] || null) : null,
      } : null,
      report: reportRow ? {
        id: reportRow.id,
        findings: reportRow.findings,
        impression: reportRow.impression,
        recommendation: reportRow.recommendations,
        confidence: reportRow.confidence != null ? Number(reportRow.confidence) : null,
        riskLevel: reportRow.risk_level || null,
        serviceName: reportRow.service_name || null,
      } : null,
    };
  } catch (err) {
    console.error('Failed reading clinical database for AI context:', err);
    return { patient: null, report: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = 'summary',
      userQuery,
      messages: incomingHistory,
      serviceId = 'qxr',
      serviceName: incomingServiceName,
      modality: incomingModality,
      architecture: incomingArchitecture,
      language = 'en',
      customFinding,
      confidence: incomingConfidence,
      severity: incomingSeverity,
      urgency: incomingUrgency,
      impression: incomingImpression,
      attributionNarrative: incomingAttribution,
      findingsList: incomingFindingsList,
      saliencyAnalysis,
      allPathologies,
      indeterminateFindings,
      patientReport,
      patientName: incomingPatientName,
      reportId: incomingReportId,
      demoMode = false,
      modelAvailability,
      noHighConfidenceFinding = false,
      candidateDiagnosis,
    } = body;

    const INDIC_LANGUAGES: Record<string, { name: string; native: string; script: string }> = {
      'en': { name: 'English (India)', native: 'English', script: 'Latin' },
      'hi': { name: 'Hindi', native: 'हिन्दी', script: 'Devanagari' },
      'ta': { name: 'Tamil', native: 'தமிழ்', script: 'Tamil' },
      'te': { name: 'Telugu', native: 'తెలుగు', script: 'Telugu' },
      'bn': { name: 'Bengali', native: 'বাংলা', script: 'Bengali' },
      'mr': { name: 'Marathi', native: 'मराठी', script: 'Devanagari' },
      'gu': { name: 'Gujarati', native: 'ગુજરાતી', script: 'Gujarati' },
      'kn': { name: 'Kannada', native: 'ಕನ್ನಡ', script: 'Kannada' },
      'ml': { name: 'Malayalam', native: 'മലയാളം', script: 'Malayalam' },
      'pa': { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', script: 'Gurmukhi' },
      'or': { name: 'Odia', native: 'ଓଡ଼ିଆ', script: 'Odia' },
    };

    const targetLang = INDIC_LANGUAGES[language] || INDIC_LANGUAGES['en'];

    const SERVICE_PROFILES: Record<string, {
      modalityName: string;
      architectureName: string;
      specialistRole: string;
      anatomicalDomain: string;
      clinicalGuidelines: string;
    }> = {
      'qxr': {
        modalityName: 'Chest Radiography (CXR)',
        architectureName: 'TorchXRayVision DenseNet-121 Multi-Label Chest Classifier',
        specialistRole: 'pulmonologist / thoracic radiologist',
        anatomicalDomain: 'pulmonary parenchyma, pleura, cardiac silhouette, and mediastinum',
        clinicalGuidelines: 'Explain findings like infiltrates, effusion, cardiomegaly, or pneumothorax in plain terms with thoracic care recommendations.',
      },
      'tb': {
        modalityName: 'CXR CAD4TB Class-II Screening',
        architectureName: 'CAD4TB Class-II Deep Residual Triage Network',
        specialistRole: 'infectious disease specialist / pulmonologist',
        anatomicalDomain: 'apical pulmonary parenchyma, cavitary lesions, and hilar lymphadenopathy',
        clinicalGuidelines: 'Explain tuberculosis indicators, smear/GeneXpert sputum diagnostic confirmation, airborne isolation precautions, and anti-tubercular therapy (DOTS).',
      },
      'lung-cancer': {
        modalityName: 'Low-Dose Chest CT (LDCT)',
        architectureName: '3D DenseNet-121 + ResNet Voxel Nodule Classifier (Lung-RADS v1.1)',
        specialistRole: 'thoracic oncologist / interventional pulmonologist',
        anatomicalDomain: 'pulmonary nodules, ground-glass opacities, and bronchial tree',
        clinicalGuidelines: 'Explain Lung-RADS classification, volumetric doubling time, low-dose surveillance CT follow-up vs. PET-CT/biopsy without causing excessive panic.',
      },
      'brain-tumor': {
        modalityName: 'Multi-Sequence Brain MRI (T1, T1c, T2, FLAIR)',
        architectureName: 'BraTS SegResNet + 3D DenseNet WHO Glioma Grading Network',
        specialistRole: 'neuro-oncologist / neurosurgeon',
        anatomicalDomain: 'cerebral hemispheres, peritumoral vasogenic edema, and enhancing tumor core',
        clinicalGuidelines: 'Explain intracranial lesion morphology, edema management, surgical stereotactic biopsy/resection planning, and multidisciplinary neuro-oncology tumor board review.',
      },
      'cardiac': {
        modalityName: 'Cine Cardiac MRI',
        architectureName: 'ACDC Deep U-Net Multi-Chamber Volumetry & Strain Engine',
        specialistRole: 'cardiologist / cardiac MRI specialist',
        anatomicalDomain: 'left and right ventricles, myocardial thickness, ejection fraction, and AHA 17-segment wall motion',
        clinicalGuidelines: 'Explain ejection fraction (LVEF/RVEF), myocardial wall motion abnormalities, heart failure management, and cardio-protective pharmacotherapy.',
      },
      'stroke': {
        modalityName: 'Non-Contrast Head CT & CTA',
        architectureName: 'Deep ASPECTS & Circle of Willis LVO Detector',
        specialistRole: 'vascular neurologist / neuro-interventionalist',
        anatomicalDomain: 'MCA/ICA vascular territories, ASPECTS 10-region ischemic core, and penumbral tissue',
        clinicalGuidelines: 'Explain ischemic vs hemorrhagic signs, emergent thrombectomy / IV thrombolysis window, blood pressure stabilization, and stroke unit admission.',
      },
      'skin-cancer': {
        modalityName: 'High-Resolution Dermoscopy',
        architectureName: 'HAM10000 7-Class Deep EfficientNet-B4 Ensemble',
        specialistRole: 'dermatologist / cutaneous oncologist',
        anatomicalDomain: 'epidermal and dermal melanocytic architecture, atypical network, and pigment globules',
        clinicalGuidelines: 'Explain ABCDE criteria (Asymmetry, Border, Color, Diameter, Evolution), full-thickness excisional biopsy, dermoscopic surveillance, and sun protection.',
      },
      'diabetic-foot': {
        modalityName: 'Plantar Angiosome Infrared Thermography',
        architectureName: 'Deep Thermal Plantar Angiosome Bilateral Asymmetry Analyzer',
        specialistRole: 'podiatrist / endocrinologist / vascular surgeon',
        anatomicalDomain: 'plantar angiosomes (medial/lateral plantar, calcaneal), neuropathic pressure points, and microvascular perfusion',
        clinicalGuidelines: 'Explain bilateral skin temperature asymmetry (ΔT > 2.2°C), pre-ulcerative hot spots, offloading orthotics, daily foot inspection, and glycemic control.',
      },
      'qer': {
        modalityName: 'Emergency Non-Contrast Head CT',
        architectureName: 'Deep Emergency Neuro-Trauma & Intracranial Hemorrhage Classifier',
        specialistRole: 'emergency trauma radiologist / neurosurgeon',
        anatomicalDomain: 'intracranial compartments (epidural, subdural, subarachnoid, intraparenchymal) and midline shift',
        clinicalGuidelines: 'Explain urgent intracranial hemorrhage evaluation, mass effect, trauma triage, ICU neurological monitoring, and emergency surgical decompression indications.',
      },
    };

    const profile = SERVICE_PROFILES[serviceId] || {
      modalityName: incomingModality || 'Medical Diagnostic Study',
      architectureName: incomingArchitecture || 'Deep Neural Diagnostic Network',
      specialistRole: 'specialist physician and clinical radiologist',
      anatomicalDomain: 'relevant anatomical tissue and pathology borders',
      clinicalGuidelines: 'Explain the diagnostic findings clearly, calmly, and objectively, recommending appropriate clinical correlation.',
    };

    const modalityName = incomingModality || profile.modalityName;
    const architectureName = incomingArchitecture || profile.architectureName;
    const specialistRole = profile.specialistRole;

    const { patient, report } = getPatientClinicalContext();

    // Never fall back to the most recent patient in the database: that could
    // attach another person's name to this report.  Callers that know the
    // patient must send incomingPatientName explicitly.
    const patientName = incomingPatientName || 'the patient';
    const isDemo = Boolean(demoMode) || Boolean(modelAvailability && modelAvailability.available === false);

    const candidate = candidateDiagnosis || null;
    let primaryDiagnosis: string;
    if (isDemo) {
      primaryDiagnosis = 'DEMO ONLY — no trained model output';
    } else if (noHighConfidenceFinding) {
      primaryDiagnosis = candidate
        ? `No high-confidence abnormality detected (top borderline signal: ${candidate})`
        : 'No high-confidence abnormality detected';
    } else {
      primaryDiagnosis =
        customFinding ||
        report?.findings ||
        patient?.primaryDiagnosis ||
        'No primary finding was provided.';
    }

    let confidencePct = 'not provided';
    if (incomingConfidence !== undefined && incomingConfidence !== null && incomingConfidence !== '') {
      confidencePct =
        typeof incomingConfidence === 'number'
          ? incomingConfidence > 1
            ? `${incomingConfidence.toFixed(1)}%`
            : `${(incomingConfidence * 100).toFixed(1)}%`
          : String(incomingConfidence);
    } else if (report?.confidence != null) {
      confidencePct = `${(report.confidence * 100).toFixed(1)}%`;
    }

    const riskLevel =
      incomingSeverity || incomingUrgency || report?.riskLevel || 'not classified';
    const impression =
      incomingImpression ||
      report?.impression ||
      'No clinician impression is attached to this AI output.';

    const saliency = saliencyAnalysis || null;
    const saliencyLocalization = saliency?.localization_sentence
      ? `${saliency.localization_sentence} ${saliency.laterality_note || ''}`.trim()
      : incomingAttribution || 'No heatmap localization was provided.';
    const where = patientReport?.where_the_ai_looked || null;
    const structuredReport = patientReport || null;

    let extraFindingsText = '';
    if (Array.isArray(incomingFindingsList) && incomingFindingsList.length > 0) {
      extraFindingsText =
        'High-confidence findings: ' +
        (incomingFindingsList as ReportedFinding[])
          .map(
            (f) =>
              `${f.name || f.pathology || 'unknown'} (${
                f.percentage ??
                (f.probability != null ? (f.probability * 100).toFixed(1) : '?')
              }%)`
          )
          .join(', ');
    }
    if (Array.isArray(indeterminateFindings) && indeterminateFindings.length > 0) {
      const list = (indeterminateFindings as ReportedFinding[])
        .slice(0, 6)
        .map(
          (f) =>
            `${f.name || f.pathology || 'unknown'} (${
              f.percentage ??
              (f.probability != null ? (f.probability * 100).toFixed(1) : '?')
            }%)`
        )
        .join(', ');
      extraFindingsText += `${extraFindingsText ? '\n' : ''}Borderline findings (NOT diagnoses): ${list}`;
    }

    const topPathologies = Array.isArray(allPathologies)
      ? (allPathologies as ReportedFinding[])
          .slice(0, 6)
          .map((p) => `${p.name || p.pathology || 'unknown'} ${p.percentage ?? '?'}%`)
          .join('; ')
      : '';

    const structuredReportText = structuredReport
      ? [
          `Headline: ${structuredReport.headline || ''}`,
          `What was found: ${structuredReport.what_we_found || ''}`,
          `What it means: ${structuredReport.what_it_means || ''}`,
          `Where the AI looked: ${where?.explanation || 'not provided'} ${where?.laterality_note || ''}`.trim(),
          `Concordance: ${where?.concordance || 'not assessed'} — ${where?.concordance_note || ''}`.trim(),
          `Possible causes (NOT confirmed): ${(structuredReport.possible_causes || []).join('; ') || 'not provided'}`,
          `How serious: ${structuredReport.how_serious || ''}`,
          `Next steps: ${(structuredReport.next_steps || []).join('; ') || 'not provided'}`,
          `Red flags: ${(structuredReport.red_flags || []).join('; ') || 'not provided'}`,
          `Questions for doctor: ${(structuredReport.questions_for_doctor || []).join('; ') || 'not provided'}`,
          `Borderline note: ${structuredReport.indeterminate_note || 'none'}`,
          `Heatmap caveat: ${structuredReport.heatmap_caveat || ''}`,
          `Demo notice: ${structuredReport.demo_notice || 'none'}`,
          `Scan limitation: ${structuredReport.scan_limitation || ''}`,
        ]
          .filter(Boolean)
          .join('\n')
      : 'No structured patient report was provided. Use only the context above and do not invent findings.';

    const systemPrompt = `You are the MiPAAS AI Patient Communication Assistant. You are NOT a certified diagnostician and you must never claim that an AI output is a confirmed diagnosis.
Your job is to explain ${modalityName} results in clear, calm, plain language for a patient and their family, using the structured report below as the source of truth.

CURRENT PATIENT & STUDY CONTEXT:
- Patient: ${patientName}
- Target service: ${incomingServiceName || serviceId}
- Modality: ${modalityName}
- Model: ${architectureName}
- Demo mode: ${isDemo ? 'YES — no trained model checkpoint is loaded for this service' : 'no'}
- High-confidence finding status: ${noHighConfidenceFinding ? 'NONE — no finding above the high-confidence cutoff' : 'one or more high-confidence AI flags present'}
- Primary AI result: ${primaryDiagnosis}
- Top model score: ${confidencePct} (this is a model score, not a probability that the patient has the disease)
- Severity / urgency supplied by the pipeline: ${riskLevel}
- Pipeline narrative: ${impression}
- Heatmap localization (from the actual saliency map): ${saliencyLocalization}
- Image side: ${saliency?.image_side || where?.image_side || 'not provided'}
- Patient side: ${saliency?.patient_side || where?.patient_side || 'not provided'}
- Heatmap is localized: ${saliency?.is_localized != null ? (saliency.is_localized ? 'yes' : 'no — diffuse') : 'not provided'}
- Top model scores: ${topPathologies || 'not provided'}
${extraFindingsText ? `- ${extraFindingsText}` : ''}

SOURCE OF TRUTH — STRUCTURED PATIENT REPORT:
${structuredReportText}

RULES:
1. Never call this a "certified diagnosis" or a confirmed disease. Use "AI flag", "possible", "borderline signal", or "pattern".
2. If demo mode is YES, start by clearly stating that this is a demo, no trained model is loaded, the numbers/heatmap are synthetic, and the output must not be used for health decisions. Do not give disease-specific treatment instructions for a demo.
3. If high-confidence status is NONE, say clearly that there is no high-confidence abnormality. Explain the top borderline candidate only as a weak signal to discuss with a doctor, not as a diagnosis. Do not use alarming language.
4. For location: use the heatmap localization above. Always distinguish "side of the image" from "patient's side". On a standard PA/AP chest X-ray, image-left is the patient's right. If the heatmap is diffuse or discordant, say the location is approximate.
5. Possible causes are possibilities, not confirmed causes. A scan cannot prove the root cause. Do not invent patient history, medicines, or findings.
6. Include all of these sections, in this order, using markdown headings:
   - Plain-language summary
   - What we found
   - Where the AI looked (heatmap, image side vs patient side)
   - Possible causes (not confirmed)
   - How serious is it?
   - What to do next
   - Red-flag symptoms (seek urgent care)
   - Questions to ask your doctor
7. Be warm and honest. Do not over-reassure if red flags are present. Do not minimize a high-confidence finding.
8. If the preferred language is not English, write the entire response in ${targetLang.name} (${targetLang.native}) using ${targetLang.script}, keeping the English clinical term in parentheses. If the language is English, write in simple English.
9. Keep the patient report as the primary source. Do not contradict it. If the structured report is missing a detail, say it is not available rather than inventing it.`;

    // ─────────────────────────────────────────────────────────
    // ACTION 1: Comprehensive Initial Analysis / AI Review
    // ─────────────────────────────────────────────────────────
    if (action === 'summary' || action === 'review') {
      const summaryFocus = isDemo
        ? 'This result is DEMO MODE ONLY. No trained model is loaded for this service. State this clearly at the start and do not interpret the synthetic score or heatmap as a real finding. Explain that the patient should use a validated service or speak to a clinician.'
        : noHighConfidenceFinding
        ? `The pipeline found NO high-confidence abnormality. Explain that clearly. The top borderline candidate is ${candidate || 'not available'} at ${confidencePct}; explain that this is a weak signal, not a diagnosis, and what the patient should discuss with their doctor. Do not alarm the patient.`
        : `The pipeline flagged a high-confidence AI finding: ${primaryDiagnosis} at ${confidencePct}. Explain it as a possible condition that needs clinical correlation, not as a confirmed diagnosis.`;

      const prompt = `Please write a patient-friendly, plain-language report for ${patientName} based on the structured data above.

${summaryFocus}

Use the following headings:
1. Plain-language summary
2. What we found
3. Where the AI looked (heatmap, image side vs patient side)
4. Possible causes (not confirmed)
5. How serious is it?
6. What to do next
7. Red-flag symptoms — seek urgent care
8. Questions to ask your doctor

Requirements:
- Use the structured patient report as the source of truth. Do not invent findings, causes, tests, or patient history.
- Do not call the result a diagnosis or "certified".
- Explain medical terms in simple analogies.
- If the heatmap is diffuse or discordant, say the location is approximate.
- Mention that an X-ray/scan cannot prove the root cause.
- If demo mode, state prominently that this is a demo and not for clinical decisions.
- Write in ${targetLang.name} (${targetLang.native}) using ${targetLang.script} if the language is not English, keeping English clinical terms in parentheses. Otherwise write in simple English.
- Keep it calm, honest, and actionable.`;

      const result = await callGroqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ], 1500, 0.2);

      return NextResponse.json({
        success: true,
        analysis: result.content,
        modelUsed: result.modelUsed,
        context: {
          patientName,
          reportId: incomingReportId || report?.id || null,
          serviceId,
          modalityName,
          architectureName,
          primaryDiagnosis,
          confidencePct,
          riskLevel,
          impression,
          demoMode: isDemo,
          noHighConfidenceFinding,
          candidateDiagnosis: candidate,
          saliencyLocalization,
          imageSide: saliency?.image_side || where?.image_side || null,
          patientSide: saliency?.patient_side || where?.patient_side || null,
          language: targetLang,
        },
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION 2: Interactive Conversational Q&A
    // ─────────────────────────────────────────────────────────
    if (action === 'chat') {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (Array.isArray(incomingHistory)) {
        for (const msg of incomingHistory.slice(-8)) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      if (userQuery) {
        messages.push({ role: 'user', content: userQuery });
      }

      const result = await callGroqChat(messages, 800, 0.4);

      return NextResponse.json({
        success: true,
        reply: result.content,
        modelUsed: result.modelUsed,
        language: targetLang,
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION 3: Generate Doctor Consultation Checklist
    // ─────────────────────────────────────────────────────────
    if (action === 'doctor_questions') {
      const questionFocus = isDemo
        ? 'This is a demo result with no trained model. Generate questions asking whether the scan should be repeated with a validated service, what symptoms warrant urgent care, and how to get a proper radiology review. Do not imply a diagnosis.'
        : noHighConfidenceFinding
        ? `The AI found no high-confidence abnormality. The top borderline candidate is ${candidate || 'not available'}. Generate questions about whether follow-up is needed, what symptoms to watch, and how to interpret a borderline AI result. Do not imply a diagnosis.`
        : `The AI flagged ${primaryDiagnosis}. Generate questions about what the finding means, what tests can confirm or exclude it, and which red-flag symptoms need urgent care.`;

      const prompt = `Generate a printable, prioritized checklist of 6 specific questions for ${patientName} to ask their ${specialistRole}.

${questionFocus}

Use ${targetLang.name} (${targetLang.native}) with English clinical terms in parentheses if the preferred language is not English. Do not invent findings or treatments.`;

      const result = await callGroqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ], 800, 0.2);

      return NextResponse.json({
        success: true,
        checklist: result.content,
        modelUsed: result.modelUsed,
        language: targetLang,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Patient AI Analysis error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
