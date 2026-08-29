import React from "react";

interface SplitFlapDisplayProps {
  value: string | number;
  label?: string;
  unit?: string;
  digitCount?: number;
  variant?: "cyan" | "green" | "amber" | "red" | "purple" | "default";
}

export const SplitFlapDisplay: React.FC<SplitFlapDisplayProps> = ({
  value,
  label,
  unit,
  digitCount = 4,
  variant = "default"
}) => {
  const formattedStr = String(value ?? "—").padStart(digitCount, " ").slice(-digitCount);
  const displayChars = formattedStr.split("");

  const getTextColor = () => {
    switch (variant) {
      case "cyan": return "text-[#00D4FF]";
      case "green": return "text-[#00E676]";
      case "amber": return "text-[#FFB300]";
      case "red": return "text-[#FF1744]";
      case "purple": return "text-[#E040FB]";
      default: return "text-[#EAF2F7]";
    }
  };

  return (
    <div className="flex flex-col">
      {label && (
        <span className="text-[10px] font-bold text-[#81909B] tracking-wider uppercase mb-1">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1">
        {displayChars.map((char, idx) => (
          <div
            key={idx}
            className="split-flap-container relative w-6 h-8 bg-[#071018] rounded border border-[#1F2E3D] shadow-inner flex items-center justify-center font-mono font-bold text-base select-none overflow-hidden"
          >
            {/* Split horizontal center crease */}
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#050B11]/80 z-20" />
            
            {/* Character glyph */}
            <span className={`${getTextColor()} z-10`}>
              {char}
            </span>

            {/* Subtle top shade for mechanical flap look */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/[0.02] pointer-events-none" />
          </div>
        ))}

        {unit && (
          <span className="text-xs font-mono text-[#81909B] ml-1 self-end mb-1">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
