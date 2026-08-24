import { useEffect, useRef } from "react";
import gsap from "gsap";
import HlsVideo from "./HlsVideo";

const HLS_SRC = "https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";

export default function Contact() {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!marqueeRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(marqueeRef.current, {
        xPercent: -50,
        duration: 40,
        ease: "none",
        repeat: -1,
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section id="contact" className="relative bg-bg pt-16 md:pt-20 pb-8 md:pb-12 overflow-hidden">
      {/* Flipped video */}
      <div className="absolute inset-0 overflow-hidden">
        <HlsVideo
          src={HLS_SRC}
          flip
          className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto object-cover -translate-x-1/2 -translate-y-1/2 scale-y-[-1]"
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Marquee */}
      <div className="relative z-10 overflow-hidden whitespace-nowrap py-4 border-y border-white/10 mb-12">
        <div ref={marqueeRef} className="inline-flex">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="text-2xl md:text-4xl font-display italic text-white/80 mx-4 shrink-0">
              BUILDING THE FUTURE •
            </span>
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={`d-${i}`} className="text-2xl md:text-4xl font-display italic text-white/80 mx-4 shrink-0">
              BUILDING THE FUTURE •
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-display italic text-white mb-6">Let's build together</h2>
        <a
          href="mailto:hello@michaelsmith.com"
          className="group relative inline-flex rounded-full p-[2px] accent-gradient"
        >
          <span className="bg-bg rounded-full px-8 py-4 text-sm text-text-primary group-hover:bg-transparent group-hover:text-white transition-colors">
            hello@michaelsmith.com
          </span>
        </a>
      </div>

      {/* Footer bar */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/10">
        <div className="flex items-center gap-4 text-xs text-muted">
          {["Twitter", "LinkedIn", "Dribbble", "GitHub"].map((s) => (
            <a key={s} href="#" className="hover:text-white transition-colors">
              {s}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Available for projects
        </div>
      </div>
    </section>
  );
}
