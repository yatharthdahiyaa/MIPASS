'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShieldAlert, Activity, Layers } from 'lucide-react';
import { useServices } from '@/context/ServicesContext';
import { useIndicLanguage } from '@/context/IndicLanguageContext';

export default function PathwaysSection() {
  const { homepageServices, isLoading } = useServices();
  const { t } = useIndicLanguage();
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState('All pathways');
  const modalities = ['All pathways', ...new Set(homepageServices.map((service) => service.modality))];
  const cards = homepageServices.filter((service) =>
    (modality === 'All pathways' || service.modality === modality) &&
    `${service.name} ${service.description} ${service.modality}`.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <section id="features" className="py-20 bg-slate-50/70 border-b border-slate-200/80" aria-labelledby="pathways-heading">
      <div className="site-container">
        {/* Section Intro */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
          <div>
            <p className="eyebrow mb-2 !text-blue-600 font-bold text-xs uppercase tracking-wider">{t('pathways_eyebrow')}</p>
            <h2 id="pathways-heading" className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {t('pathways_title_part1')}<br />{t('pathways_title_part2')}
            </h2>
          </div>
          <p className="text-slate-600 text-sm sm:text-base max-w-md leading-relaxed">
            {t('pathways_desc')}
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          <label className="flex items-center gap-2.5 px-4 h-12 bg-white border border-slate-200 rounded-xl text-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 flex-1 max-w-md shadow-xs transition-all">
            <Search size={18} className="text-slate-400 shrink-0" />
            <span className="sr-only">Search clinical pathways</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('pathways_search_placeholder')}
              className="bg-transparent text-slate-800 text-sm w-full focus:outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>{t('pathways_scan_type')}</span>
            <select
              value={modality}
              onChange={(event) => setModality(event.target.value)}
              className="h-12 bg-white border border-slate-200 rounded-xl px-4 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
            >
              {modalities.map((item) => (
                <option key={item} value={item}>{item === 'All pathways' ? t('pathways_all') : item}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-slate-500 mb-6 font-medium" role="status">
          {isLoading && homepageServices.length === 0
            ? 'Loading clinical pathways…'
            : `${cards.length} ${t('pathways_available_suffix')}`}
        </p>

        {/* Pathways Card Grid */}
        {cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, index) => {
              const isClosed = card.status !== 'active';
              return (
                <article
                  key={card.id}
                  className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(30,58,138,0.08)] hover:border-blue-200 transition-all flex flex-col hover:-translate-y-0.5 duration-300"
                >
                  <div className="h-48 relative overflow-hidden bg-slate-100">
                    <img
                      src={card.image}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                    />
                    <Layers className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={44} aria-hidden="true" />
                    <span className="absolute top-4 left-4 z-10 px-2.5 py-1 bg-white/90 backdrop-blur-md text-slate-700 font-mono text-[10px] font-bold rounded-lg border border-slate-200/80 shadow-xs">
                      {card.modality}
                    </span>
                    <span className="absolute top-4 right-4 z-10 px-2 py-0.5 bg-slate-900/70 text-white rounded text-[10px] font-bold">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold mb-2.5">
                      <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className={isClosed ? 'text-amber-600' : 'text-emerald-700'}>
                        {isClosed ? 'Temporarily unavailable' : 'Active pathway'}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight group-hover:text-blue-600 transition-colors">
                      {card.shortName}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 flex-1">
                      {card.description}
                    </p>

                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-auto">
                      <Link
                        href={card.href}
                        className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        <span>{isClosed ? 'Service notice' : `Explore ${card.shortName}`}</span>
                        <ArrowRight size={13} />
                      </Link>
                      <Link
                        href={`/patient?service=${card.id}`}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20"
                        title={`Open AI Diagnostic Studio for ${card.name}`}
                      >
                        <span>Analyze scan</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : !isLoading && (
          <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center gap-4 bg-white">
            {homepageServices.length === 0 ? <ShieldAlert size={36} className="text-amber-500" /> : <Search size={36} className="text-slate-400" />}
            <h3 className="text-xl font-bold text-slate-900">
              {homepageServices.length === 0 ? 'Pathways are currently unavailable' : 'No matching pathways'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm">
              {homepageServices.length === 0 ? 'Please check back when services are available.' : 'Try another specialty, or clear your filters to see all pathways.'}
            </p>
            {homepageServices.length > 0 && (
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
                onClick={() => { setQuery(''); setModality('All pathways'); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Disclaimer / Note */}
        <div className="flex items-center gap-3 pt-8 mt-8 border-t border-slate-200 text-slate-500 text-xs">
          <Activity size={18} className="text-blue-600 shrink-0" />
          <p>Every finding belongs in context. Qualified healthcare professionals remain responsible for reviewing results and care decisions.</p>
        </div>
      </div>
    </section>
  );
}
