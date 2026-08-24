import { motion } from "framer-motion";

const entries = [
  {
    title: "The Art of Minimalist Design",
    read: "5 min read",
    date: "Dec 12, 2025",
    img: "https://images.unsplash.com/photo-1494172961521-33799ddd43a5?w=200&q=80&auto=format&fit=crop",
  },
  {
    title: "Building Scalable Design Systems",
    read: "7 min read",
    date: "Nov 28, 2025",
    img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&q=80&auto=format&fit=crop",
  },
  {
    title: "Future of Interactive Prototyping",
    read: "4 min read",
    date: "Nov 10, 2025",
    img: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&q=80&auto=format&fit=crop",
  },
  {
    title: "Color Theory in Digital Products",
    read: "6 min read",
    date: "Oct 22, 2025",
    img: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200&q=80&auto=format&fit=crop",
  },
];

export default function Journal() {
  return (
    <section id="journal" className="bg-bg py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-px bg-stroke" />
              <span className="text-xs text-muted uppercase tracking-[0.3em]">Journal</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display italic text-text-primary mb-3">
              Recent <span className="font-display italic">thoughts</span>
            </h2>
            <p className="text-sm text-muted max-w-md">Insights on design, code, and creative process.</p>
          </div>
          <a
            href="#"
            className="hidden md:inline-flex group relative items-center gap-2 rounded-full border border-stroke px-6 py-3 text-sm text-text-primary hover:border-transparent transition-colors overflow-hidden"
          >
            <span className="absolute inset-0 rounded-full accent-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative flex items-center gap-2 bg-bg group-hover:bg-transparent rounded-full px-6 py-3 -m-px">
              View all <span>→</span>
            </span>
          </a>
        </motion.div>

        <div className="flex flex-col gap-4">
          {entries.map((e) => (
            <a
              key={e.title}
              href="#"
              className="flex items-center gap-4 md:gap-6 p-4 bg-surface/30 hover:bg-surface border border-stroke rounded-[40px] sm:rounded-full transition-colors group"
            >
              <img src={e.img} alt="" className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-medium text-text-primary truncate group-hover:text-white transition-colors">
                  {e.title}
                </h3>
                <p className="text-xs text-muted mt-1">
                  {e.read} • {e.date}
                </p>
              </div>
              <span className="hidden sm:inline-flex w-8 h-8 rounded-full border border-stroke items-center justify-center text-muted group-hover:border-text-primary group-hover:text-text-primary transition-colors shrink-0">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
