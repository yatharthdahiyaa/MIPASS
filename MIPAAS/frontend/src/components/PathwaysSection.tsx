'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShieldAlert, Activity, Layers } from 'lucide-react';
import { useServices } from '@/context/ServicesContext';

export default function PathwaysSection() {
  const { homepageServices, isLoading } = useServices();
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState('All pathways');
  const modalities = ['All pathways', ...new Set(homepageServices.map((service) => service.modality))];
  const cards = homepageServices.filter((service) =>
    (modality === 'All pathways' || service.modality === modality) &&
    `${service.name} ${service.description} ${service.modality}`.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <section id="products" className="pathways-section" aria-labelledby="pathways-heading">
      <div className="site-container">
        <div className="section-intro">
          <div>
            <p className="eyebrow">Clinical pathways</p>
            <h2 id="pathways-heading" className="section-heading">The right insight.<br />For the next step in care.</h2>
          </div>
          <p className="section-description">Explore imaging and decision-support tools across oncology, cardiology, neurology, and global health. Start with the pathway that fits your workflow.</p>
        </div>
        <div className="pathway-toolbar">
          <label className="pathway-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search clinical pathways</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by specialty or scan type" /></label>
          <label className="pathway-filter"><span>Scan type</span><select value={modality} onChange={(event) => setModality(event.target.value)}>{modalities.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <p className="pathway-count" role="status">{isLoading && homepageServices.length === 0 ? 'Loading clinical pathways…' : `${cards.length} ${cards.length === 1 ? 'pathway' : 'pathways'} available to explore`}</p>
        {cards.length > 0 ? (
          <div className="pathway-grid">
            {cards.map((card, index) => {
              const isClosed = card.status !== 'active';
              return (
                <article key={card.id} className="clinical-card">
                  <div className="clinical-card-image">
                    <img src={card.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
                    <Layers className="clinical-image-fallback" size={44} aria-hidden="true" />
                    <span className="clinical-modality">{card.modality}</span>
                    <span className="clinical-index">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="clinical-card-content">
                    <p className={isClosed ? 'clinical-status maintenance' : 'clinical-status'}><span />{isClosed ? 'Temporarily unavailable' : 'Explore pathway'}</p>
                    <h3>{card.shortName}</h3>
                    <p className="clinical-card-description">{card.description}</p>
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 mt-auto">
                      <Link href={card.href} className="text-[11px] font-medium text-[#B2C4D0] hover:text-white flex items-center gap-1 transition-colors">
                        <span>{isClosed ? 'Service notice' : `Explore ${card.shortName}`}</span>
                        <ArrowRight size={13} />
                      </Link>
                      <Link
                        href={`/patient?service=${card.id}`}
                        className="px-3 py-1.5 rounded-lg bg-[#00DCCE] hover:bg-[#00DCCE]/90 text-black font-bold text-xs flex items-center gap-1 transition-all shadow-sm shadow-[#00DCCE]/20"
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
          <div className="pathway-empty">
            {homepageServices.length === 0 ? <ShieldAlert size={32} /> : <Search size={32} />}
            <h3>{homepageServices.length === 0 ? 'Pathways are currently unavailable' : 'No matching pathways'}</h3>
            <p>{homepageServices.length === 0 ? 'Please check back when services are available.' : 'Try another specialty, or clear your filters to see all pathways.'}</p>
            {homepageServices.length > 0 && <button type="button" className="button-secondary" onClick={() => { setQuery(''); setModality('All pathways'); }}>Clear filters</button>}
          </div>
        )}
        <div className="pathway-review-note"><Activity size={18} /><p>Every finding belongs in context. Qualified healthcare professionals remain responsible for reviewing results and care decisions.</p></div>
      </div>
    </section>
  );
}
