import React from "react";
import type { 
  Train, TrackBlock, Station, OperationalKPIs, PredictedConflict, 
  Recommendation, Signal 
} from "../../types/railway";
import type { OperatorRole } from "../../services/permissions";
import type { SelectedRailwayEntity } from "../NXPanel/NXTrackCanvas";
import type { TeleprinterLog } from "../Teleprinter/TrafficTeleprinter";
import { OCCHeader } from "./OCCHeader";
import { CommandRail, type OCCNavMode } from "./CommandRail";
import { ContextInspector } from "./ContextInspector";
import { BottomTelemetryDock } from "./BottomTelemetryDock";
import { TrainRosterStrip } from "../NXPanel/TrainRosterStrip";
import { NXTrackCanvas } from "../NXPanel/NXTrackCanvas";
import { RecommendationDrawer } from "../RecommendationDrawer";
import { useSimulationAudio } from "../../audio/useSimulationAudio";
import { useInterpolatedTrains } from "../../hooks/useInterpolatedTrains";
import { VoiceOverEngine, type VoiceCaption } from "../../audio/VoiceOverEngine";
import { Radio } from "lucide-react";

interface OCCShellProps {
  activeMode: OCCNavMode;
  onSelectMode: (mode: OCCNavMode) => void;
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  signals?: Signal[];
  kpis: OperationalKPIs | null;
  safetyInvariants: { checked: number; passed: number; failed: number; percentage: number } | null;
  predictedConflicts: PredictedConflict[];
  activeRecommendations: Recommendation[];
  teleprinterLogs: TeleprinterLog[];
  events: any[];
  simTimeFormatted: string;
  isRunning: boolean;
  timeScale: number;
  connectionStatus: "CONNECTING" | "LIVE" | "RECONNECTING" | "OFFLINE";
  currentRole: OperatorRole;
  onRoleChange: (role: OperatorRole) => void;
  demoStep: number;
  onExecuteDemoStep: (step: number) => void;
  onOpenCopilot: () => void;
  selectedEntity: SelectedRailwayEntity | null;
  onSelectEntity: (entity: SelectedRailwayEntity | null) => void;
  onTogglePlay: () => void;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  canControlSimulation: boolean;
  canApproveDecision: boolean;
  canInjectDisruption: boolean;
  controlStatus: string | null;
  decisionRippleActive: boolean;
  onDecision: (action: "APPROVE" | "REJECT" | "OVERRIDE", overrideReason?: string) => void;
  onTriggerDisruption: (type: string, targetId: string) => void;
  onExplainEntity: (entity: SelectedRailwayEntity) => void;
  onSimulateInWhatIf: (entity: SelectedRailwayEntity) => void;
  onOpenCounterfactual: () => void;
  onEventClick: (event: any) => void;
  onReplayStory?: () => void;
  children?: React.ReactNode;
}

