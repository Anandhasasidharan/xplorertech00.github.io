export default function Stats() {
  const stats = [
    { value: "20+", label: "Years Experience" },
    { value: "95+", label: "Projects Done" },
    { value: "200%", label: "Satisfied Clients" },
  ];
  return (
    <section id="resume" className="bg-bg py-16 md:py-24 border-y border-stroke">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-stroke">
        {stats.map((s) => (
          <div key={s.label} className="text-center py-6 md:py-2">
            <p className="text-4xl md:text-5xl font-display italic text-text-primary mb-2">{s.value}</p>
            <p className="text-xs text-muted uppercase tracking-[0.2em]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
