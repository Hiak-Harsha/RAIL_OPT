import React, { useEffect, useState } from "react";

interface CinematicCaptionProps {
  title: string;
  subtitle?: string;
  phase?: string;
}

export const CinematicCaption: React.FC<CinematicCaptionProps> = ({
  title,
  subtitle,
  phase
}) => {
  const [displayTitle, setDisplayTitle] = useState(title);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayTitle(title);
    }, 60);
    return () => clearTimeout(timer);
  }, [title]);

  const isWarning = phase === "ESCALATING" || phase === "GRIDLOCK";
  const isOptimal = phase === "OPTIMAL" || phase === "RESOLVING";

  return (
    <div className="w-full text-center pointer-events-none px-4 max-w-2xl mx-auto space-y-1 rail-fade-in">
      {/* Narrative Badge */}
      <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#0B0F0C] border border-[#1F2822] shadow-lg">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isWarning
              ? "bg-[#EF4444] conflict-pulse-slow"
              : isOptimal
              ? "bg-[#22C55E]"
              : "bg-[#FF8C1A]"
          }`}
        />
        <span className="text-[9px] font-mono font-bold tracking-wider text-[#8C9A8E] uppercase">
          {phase ? `SCENARIO STATE: ${phase}` : "AUTOMATED SECTION SURVEILLANCE"}
        </span>
      </div>

      {/* Main Narrative Subtitle Line */}
      <h1
        className={`text-base md:text-lg font-black tracking-tight leading-snug drop-shadow-lg ${
          isWarning
            ? "text-[#EF4444]"
            : isOptimal
            ? "text-[#22C55E]"
            : "text-[#E2E8E4]"
        }`}
      >
        {displayTitle}
      </h1>

      {/* Narrative Subcaption */}
      {subtitle && (
        <p className="text-[11px] font-mono text-[#8C9A8E] max-w-xl mx-auto tracking-wide">
          {subtitle}
        </p>
      )}
    </div>
  );
};
