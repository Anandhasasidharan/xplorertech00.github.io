import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const DEMO_URL = `${import.meta.env.BASE_URL}calendar/index.html`;

const FEATURES = [
  {
    t: "Month · Week · Day · Agenda",
    d: "Four views with a mini-grid navigator, keyboard shortcuts (M/W/D/A), and a 14-day runs agenda.",
  },
  {
    t: "Dead-drop todos",
    d: "Quick-capture inbox with optional reminders — dateless tasks live beside dated runs.",
  },
  {
    t: "100% local sandbox",
    d: "No account, no server, no tracking. Everything you type stays in your browser's localStorage.",
  },
  {
    t: "Night-city skin",
    d: "Boot sequence, matrix rain canvas, CRT scanlines, and theme switching — form as function.",
  },
];

export default function CalendarSection() {
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="calendar" className="bg-bg py-16 md:py-24 border-t border-stroke">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-px bg-stroke" />
            <span className="text-xs text-muted uppercase tracking-[0.3em]">Side Project</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display italic text-text-primary mb-3">
            Life, <span className="font-display italic">scheduled</span> like a heist
          </h2>
          <p className="text-sm text-muted max-w-xl leading-relaxed">
            SPRAWL_OS is my hacker-styled calendar + task deck — month, week, day and agenda
            views with quick-capture todos. Try the live sandbox below: it ships with demo
            runs, and anything you add never leaves your browser.
          </p>
        </motion.div>

        {/* Framed live demo */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="rounded-3xl p-[1.5px] accent-gradient">
            <div
              ref={frameRef}
              className="bg-bg rounded-3xl overflow-hidden h-[75vh] min-h-[560px] max-h-[820px] relative"
            >
              {mounted ? (
                <iframe
                  src={DEMO_URL}
                  title="SPRAWL_OS calendar demo"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  className="absolute inset-0 w-full h-full border-0"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="font-display italic text-xl text-muted animate-pulse">
                    Jacking in…
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4">
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noopener"
              className="text-xs text-text-primary hover:text-white underline-offset-4 hover:underline inline-flex items-center gap-1"
            >
              Open fullscreen <span className="text-[10px]">↗</span>
            </a>
            <a
              href="mailto:hello@michaelsmith.com?subject=SPRAWL_OS%20desktop%20build"
              className="text-xs text-muted hover:text-text-primary underline-offset-4 hover:underline"
            >
              Want the desktop build with GCal sync? Ask me →
            </a>
            <span className="ml-auto text-[11px] text-muted">
              Sandbox — GCal sync &amp; server reminders live in the private build only
            </span>
          </div>
        </motion.div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {FEATURES.map((f) => (
            <div
              key={f.t}
              className="bg-surface/40 border border-stroke rounded-3xl p-5 hover:bg-surface transition-colors"
            >
              <p className="font-display italic text-lg text-text-primary mb-2">{f.t}</p>
              <p className="text-xs text-muted leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
