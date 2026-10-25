'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useIndicLanguage } from '@/context/IndicLanguageContext';
import { Globe, Check, ChevronDown, Sparkles } from 'lucide-react';

interface IndicLanguageSelectorProps {
  className?: string;
  compact?: boolean;
}

export default function IndicLanguageSelector({ className = '', compact = false }: IndicLanguageSelectorProps) {
  const { language, setLanguage, currentLanguage, languages, isIndicLanguage } = useIndicLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="mipaas-indic-language-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
          isIndicLanguage
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-900 font-bold ring-2 ring-amber-100'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 font-medium'
        }`}
        title="Select Language / भाषा चुनें (AI4Bharat IndicTrans2)"
      >
        <span className="text-sm">🇮🇳</span>
        <Globe className={`w-3.5 h-3.5 ${isIndicLanguage ? 'text-amber-600' : 'text-teal-600'}`} />
        <span className="text-xs font-semibold whitespace-nowrap">
          {compact ? currentLanguage.nativeName : `${currentLanguage.nativeName} (${currentLanguage.name.split(' ')[0]})`}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100 mb-1 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Indian Language Mode
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] font-bold text-slate-800">भाषा चुनें</span>
                <span className="text-[10px] text-slate-500">· 11 Languages</span>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-mono font-bold text-amber-800">
              AI4Bharat
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
            {languages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-amber-500/10 text-amber-900 font-bold border border-amber-200/60'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{lang.flag}</span>
                    <div>
                      <span className="font-bold text-slate-900 block leading-tight">
                        {lang.nativeName}
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">
                        {lang.name} · {lang.floresCode}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-600 stroke-[3]" />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 px-2 py-1 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Digital India Bhashini</span>
            </span>
            <span className="font-mono">v2.1 IndicTrans</span>
          </div>
        </div>
      )}
    </div>
  );
}
