'use client';

import React from 'react';
import { FileText, BarChart3, ShieldCheck } from 'lucide-react';
import { useIndicLanguage } from '@/context/IndicLanguageContext';

interface FeatureCardItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

export default function FeatureCards() {
  const { t } = useIndicLanguage();

  const cards: FeatureCardItem[] = [
    {
      icon: FileText,
      title: t('card_research_title'),
      description: t('card_research_desc'),
    },
    {
      icon: BarChart3,
      title: t('card_trials_title'),
      description: t('card_trials_desc'),
    },
    {
      icon: ShieldCheck,
      title: t('card_compliance_title'),
      description: t('card_compliance_desc'),
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 relative z-20 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="group p-6 rounded-2xl bg-white/85 hover:bg-white border border-white/80 transition-all duration-300 shadow-[0_10px_30px_rgba(30,58,138,0.06)] hover:shadow-[0_16px_36px_rgba(30,58,138,0.12)] backdrop-blur-xl flex items-start gap-4 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                <Icon className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">
                  {card.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  {card.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
