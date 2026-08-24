import { useEffect, useState } from "react";

const navLinks = ["Home", "Work", "Resume"];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("Home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, id: string, label: string) => {
    e.preventDefault();
    setActive(label);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 md:pt-6 px-4">
      <div
        className={`inline-flex items-center rounded-full backdrop-blur-md border border-white/10 bg-surface px-2 py-2 transition-shadow ${
          scrolled ? "shadow-md shadow-black/10" : ""
        }`}
      >
        {/* Logo */}
        <a
          href="#home"
          onClick={(e) => handleNav(e, "home", "Home")}
          className="group relative w-9 h-9 rounded-full p-[2px] accent-gradient hover:opacity-90 transition-all duration-300 hover:scale-110 shrink-0"
          style={{ background: "linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)" }}
        >
          <div className="w-full h-full rounded-full bg-bg flex items-center justify-center">
            <span className="font-display italic text-[13px] text-text-primary">JA</span>
          </div>
        </a>

        <div className="w-px h-5 bg-stroke mx-1 hidden sm:block" />

        {/* Nav links */}
        {navLinks.map((label) => {
          const id = label === "Home" ? "home" : label === "Work" ? "work" : "resume";
          const isActive = active === label;
          return (
            <a
              key={label}
              href={`#${id}`}
              onClick={(e) => handleNav(e, id, label)}
              className={`text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors ${
                isActive
                  ? "text-text-primary bg-stroke/50"
                  : "text-muted hover:text-text-primary hover:bg-stroke/50"
              }`}
            >
              {label}
            </a>
          );
        })}

        <div className="w-px h-5 bg-stroke mx-1 hidden sm:block" />

        {/* Say hi */}
        <a
          href="#contact"
          onClick={(e) => handleNav(e, "contact", "Say hi")}
          className="relative group inline-flex items-center gap-1 text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-muted hover:text-text-primary transition-colors ml-1"
        >
          <span className="absolute inset-0 rounded-full accent-gradient opacity-0 group-hover:opacity-100 transition-opacity -m-[2px]" style={{ inset: "-2px" }} />
          <span className="relative bg-surface rounded-full px-3 sm:px-4 py-1.5 sm:py-2 backdrop-blur-md flex items-center gap-1 border border-transparent group-hover:border-white/10">
            Say hi <span className="text-[11px]">↗</span>
          </span>
        </a>
      </div>
    </nav>
  );
}
