import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const items = [
  { img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80&auto=format&fit=crop", rot: "-2deg" },
  { img: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=500&q=80&auto=format&fit=crop", rot: "1.5deg" },
  { img: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=500&q=80&auto=format&fit=crop", rot: "-1deg" },
  { img: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=500&q=80&auto=format&fit=crop", rot: "2deg" },
  { img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80&auto=format&fit=crop&sat=-100", rot: "-1.5deg" },
  { img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&q=80&auto=format&fit=crop", rot: "1deg" },
];

export default function Explorations() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const colLeftRef = useRef<HTMLDivElement>(null);
  const colRightRef = useRef<HTMLDivElement>(null);
  const [activeImg, setActiveImg] = useState<string | null>(null);

  useEffect(() => {
    if (!sectionRef.current || !pinRef.current) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: pinRef.current,
        start: "top top",
        end: "+=200%",
        pin: pinRef.current,
        pinSpacing: false,
      });

      if (colLeftRef.current) {
        gsap.fromTo(
          colLeftRef.current,
          { y: 300 },
          {
            y: -300,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 1,
            },
          }
        );
      }
      if (colRightRef.current) {
        gsap.fromTo(
          colRightRef.current,
          { y: -200 },
          {
            y: 200,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <section ref={sectionRef} className="relative min-h-[300vh] bg-bg overflow-hidden">
        {/* Pinned center */}
        <div
          ref={pinRef}
          className="h-screen flex flex-col items-center justify-center text-center px-6 z-10 relative bg-bg"
        >
          <p className="text-xs text-muted uppercase tracking-[0.3em] mb-4">Explorations</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-display italic text-text-primary mb-4">
            Visual <span className="font-display italic">playground</span>
          </h2>
          <p className="text-sm text-muted max-w-md mb-6">
            A curated gallery of experiments, sketches, and visual studies.
          </p>
          <a
            href="https://dribbble.com"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-stroke px-6 py-3 text-sm text-text-primary hover:bg-surface transition-colors"
          >
            Dribbble <span>↗</span>
          </a>
        </div>

        {/* Parallax columns */}
        <div className="absolute inset-0 z-20 pointer-events-none flex justify-center">
          <div className="w-full max-w-[1400px] grid grid-cols-2 gap-12 md:gap-40 px-6 md:px-10 pt-[100vh] pb-[50vh]">
            <div ref={colLeftRef} className="flex flex-col gap-12 md:gap-20 items-end pointer-events-auto">
              {[items[0], items[2], items[4]].map((it, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(it.img)}
                  className="w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-surface border border-stroke cursor-pointer"
                  style={{ transform: `rotate(${it.rot})` }}
                >
                  <img src={it.img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <div ref={colRightRef} className="flex flex-col gap-12 md:gap-20 items-start pointer-events-auto">
              {[items[1], items[3], items[5]].map((it, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(it.img)}
                  className="w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-surface border border-stroke cursor-pointer"
                  style={{ transform: `rotate(${it.rot})` }}
                >
                  <img src={it.img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {activeImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-8"
          onClick={() => setActiveImg(null)}
        >
          <img src={activeImg} alt="" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </>
  );
}
