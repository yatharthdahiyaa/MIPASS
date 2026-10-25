import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Sparkles, Home, Activity } from 'lucide-react';
import PatientAIAnalysis from '@/components/patient/PatientAIAnalysis';

export const metadata: Metadata = {
  title: 'AI Diagnostic Analysis · MiPAAS Patient Intelligence',
  description:
    'Patient AI analysis powered by Groq LPU: instant plain-language radiological findings breakdown, Grad-CAM saliency explanations, and clinical Q&A.',
};

export default function PatientAnalysisPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-16">
      {/* Top Breadcrumb Nav */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/patient"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Patient Portal</span>
            </Link>

            <span className="text-slate-300">/</span>

            <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Clinical Analysis</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Link
              href="/emr"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>EHR Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-700">Loading AI Clinical Analysis...</p>
            </div>
          }
        >
          <PatientAIAnalysis />
        </Suspense>
      </main>
    </div>
  );
}
