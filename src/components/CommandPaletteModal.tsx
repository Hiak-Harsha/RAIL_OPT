import React, { useState, useEffect, useRef } from "react";
import type { Train, TrackBlock, PredictedConflict } from "../types/railway";
import { 
  Search, Train as TrainIcon, Layers, AlertTriangle, 
  Play, RotateCcw, BrainCircuit, FlaskConical, BarChart3, Sparkles, Monitor, Zap
} from "lucide-react";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  trains: Train[];
  blocks: TrackBlock[];
  predictedConflicts: PredictedConflict[];
  onSelectTrain: (train: Train) => void;
  onSelectBlock: (block: TrackBlock) => void;
  onSelectConflict: (conflict: PredictedConflict) => void;
  onExecuteAction: (action: string) => void;
}

interface SearchItem {
  type: "ACTION" | "TRAIN" | "BLOCK" | "CONFLICT";
  data: any;
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  icon: React.ReactNode;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  trains,
  blocks,
  predictedConflicts,
  onSelectTrain,
  onSelectBlock,
  onSelectConflict,
  onExecuteAction
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Static Action Commands
  const actions = [
    { id: "action_toggle_sim", label: "Toggle Simulation (Start / Pause)", category: "Actions", icon: <Play className="w-4 h-4 text-[#00E676]" />, shortcut: "Space" },
    { id: "action_jump_demo", label: "Jump to Active Demo Corridor Window (T+600s)", category: "Simulation", icon: <Zap className="w-4 h-4 text-[#00E676]" />, shortcut: "J" },
    { id: "action_jump_conflict", label: "Fast-Forward to Next Predicted Conflict", category: "Simulation", icon: <AlertTriangle className="w-4 h-4 text-[#FF1744]" /> },
    { id: "action_reset_sim", label: "Reset Corridor Simulation", category: "Actions", icon: <RotateCcw className="w-4 h-4 text-[#FF1744]" />, shortcut: "R" },
    { id: "action_optimize", label: "Run CP-SAT Mathematical Optimizer", category: "Actions", icon: <Sparkles className="w-4 h-4 text-[#00D4FF]" />, shortcut: "O" },
    { id: "action_review", label: "Open AI Decision Review Center", category: "Navigation", icon: <BrainCircuit className="w-4 h-4 text-[#00D4FF]" />, shortcut: "A" },
    { id: "action_whatif", label: "Open What-If Simulation Sandbox", category: "Navigation", icon: <FlaskConical className="w-4 h-4 text-[#00E676]" />, shortcut: "W" },
    { id: "action_analytics", label: "Open Performance & Benchmarks", category: "Navigation", icon: <BarChart3 className="w-4 h-4 text-[#FFB300]" /> },
    { id: "action_cinematic_replay", label: "Replay Cinematic: 'This Is What Gridlock Looks Like'", category: "View", icon: <Sparkles className="w-4 h-4 text-[#FFB300]" />, shortcut: "C" },
    { id: "action_presentation", label: "Toggle Clean Presentation Mode", category: "View", icon: <Monitor className="w-4 h-4 text-[#00D4FF]" />, shortcut: "Ctrl+Shift+D" }
  ];

  // Dynamic filter
  const matchingTrains = trains
    .filter(t => t.train_number.toLowerCase().includes(q) || t.train_name.toLowerCase().includes(q) || t.train_id.toLowerCase().includes(q))
    .slice(0, 5)
    .map(t => ({
      type: "TRAIN" as const,
      data: t,
      id: t.train_id,
      label: `Train ${t.train_number} • ${t.train_name} (${t.direction})`,
      detail: `${Math.round(t.current_speed_kmh)} km/h • ${t.current_block_id || "MAIN"} • P${t.priority}`,
      icon: <TrainIcon className="w-4 h-4 text-[#00D4FF]" />
    }));

