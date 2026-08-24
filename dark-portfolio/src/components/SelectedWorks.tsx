import { motion } from "framer-motion";

const projects = [
  {
    title: "Automotive Motion",
    span: "md:col-span-7",
    aspect: "aspect-[16/10] md:aspect-[1.4/1]",
    img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80&auto=format&fit=crop",
  },
  {
    title: "Urban Architecture",
    span: "md:col-span-5",
    aspect: "aspect-[4/3] md:aspect-[0.95/1]",
    img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80&auto=format&fit=crop",
  },
  {
    title: "Human Perspective",
    span: "md:col-span-5",
    aspect: "aspect-[4/3] md:aspect-[0.95/1]",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&auto=format&fit=crop",
  },
  {
    title: "Brand Identity",
    span: "md:col-span-7",
    aspect: "aspect-[16/10] md:aspect-[1.4/1]",
    img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&auto=format&fit=crop",
  },
];

export default function SelectedWorks() {
  return (
    <section id="work" className="bg-bg py-12 md:py-16">
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
              <span className="text-xs text-muted uppercase tracking-[0.3em]">Selected Work</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display italic text-text-primary mb-3">
              Featured <span className="font-display italic">projects</span>
            </h2>
            <p className="text-sm text-muted max-w-md">
              A selection of projects I've worked on, from concept to launch.
            </p>
          </div>
          <a
            href="#"
            className="hidden md:inline-flex group relative items-center gap-2 rounded-full border border-stroke px-6 py-3 text-sm text-text-primary hover:border-transparent transition-colors overflow-hidden"
          >
            <span className="absolute inset-0 rounded-full accent-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative flex items-center gap-2 bg-bg group-hover:bg-transparent rounded-full px-6 py-3 -m-px">
              View all work <span>→</span>
            </span>
          </a>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
          {projects.map((p) => (
            <div
              key={p.title}
              className={`${p.span} ${p.aspect} group relative bg-surface border border-stroke rounded-3xl overflow-hidden cursor-pointer`}
            >
              <img
                src={p.img}
                alt={p.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* halftone */}
              <div
                className="absolute inset-0 opacity-20 mix-blend-multiply pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
                  backgroundSize: "4px 4px",
                }}
              />
              {/* hover overlay */}
              <div className="absolute inset-0 bg-bg/70 opacity-0 group-hover:opacity-100 backdrop-blur-lg transition-opacity duration-300 flex items-center justify-center">
                <span className="relative inline-flex items-center rounded-full p-[1.5px] accent-gradient animate-gradient-shift">
                  <span className="bg-white text-black rounded-full px-5 py-2 text-sm flex items-center gap-2">
                    View — <em className="font-display italic">{p.title}</em>
                  </span>
                </span>
              </div>
              {/* title bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/60 to-transparent md:hidden">
                <p className="text-white text-sm font-medium">{p.title}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 md:hidden flex justify-center">
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-full border border-stroke px-6 py-3 text-sm text-text-primary"
          >
            View all work <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
