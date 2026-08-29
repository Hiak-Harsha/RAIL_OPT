import React from "react";
import { 
  Sparkles, LayoutDashboard, BrainCircuit, FlaskConical, BarChart3, History
} from "lucide-react";

export type OCCNavMode = "theater" | "control" | "review" | "what-if" | "analytics" | "audit";

interface CommandRailProps {
  activeMode: OCCNavMode;
  onSelectMode: (mode: OCCNavMode) => void;
  pendingRecommendationsCount: number;
  activeConflictsCount: number;
}

export const CommandRail: React.FC<CommandRailProps> = ({
  activeMode,
  onSelectMode,
  pendingRecommendationsCount,
  activeConflictsCount
}) => {
  const navItems: { id: OCCNavMode; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "theater",
      label: "TRAFFIC THEATER",
      icon: <Sparkles className="w-4 h-4 text-[#00E5FF]" />,
    },
    {
      id: "control",
      label: "DIGITAL TWIN",
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: activeConflictsCount > 0 ? activeConflictsCount : undefined
    },
    {
      id: "review",
      label: "AI REVIEW",
      icon: <BrainCircuit className="w-4 h-4" />,
      badge: pendingRecommendationsCount > 0 ? pendingRecommendationsCount : undefined
    },
    {
      id: "what-if",
      label: "WHAT-IF LAB",
      icon: <FlaskConical className="w-4 h-4" />
    },
    {
      id: "analytics",
      label: "BENCHMARKS",
      icon: <BarChart3 className="w-4 h-4" />
    },
    {
      id: "audit",
      label: "AUDIT TRAIL",
      icon: <History className="w-4 h-4" />
    }
  ];

  return (
    <aside className="w-16 md:w-44 bg-[#071018] border-r border-[#162434] p-2 flex flex-col justify-between shrink-0 select-none z-20">
      {/* Navigation Buttons List */}
      <div className="space-y-1.5 pt-2">
        <div className="text-[9px] font-mono font-bold text-[#81909B] uppercase tracking-wider px-2.5 pb-1 hidden md:block">
          COMMAND RAIL
        </div>
        {navItems.map((item) => {
          const isActive = activeMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectMode(item.id)}
              className={`w-full flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all relative group ${
                isActive
                  ? "bg-[#00D4FF] text-[#050B11] shadow-lg shadow-[#00D4FF]/20"
                  : "text-[#81909B] hover:text-[#EAF2F7] hover:bg-[#0A131D] border border-transparent hover:border-[#162434]"
              }`}
              title={item.label}
            >
              <span className={isActive ? "text-[#050B11]" : "text-[#CAD6E2] group-hover:text-[#00D4FF]"}>
                {item.icon}
              </span>
              <span className="hidden md:inline truncate">{item.label}</span>

              {/* Notification Badges */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`ml-auto px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  isActive
                    ? "bg-[#050B11] text-[#00D4FF]"
                    : item.id === "control"
                    ? "bg-[#FF1744] text-[#FFFFFF] animate-pulse"
                    : "bg-[#FFB300] text-[#050B11] animate-pulse"
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer System Indicator */}
      <div className="hidden md:block p-2 bg-[#050B11] rounded-lg border border-[#162434] text-[9px] font-mono text-[#81909B]">
        <div className="text-[#00D4FF] font-bold">CTC SECTION: 01</div>
        <div>ALJN–TDL BOTTLENECK</div>
      </div>
    </aside>
  );
};