  const matchingBlocks = blocks
    .filter(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q))
    .slice(0, 4)
    .map(b => ({
      type: "BLOCK" as const,
      data: b,
      id: b.id,
      label: `Block ${b.name || b.id}`,
      detail: `${b.is_occupied ? "OCCUPIED" : "CLEAR"} • ${b.length_km} km • ${b.max_speed_kmh} km/h`,
      icon: <Layers className="w-4 h-4 text-[#FFB300]" />
    }));

  const matchingConflicts = predictedConflicts
    .filter(c => c.conflict_id.toLowerCase().includes(q) || c.location_block_name.toLowerCase().includes(q) || c.involved_train_ids.some(tid => tid.toLowerCase().includes(q)))
    .slice(0, 3)
    .map(c => ({
      type: "CONFLICT" as const,
      data: c,
      id: c.conflict_id,
      label: `Conflict ${c.conflict_id} • ${c.severity}`,
      detail: `Block ${c.location_block_name} • Trains: ${c.involved_train_ids.join(" ↔ ")}`,
      icon: <AlertTriangle className="w-4 h-4 text-[#FF1744]" />
    }));

  const matchingActions = actions
    .filter(a => a.label.toLowerCase().includes(q))
    .map(a => ({
      type: "ACTION" as const,
      data: a,
      id: a.id,
      label: a.label,
      detail: a.category,
      shortcut: a.shortcut,
      icon: a.icon
    }));

  const allResults: SearchItem[] = [...matchingActions, ...matchingTrains, ...matchingConflicts, ...matchingBlocks];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = allResults[selectedIndex];
      if (selected) {
        if (selected.type === "TRAIN") {
          onSelectTrain(selected.data as Train);
        } else if (selected.type === "BLOCK") {
          onSelectBlock(selected.data as TrackBlock);
        } else if (selected.type === "CONFLICT") {
          onSelectConflict(selected.data as PredictedConflict);
        } else if (selected.type === "ACTION") {
          onExecuteAction(selected.id);
        }
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#03070B]/80 backdrop-blur-md flex items-start justify-center pt-24 px-4">
      <div 
        className="w-full max-w-2xl bg-[#071018] border border-[#00D4FF]/40 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#162434] flex items-center gap-3 bg-[#0A131D]">
          <Search className="w-5 h-5 text-[#00D4FF]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search trains, track blocks, conflicts, commands... (Esc to close)"
            className="w-full bg-transparent text-sm text-[#EAF2F7] focus:outline-none placeholder-[#81909B]"
          />
          <span className="px-2 py-0.5 rounded bg-[#162434] text-[#81909B] text-[10px] font-bold">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {allResults.length === 0 ? (
            <div className="py-8 text-center text-[#81909B]">
              No matching trains, blocks, or commands found for "{query}"
            </div>
          ) : (
            allResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.type === "TRAIN") onSelectTrain(item.data as Train);
                    else if (item.type === "BLOCK") onSelectBlock(item.data as TrackBlock);
                    else if (item.type === "CONFLICT") onSelectConflict(item.data as PredictedConflict);
                    else if (item.type === "ACTION") onExecuteAction(item.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#00D4FF]/15 border border-[#00D4FF]/50 text-[#EAF2F7]"
                      : "hover:bg-[#0A131D] text-[#81909B] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#050B11] border border-[#162434]">
                      {item.icon}
                    </div>
                    <div>
                      <div className={`font-bold ${isSelected ? "text-[#00D4FF]" : "text-[#EAF2F7]"}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-[#81909B]">{item.detail}</div>
                    </div>
                  </div>

                  {item.shortcut && (
                    <span className="px-2 py-0.5 rounded bg-[#050B11] border border-[#162434] text-[10px] text-[#00D4FF] font-bold">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="p-2.5 bg-[#050B11] border-t border-[#162434] text-[10px] text-[#81909B] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Dismiss</span>
          </div>
          <span className="text-[#00D4FF]">RAILOPT-X COMMAND SYSTEM</span>
        </div>
      </div>
    </div>
  );
};
