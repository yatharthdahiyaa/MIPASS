'use client';

const impactCards = [
  {
    title: 'The Global Impact of AI:',
    subtitle: ' Real Stories, Real Lives Transformed',
    buttonText: 'Explore Our Impact',
    href: '#impact',
    image: '/images/mipaas_global_impact.jpg',
  },
  {
    title: 'From Aims to Achievements:',
    subtitle: ' Fulfilling Clinical & Business Goals',
    buttonText: 'Explore Our Client Services',
    href: '#clients',
    image: '/images/mipaas_clinical_achievement.jpg',
  },
];

export default function ImpactSection() {
  return (
    <section id="impact" className="w-full py-16 md:py-24 bg-[#0F2332] scroll-mt-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14 w-full">
          {impactCards.map((card, i) => (
            <div key={i} className="flex flex-col justify-between gap-6">
              <h2 className="text-2xl sm:text-3xl lg:text-[40px] leading-[1.15] font-semibold tracking-tight">
                <span className="text-[#D9DBDD]">{card.title}</span>
                <span className="text-[#81878D]">{card.subtitle}</span>
              </h2>

              <div className="flex flex-col gap-5">
                <div>
                  <a
                    href={card.href}
                    className="bg-[#FF7869] text-white rounded-full px-8 py-3 text-sm font-medium hover:bg-[#ff6554] hover:shadow-[0_0_20px_rgba(255,120,105,0.4)] transition-all cursor-pointer inline-flex items-center justify-center"
                  >
                    {card.buttonText}
                  </a>
                </div>

                <div className="w-full h-[240px] sm:h-[300px] lg:h-[360px] rounded-2xl overflow-hidden border border-white/10 relative shadow-xl">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  {/* Subtle gradient vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A1823]/40 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
