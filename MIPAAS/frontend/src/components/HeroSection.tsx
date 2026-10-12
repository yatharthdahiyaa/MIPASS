'use client';

const stats = [
  { value: '0+', label: 'Lives impacted\nto date' },
  { value: '1+', label: 'Countries via\n1+ sites' },
  { value: '100k+', label: 'Training\ndatasets' },
];

export default function HeroSSection() {
  return (
    <section className="bg-[#0E273A] text-white overflow-hidden">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center min-h-[580px] py-12 lg:py-16">
          {/* Left content */}
          <div className="flex flex-col space-y-8 lg:col-span-2 z-10">
            <h1
              className="text-left text-4xl sm:text-5xl lg:text-[52px] xl:text-[68px] leading-[1.08] tracking-tight"
              style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
            >
              <div>India&apos;s</div>
              <div>Emerging</div>
              <div className="text-white">Healthcare AI</div>
            </h1>

            <div>
              <a
                href="#contact"
                className="bg-[#FF7869] text-white rounded-full px-8 py-3.5 text-sm font-semibold tracking-wide hover:shadow-[0_0_20px_rgba(255,120,105,0.5)] hover:bg-[#ff6857] transition-all duration-300 cursor-pointer inline-flex items-center justify-center"
              >
                Contact Us
              </a>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10 lg:border-t-0 lg:pt-4">
              {stats.map((stat) => (
                <div key={stat.value} className="flex flex-col gap-1.5">
                  <div
                    className="text-2xl sm:text-3xl md:text-4xl xl:text-[52px] font-bold leading-none text-white tracking-tight"
                    style={{ fontFamily: "'Josefin Sans', sans-serif" }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-300 leading-tight whitespace-pre-line">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side — hero video / animation */}
          <div className="lg:col-span-3 w-full flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-[#0A1823] to-[#0E273A] border border-white/10 flex items-center justify-center shadow-2xl">
              {/* MiPAAS loop animation video */}
              <video
                src="https://qure-website-images.s3.ap-south-1.amazonaws.com/Homepage_animation_98e394c1e1.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain"
              />

              {/* Floating glass badges */}
              <div className="absolute top-4 sm:top-5 right-4 sm:right-5 backdrop-blur-md bg-[#060B11]/70 border border-white/15 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-[#00DCCE] shadow-lg pointer-events-none">
                <div className="text-sm sm:text-base lg:text-lg font-bold text-white">98.2%</div>
                <div className="text-gray-300 text-[10px] sm:text-[11px]">Accuracy Rate</div>
              </div>
              <div className="absolute bottom-4 sm:bottom-5 left-4 sm:left-5 backdrop-blur-md bg-[#060B11]/70 border border-white/15 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-[#FF7869] shadow-lg pointer-events-none">
                <div className="text-sm sm:text-base lg:text-lg font-bold text-white">2.3s</div>
                <div className="text-gray-300 text-[10px] sm:text-[11px]">Avg Scan Time</div>
              </div>
              <div className="absolute top-4 sm:top-5 left-4 sm:left-5 backdrop-blur-md bg-[#060B11]/70 border border-white/15 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-[#98AED9] shadow-lg hidden sm:block pointer-events-none">
                <div className="text-sm sm:text-base lg:text-lg font-bold text-white">50K+</div>
                <div className="text-gray-300 text-[10px] sm:text-[11px]">Daily Scans</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