export const OCCShell: React.FC<OCCShellProps> = ({
  activeMode,
  onSelectMode,
  trains,
  blocks,
  stations,
  signals = [],
  kpis,
  safetyInvariants,
  predictedConflicts,
  activeRecommendations,
  teleprinterLogs,
  events,
  simTimeFormatted,
  isRunning,
  timeScale,
  connectionStatus,
  currentRole,
  onRoleChange,
  demoStep,
  onExecuteDemoStep,
  onOpenCopilot,
  selectedEntity,
  onSelectEntity,
  onTogglePlay,
  onScaleChange,
  onReset,
  canControlSimulation,
  canApproveDecision,
  canInjectDisruption,
  controlStatus,
  decisionRippleActive,
  onDecision,
  onTriggerDisruption,
  onExplainEntity,
  onSimulateInWhatIf,
  onOpenCounterfactual,
  onEventClick,
  onReplayStory,
  children
}) => {
  const [voiceCaption, setVoiceCaption] = React.useState<VoiceCaption | null>(null);
  const interpolatedTrains = useInterpolatedTrains(trains, isRunning, timeScale);

  React.useEffect(() => {
    return VoiceOverEngine.subscribeCaptions(setVoiceCaption);
  }, []);

  useSimulationAudio(interpolatedTrains, blocks, predictedConflicts);

  return (
    <div className="min-h-screen bg-[#03070B] text-[#EAF2F7] flex flex-col font-sans select-none antialiased relative">
      {/* Dynamic Voice-Over Live Spoken Alert Toast */}
      {voiceCaption && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#071018]/95 border border-[#00D4FF]/60 text-[#EAF2F7] px-5 py-2 rounded-full font-mono text-xs shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
          <Radio className="w-3.5 h-3.5 text-[#00D4FF] animate-pulse" />
          <span className="font-bold text-[#CAD6E2]">{voiceCaption.text}</span>
        </div>
      )}

      {/* 1. Master OCC Telemetry Header */}
      <OCCHeader
        simTimeFormatted={simTimeFormatted}
        isRunning={isRunning}
        connectionStatus={connectionStatus}
        currentRole={currentRole}
        onRoleChange={onRoleChange}
        demoStep={demoStep}
        onExecuteDemoStep={onExecuteDemoStep}
        onOpenCopilot={onOpenCopilot}
        onReplayStory={onReplayStory}
      />

      {/* 2. Main OCC Layout: Command Rail + Central Operational Stage */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Command Rail */}
        <CommandRail
          activeMode={activeMode}
          onSelectMode={onSelectMode}
          pendingRecommendationsCount={activeRecommendations.length}
          activeConflictsCount={predictedConflicts.length}
        />

        {/* Central Workspace Area */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-[1700px] w-full mx-auto space-y-5">
          {activeMode === "control" ? (
            <div className="space-y-5">
              {/* Train Corridor Roster Strip */}
              <TrainRosterStrip
                trains={interpolatedTrains}
                predictedConflicts={predictedConflicts}
                selectedTrainId={selectedEntity?.type === "TRAIN" ? selectedEntity.id : null}
                onSelectTrain={(train) => {
                  onSelectEntity({ type: "TRAIN", id: train.train_id, data: train });
                }}
              />

              {/* Main Stage Grid: NX Digital Twin Stage + Context Inspector */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start">
                {/* 3 Cols: Dominant NX Digital Twin Stage */}
                <div className="xl:col-span-3 space-y-4">
                  <NXTrackCanvas
                    trains={interpolatedTrains}
                    blocks={blocks}
                    stations={stations}
                    signals={signals}
                    predictedConflicts={predictedConflicts}
                    activeRecommendation={activeRecommendations[0] || null}
                    decisionRippleActive={decisionRippleActive}
                    selectedEntity={selectedEntity}
                    onSelectEntity={onSelectEntity}
                    onTriggerDisruption={onTriggerDisruption}
                    onExplainEntity={onExplainEntity}
                    onSimulateInWhatIf={onSimulateInWhatIf}
                    onOpenDecisionReview={() => onSelectMode("review")}
                  />

                  {/* Controller Action Drawer */}
                  <RecommendationDrawer
                    recommendation={activeRecommendations[0] || null}
                    onDecision={onDecision}
                    canApproveDecision={canApproveDecision}
                    onOpenDecisionReview={() => onSelectMode("review")}
                  />
                </div>

                {/* 1 Col: Dynamic Context Inspector */}
                <div className="xl:col-span-1">
                  <ContextInspector
                    selectedEntity={selectedEntity}
                    trains={trains}
                    blocks={blocks}
                    stations={stations}
                    predictedConflicts={predictedConflicts}
                    activeRecommendation={activeRecommendations[0] || null}
                    kpis={kpis}
                    safetyInvariants={safetyInvariants}
                    onClearSelection={() => onSelectEntity(null)}
                    onSelectEntity={onSelectEntity}
                    onExplainEntity={onExplainEntity}
                    onSimulateInWhatIf={onSimulateInWhatIf}
                    onOpenDecisionReview={() => onSelectMode("review")}
                    onTriggerDisruption={onTriggerDisruption}
                    canInjectDisruption={canInjectDisruption}
                  />
                </div>
              </div>

              {/* Bottom Telemetry Dock */}
              <BottomTelemetryDock
                kpis={kpis}
                safetyInvariants={safetyInvariants}
                simTimeFormatted={simTimeFormatted}
                isRunning={isRunning}
                timeScale={timeScale}
                onTogglePlay={onTogglePlay}
                onScaleChange={onScaleChange}
                onReset={onReset}
                canControlSimulation={canControlSimulation}
                controlStatus={controlStatus}
                teleprinterLogs={teleprinterLogs}
                activeRecommendation={activeRecommendations[0] || null}
                onOpenCounterfactual={onOpenCounterfactual}
                events={events}
                onEventClick={onEventClick}
              />
            </div>
          ) : (
            <div className="py-2">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
