'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Bot,
  User,
  Send,
  Download,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  FileText,
  Activity,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  Zap,
  HeartPulse,
  Info,
  Lock
} from 'lucide-react';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import { useRBAC } from '@/context/RBACContext';
import IndicLanguageSelector from '@/components/common/IndicLanguageSelector';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function MarkdownBlock({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let tableHeader: string[] | null = null;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listItems = [];
      listType = null;
      return;
    }
    const items = listItems.map((item, index) => (
      <li key={`li-${blocks.length}-${index}`}>{renderInline(item, `li-${blocks.length}-${index}`)}</li>
    ));
    blocks.push(
      listType === 'ol' ? (
        <ol key={`list-${blocks.length}`} className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5">{items}</ul>
      )
    );
    listItems = [];
    listType = null;
  };

  const flushTable = () => {
    if (!tableHeader) return;
    const header = tableHeader;
    const rows = tableRows;
    const key = `table-${blocks.length}`;
    blocks.push(
      <div key={key} className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              {header.map((cell, index) => (
                <th key={`${key}-h-${index}`} className="border-b border-slate-200 px-2.5 py-1.5 font-bold">
                  {renderInline(cell, `${key}-h-${index}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${key}-r-${rowIndex}`} className="even:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td key={`${key}-r-${rowIndex}-c-${cellIndex}`} className="border-b border-slate-100 px-2.5 py-1.5 align-top">
                    {renderInline(cell, `${key}-r-${rowIndex}-c-${cellIndex}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeader = null;
    tableRows = [];
  };

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushTable();
      return;
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return;
      if (!tableHeader) {
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    }
    flushTable();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push(
        <h4 key={`h-${lineIndex}`} className="text-xs font-extrabold text-slate-900">
          {renderInline(heading[2], `h-${lineIndex}`)}
        </h4>
      );
      return;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bullet[1]);
      return;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ordered[1]);
      return;
    }
    flushList();
    if (/^---+$/.test(line)) {
      blocks.push(<hr key={`hr-${lineIndex}`} className="border-slate-200" />);
      return;
    }
    blocks.push(
      <p key={`p-${lineIndex}`}>{renderInline(line, `p-${lineIndex}`)}</p>
    );
  });

  flushList();
  flushTable();

  return <div className={`space-y-2 leading-relaxed ${className}`}>{blocks}</div>;
}

export interface PatientAIAnalysisProps {
  scanResult?: {
    service_id?: string;
    service_name?: string;
    primary_diagnosis?: string;
    candidate_diagnosis?: string | null;
    no_high_confidence_finding?: boolean;
    confidence_percentage?: number;
    confidence_label?: string;
    severity?: string;
    urgency?: string;
    demo_mode?: boolean;
    model_availability?: {
      available: boolean;
      mode: string;
      model?: string;
      message?: string;
    };
    positive_findings?: Array<{ name: string; percentage: number; threshold_percentage?: number }>;
    indeterminate_findings?: Array<{ name: string; percentage: number; threshold_percentage?: number }>;
    all_pathologies?: Array<{
      name: string;
      percentage: number;
      threshold_percentage: number;
      tier?: string;
      tier_label?: string;
      description?: string;
    }>;
    saliency_analysis?: {
      dominant_zone_label?: string;
      dominant_share_pct?: number;
      is_localized?: boolean;
      localization_sentence?: string;
      image_side?: string;
      patient_side?: string;
      laterality_note?: string;
    };
    patient_report?: {
      headline?: string;
      what_we_found?: string;
      what_it_means?: string;
      possible_causes?: string[];
      how_serious?: string;
      next_steps?: string[];
      red_flags?: string[];
      questions_for_doctor?: string[];
      indeterminate_note?: string | null;
      demo_notice?: string | null;
      scan_limitation?: string;
      heatmap_caveat?: string;
      disclaimer?: string;
    };
    report?: any;
    stages?: any;
  } | null;
  onBackToDiagnostic?: () => void;
}

export default function PatientAIAnalysis({ scanResult, onBackToDiagnostic }: PatientAIAnalysisProps = {}) {
  const { currentLanguage, t } = useIndicLanguage();
  const { currentUser, isAuthenticated, isSessionReady } = useRBAC();
  const hasScan = Boolean(scanResult);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('openai/gpt-oss-120b');
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const activeFinding = scanResult?.primary_diagnosis || 'No scan linked';
  const isDemo = Boolean(scanResult?.demo_mode);
  const activeConfidence = isDemo
    ? 'not scored'
    : scanResult?.confidence_percentage != null
    ? `${scanResult.confidence_percentage}%`
    : '—';
  const activeSeverity = scanResult?.severity || 'Unknown';
  const noHighConfidence = Boolean(scanResult?.no_high_confidence_finding) && !isDemo;
  const candidateFinding = scanResult?.candidate_diagnosis || null;
  const findingContext = !scanResult
    ? 'No diagnostic scan linked to this session'
    : isDemo
    ? 'Demo mode — the numbers and heatmap are illustrative, not a diagnosis'
    : noHighConfidence
    ? `No high-confidence abnormality detected${candidateFinding ? `; top borderline signal: ${candidateFinding} (${activeConfidence})` : ''}`
    : `${activeFinding} (${activeConfidence} high-confidence model score)`;
  const patientLabel = scanResult?.report?.patient_identifier || 'Patient record not linked';

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Quick preset questions tailored to current Indian language
  const getPresetQuestions = () => {
    if (isDemo) {
      return [
        'What does demo mode mean for this scan?',
        'Why can\'t this service analyze my scan with a real model?',
        'What should I do with this demo result?',
        'Which service can analyze my scan for real?',
        'What warning signs mean I should seek emergency medical care immediately?',
      ];
    }
    switch (currentLanguage.code) {
      case 'hi':
        return [
          `सरल शब्दों में ${activeFinding} क्या है?`,
          `${activeFinding} होने के मुख्य कारण क्या हैं?`,
          `इसके लिए कौन से परीक्षण या उपचार की सिफारिश की जाती है?`,
          `किन चेतावनी संकेतों में मुझे तुरंत आपातकालीन देखभाल लेनी चाहिए?`,
          `अगली मुलाकात में मुझे डॉक्टर से क्या पूछना चाहिए?`,
        ];
      case 'bn':
        return [
          `সহজ ভাষায় ${activeFinding} কী?`,
          `${activeFinding} হওয়ার প্রধান কারণ কী?`,
          `এর জন্য কোন পরীক্ষা বা চিকিৎসার পরামর্শ দেওয়া হয়?`,
          `কোন লক্ষণ দেখলে অবিলম্বে জরুরি চিকিৎসা নেওয়া উচিত?`,
          `পরবর্তী সাক্ষাতে ডাক্তারের কাছে কী প্রশ্ন করা উচিত?`,
        ];
      case 'ta':
        return [
          `எளிய சொற்களில் ${activeFinding} என்றால் என்ன?`,
          `${activeFinding} ஏற்படுவதற்கான காரணங்கள் யாவை?`,
          `இதற்கு என்ன பரிசோதனைகள் பரிந்துரைக்கப்படுகின்றன?`,
          `எந்த அறிகுறிகளுக்கு அவசர சிகிச்சை பெற வேண்டும்?`,
          `அடுத்த சந்திப்பில் மருத்துவரிடம் என்ன கேட்க வேண்டும்?`,
        ];
      case 'te':
        return [
          `సరళమైన మాటలలో ${activeFinding} అంటే ఏమిటి?`,
          `${activeFinding} రావడానికి కారణాలు ఏమిటి?`,
          `దీనికి ఏ పరీక్షలు లేదా చికిత్సలు సిఫార్సు చేయబడ్డాయి?`,
          `ఏ సంకేతాలకు అత్యవసర వైద్య సంరక్షణ తీసుకోవాలి?`,
          `డాక్టర్‌ని నేను ఏ ప్రశ్నలు అడగాలి?`,
        ];
      case 'mr':
        return [
          `सोप्या शब्दांत ${activeFinding} म्हणजे काय?`,
          `${activeFinding} होण्याची मुख्य कारणे कोणती?`,
          `यासाठी कोणत्या तपासण्या किंवा उपचारांची शिफारस केली जाते?`,
          `कोणत्या धोक्याच्या लक्षणांवर आपत्कालीन मदत घेतली पाहिजे?`,
          `पुढील भेटीत मी डॉक्टरांना कोणते प्रश्न विचारले पाहिजेत?`,
        ];
      default:
        return [
          `What is ${activeFinding} in simple words?`,
          `What causes ${activeFinding} to develop?`,
          `What diagnostic tests or treatments are recommended for this?`,
          `What warning signs mean I should seek emergency medical care immediately?`,
          `What specific questions should I ask my doctor during our next appointment?`,
        ];
    }
  };

  const PRESET_QUESTIONS = getPresetQuestions();

  // Initial localized greeting
  const getInitialGreeting = () => {
    if (currentLanguage.code === 'hi') {
      return `नमस्ते! मैं आपका MiPAAS AI क्लिनिकल स्वास्थ्य साथी हूँ (Groq LPU द्वारा संचालित)। मैंने आपका ${scanResult?.service_name || 'डायग्नोस्टिक स्कैन'} विश्लेषण देखा है: **${findingContext}**। अपनी रिपोर्ट, चिकित्सा शब्दावली, या डॉक्टर से पूछे जाने वाले प्रश्नों के बारे में मुझसे कुछ भी पूछें।`;
    }
    if (currentLanguage.code === 'ta') {
      return `வணக்கம்! நான் உங்கள் MiPAAS AI மருத்துவ சுகாதார வழிகாட்டி (Groq LPU மூலம் இயங்குகிறது). உங்கள் ஆய்வு முடிவு: **${findingContext}**. உங்கள் ஸ்கேன் அல்லது மருத்துவ சந்தேகங்கள் குறித்து என்னிடம் கேட்கலாம்.`;
    }
    if (currentLanguage.code === 'te') {
      return `నమస్కారం! నేను మీ MiPAAS AI క్లినికల్ హెల్త్ కంపానియన్ (Groq LPU ద్వారా ఆధారితం). మీ అధ్యయన ఫలితం: **${findingContext}**. మీ సందేహాలు లేదా డాక్టర్‌ను అడగవలసిన ప్రశ్నల గురించి నన్ను అడగవచ్చు.`;
    }
    if (currentLanguage.code === 'bn') {
      return `নমস্কার! আমি আপনার MiPAAS AI ক্লিনিকাল হেলথ কম্প্যানিয়ন (Groq LPU দ্বারা পরিচালিত)। আপনার ফলাফল: **${findingContext}**। আপনার স্ক্যান বা চিকিৎসা সংক্রান্ত প্রশ্ন আমাকে নির্দ্বিধায় করতে পারেন।`;
    }
    return `Hello! I'm your MiPAAS AI Clinical Health Companion powered by Groq LPU inference. I have reviewed your latest ${scanResult?.service_name || 'diagnostic study'} analysis: **${findingContext}**. Ask me any questions about your scan, medical terms, what to expect, or questions to bring to your doctor.`;
  };

  // Fetch initial comprehensive AI clinical summary
  const loadSummary = async () => {
    if (!scanResult) {
      setIsLoadingSummary(false);
      setSummaryError(null);
      setAnalysisText('');
      return;
    }
    try {
      setIsLoadingSummary(true);
      setSummaryError(null);
      const res = await fetch('/api/ai/patient-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summary',
          language: currentLanguage.code,
          serviceId: scanResult?.service_id || 'qxr',
          serviceName: scanResult?.service_name,
          architecture: scanResult?.stages?.agent_5_ai_inference?.model_architecture,
          customFinding: activeFinding,
          confidence: isDemo ? undefined : scanResult?.confidence_percentage,
          severity: isDemo ? undefined : activeSeverity,
          urgency: scanResult?.urgency,
          impression: scanResult?.report?.findings_narrative || scanResult?.primary_diagnosis,
          attributionNarrative: scanResult?.stages?.agent_6_explainability?.attribution_narrative,
          findingsList: scanResult?.positive_findings,
          saliencyAnalysis: scanResult?.saliency_analysis,
          allPathologies: scanResult?.all_pathologies,
          indeterminateFindings: scanResult?.indeterminate_findings || [],
          patientReport: scanResult?.patient_report,
          reportId: scanResult?.report?.report_id,
          demoMode: isDemo,
          modelAvailability: scanResult?.model_availability,
          noHighConfidenceFinding: noHighConfidence,
          candidateDiagnosis: candidateFinding,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysisText(data.analysis);
        if (data.modelUsed) setModelUsed(data.modelUsed);
      } else {
        setSummaryError(data.error || 'Failed to generate AI analysis.');
      }
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (!scanResult) {
      setIsLoadingSummary(false);
      setSummaryError(null);
      setAnalysisText('');
      setChatMessages([
        {
          id: `msg-init-${currentLanguage.code}`,
          role: 'assistant',
          content: 'No diagnostic scan is linked to this session yet. Run a diagnostic study from the patient portal, then open its AI analysis.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }
    loadSummary();
    // Default initial greeting in the chat copilot
    setChatMessages([
      {
        id: `msg-init-${currentLanguage.code}`,
        role: 'assistant',
        content: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [activeFinding, activeConfidence, findingContext, currentLanguage.code, hasScan]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle sending a chat question
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isSending || !hasScan) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const historyPayload = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/patient-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          language: currentLanguage.code,
          userQuery: textToSend,
          messages: historyPayload,
          serviceId: scanResult?.service_id || 'qxr',
          serviceName: scanResult?.service_name,
          architecture: scanResult?.stages?.agent_5_ai_inference?.model_architecture,
          customFinding: activeFinding,
          confidence: isDemo ? undefined : scanResult?.confidence_percentage,
          severity: isDemo ? undefined : activeSeverity,
          urgency: scanResult?.urgency,
          impression: scanResult?.report?.findings_narrative || scanResult?.primary_diagnosis,
          attributionNarrative: scanResult?.stages?.agent_6_explainability?.attribution_narrative,
          saliencyAnalysis: scanResult?.saliency_analysis,
          allPathologies: scanResult?.all_pathologies,
          indeterminateFindings: scanResult?.indeterminate_findings || [],
          patientReport: scanResult?.patient_report,
          reportId: scanResult?.report?.report_id,
          demoMode: isDemo,
          modelAvailability: scanResult?.model_availability,
          noHighConfidenceFinding: noHighConfidence,
          candidateDiagnosis: candidateFinding,
        }),
      });

      const data = await res.json();
      if (data.success && data.reply) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        if (data.modelUsed) setModelUsed(data.modelUsed);
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: `Apologies, I encountered an issue processing your question: ${data.error || 'Connection error'}. Please try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `Network error: ${err instanceof Error ? err.message : String(err)}. Please check your internet connection.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadReport = () => {
    const pr = scanResult?.patient_report;
    const structuredPatientReport = pr
      ? [
          '--- PLAIN-LANGUAGE PATIENT REPORT ---',
          pr.headline || '',
          pr.what_we_found || '',
          pr.what_it_means || '',
          ...(pr.possible_causes && pr.possible_causes.length > 0
            ? ['Possible causes (not confirmed):', ...pr.possible_causes.map((c) => `- ${c}`)]
            : []),
          pr.how_serious || '',
          ...(pr.next_steps && pr.next_steps.length > 0
            ? ['Next steps:', ...pr.next_steps.map((s) => `- ${s}`)]
            : []),
          ...(pr.red_flags && pr.red_flags.length > 0
            ? ['Red-flag symptoms:', ...pr.red_flags.map((r) => `- ${r}`)]
            : []),
          ...(pr.questions_for_doctor && pr.questions_for_doctor.length > 0
            ? ['Questions for your doctor:', ...pr.questions_for_doctor.map((q) => `- ${q}`)]
            : []),
          pr.demo_notice || '',
          pr.scan_limitation || '',
          pr.heatmap_caveat || '',
          pr.disclaimer || '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const fullText = [
      `============================================================`,
      `MIPAAS AI-ASSISTED CLINICAL ANALYSIS REPORT`,
      `Patient: ${patientLabel} | Generated: ${new Date().toLocaleString()}`,
      `Result context: ${findingContext}`,
      `Engine: Groq LPU Acceleration · ${modelUsed}`,
      `============================================================\n`,
      structuredPatientReport || analysisText,
      `\n--- AI NARRATIVE ---\n`,
      analysisText,
      `\n============================================================`,
      `DISCLAIMER: This document is an automated AI-assisted educational report designed to support patient understanding. It does not constitute a definitive medical diagnosis. Please consult your physician for individualized medical care.`,
      `============================================================`,
    ].join('\n');

    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MiPAAS_AI_Analysis_Report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSessionReady) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Verifying patient session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || currentUser?.role !== 'patient') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0F9D9A]">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Patient Sign In Required</h2>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          AI diagnostic analysis is restricted to the patient who owns the scan. Sign in to a patient account to continue.
        </p>
        <Link
          href="/login?redirect=/patient/analysis"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0F9D9A] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0D8B88]"
        >
          <Lock className="h-4 w-4" />
          Sign In as Patient
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.3),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide">
              <Zap className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
              <span>Groq LPU Ultra-Fast Clinical Inference</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Patient AI Diagnostic Analysis</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed">
              Plain-language interpretation of your {scanResult?.service_name || 'diagnostic scan'} findings, anatomical explanations, red flag symptoms, and personalized doctor consultation guidance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Indian Language Selector */}
            <IndicLanguageSelector />

            {onBackToDiagnostic && (
              <button
                type="button"
                onClick={onBackToDiagnostic}
                className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>← Back to Scan Viewport</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadSummary}
              disabled={isLoadingSummary || !hasScan}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? 'animate-spin text-blue-400' : ''}`} />
              <span>Regenerate</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={!analysisText || !hasScan}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Live Context Strip */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span>Patient: <strong className="text-white">{patientLabel}</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>AI result: <strong className={isDemo || noHighConfidence ? 'text-amber-300' : 'text-rose-300'}>{findingContext}</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Model: <strong className="text-emerald-300 font-mono text-[11px]">{modelUsed}</strong></span>
          </div>
        </div>
      </div>

      {!hasScan && (
        <div role="alert" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-relaxed text-sky-900">
          <strong className="mb-1 block font-black uppercase tracking-wide">No diagnostic scan linked</strong>
          This page only explains a completed scan. Run a diagnostic study first, then open its AI analysis.{' '}
          <Link href="/patient" className="font-bold underline">
            Go to the diagnostic studio
          </Link>
          .
        </div>
      )}

      {(isDemo || noHighConfidence) && (
        <div
          className={`rounded-2xl border p-4 text-xs leading-relaxed ${
            isDemo
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <strong className="block font-black uppercase tracking-wide mb-1">
            {isDemo ? 'Demo mode — not a diagnosis' : 'No high-confidence abnormality detected'}
          </strong>
          {isDemo
            ? scanResult?.model_availability?.message ||
              'No trained model checkpoint is loaded for this service. The numbers and heatmap are illustrative only.'
            : `The AI did not find a pattern above its high-confidence cutoff. ${
                candidateFinding
                  ? `The top borderline signal was ${candidateFinding} at ${activeConfidence}; this is not a diagnosis.`
                  : ''
              }`}
        </div>
      )}

      {/* 2. Main Two-Column Analysis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (7 cols): Comprehensive Plain-English Radiology Breakdown */}
        <div className="lg:col-span-7 space-y-6">

          {/* AI Clinical Translation Card */}
          <div className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <FileText className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {currentLanguage.code !== 'en' ? `${currentLanguage.nativeName} ${t('ai_clinical_guidance')}` : 'AI-Assisted Plain-Language Summary'}
                    </h2>
                    {currentLanguage.code !== 'en' && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold">
                        🇮🇳 {currentLanguage.script} · AI4Bharat
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {currentLanguage.code !== 'en'
                      ? `AI4Bharat IndicTrans2 & Groq LPU क्लिनिकल अनुवाद (${currentLanguage.name})`
                      : 'Plain-language translation of radiologic findings'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(analysisText, 'summary')}
                className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                title="Copy text"
              >
                {copiedSection === 'summary' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Analysis Content */}
            <div className="mt-5 text-xs text-slate-700 leading-relaxed space-y-4">
              {!hasScan ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No scan is available to summarize. Start from the diagnostic studio and run an analysis first.
                </div>
              ) : isLoadingSummary ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-800">
                    Groq LPU is preparing your plain-language explanation...
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    {isDemo
                      ? 'Demo mode: no trained model is loaded for this service, so no clinical interpretation is being generated from real probabilities.'
                      : noHighConfidence
                      ? 'Explaining the screening result, the borderline signals, and what to discuss with your doctor.'
                      : 'Translating the image model findings and clinical recommendations into plain language.'}
                  </p>
                </div>
              ) : summaryError ? (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Analysis Error</span>
                  </div>
                  <p>{summaryError}</p>
                  <button
                    type="button"
                    onClick={loadSummary}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 cursor-pointer"
                  >
                    Retry Analysis
                  </button>
                </div>
              ) : (
                <MarkdownBlock text={analysisText} className="text-xs text-slate-700 font-normal" />
              )}
            </div>

            {/* Critical Clinical Notice Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-3 text-[11px] text-slate-500 bg-amber-50/60 p-3.5 rounded-2xl border-amber-100">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-900 font-bold">Important Patient Notice:</strong>{' '}
                This analysis is powered by calibrated medical neural networks and clinical reasoning models to help you understand your scan. It is intended to prepare you for your appointment and does not substitute for an in-person physical exam with a certified doctor.
              </div>
            </div>
          </div>

          {/* Saliency & Heatmap Explanation Card */}
          <div className="rounded-3xl bg-slate-50 border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                Explainable AI (Grad-CAM)
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 mt-1">Want to inspect the raw visual heatmap?</h3>
              <p className="text-xs text-slate-500">
                {scanResult?.saliency_analysis?.localization_sentence ||
                  'Open the visual saliency studio to inspect where the AI paid attention while scoring this scan.'}
              </p>
              {scanResult?.saliency_analysis?.laterality_note && (
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {scanResult.saliency_analysis.laterality_note}
                </p>
              )}
              <p className="text-[10px] text-amber-700 leading-relaxed">
                Heatmap attention is not proof of disease.
              </p>
            </div>
            <Link
              href="/patient"
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shrink-0 transition-all shadow-sm"
            >
              <span>Open Visual Saliency Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column (5 cols): Interactive Clinical Q&A Copilot */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">

          <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs flex-1 flex flex-col">
            {/* Copilot Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">AI Clinical Q&amp;A Copilot</h3>
                  <p className="text-[10px] text-slate-400">Ask any question about your scan &amp; care</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                Online
              </span>
            </div>

            {/* Quick Question Chips */}
            <div className="pt-3 pb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                Suggested Questions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_QUESTIONS.slice(0, 3).map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    disabled={isSending || !hasScan}
                    className="text-[10px] text-left px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-medium transition-colors cursor-pointer border border-slate-200/60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 min-h-[360px] max-h-[460px] overflow-y-auto space-y-3 p-3 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs">
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold shadow-2xs ${
                        isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                          : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-2xs'
                      }`}
                    >
                      {isUser ? msg.content : <MarkdownBlock text={msg.content} className="text-xs" />}
                      <div
                        className={`text-[9px] mt-1.5 text-right font-mono ${
                          isUser ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Groq AI is formulating response...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={hasScan ? 'Ask about your scan, symptoms, treatments...' : 'Run a diagnostic scan to enable the Q&A copilot'}
                disabled={isSending || !hasScan}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim() || !hasScan}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </button>
            </form>
          </div>

          {/* Quick Doctor Booking CTA */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 space-y-3 text-slate-800">
            <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-xs">
              <Stethoscope className="w-4 h-4 text-indigo-600" />
              <span>Recommended Medical Next Step</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              {isDemo
                ? 'This service is running in demo mode. No clinical recommendation can be made from synthetic output. Please consult a qualified clinician about any symptoms or concerns.'
                : noHighConfidence
                ? scanResult?.patient_report?.next_steps?.[1] ||
                  'No high-confidence abnormality was detected. Discuss any ongoing symptoms with your doctor and keep routine follow-up appointments.'
                : scanResult?.patient_report?.next_steps?.[0] ||
                  scanResult?.report?.recommendations?.[0] ||
                  `Discuss the ${activeFinding} finding with a qualified clinician and ask whether follow-up imaging is needed.`}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              <span>Go to Consultation Booking →</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
