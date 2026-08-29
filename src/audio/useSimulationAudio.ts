/**
 * RAILOPT-X 2.0 — Live Simulation Audio & Spoken PA Dispatch Hook
 * 
 * Subscribes to live digital twin state and drives:
 * 1. Speed-modulated spatial train acoustics (distance-attenuated).
 * 2. Relay & interlocking route-locking cues.
 * 3. Discrete spoken PA announcements on newly detected conflicts:
 *    Chime -> 200ms pause -> VoiceOverEngine.speakAlert(...) with phonetic callsigns.
 * 4. Safety invariant violation alerts.
 * 5. Debounced conflict announcement cache.
 */

import { useEffect, useRef } from "react";
import type { Train, TrackBlock, PredictedConflict } from "../types/railway";
import { RailwayAudio } from "./RailwayAudioEngine";
import { VoiceOverEngine } from "./VoiceOverEngine";
import type { TrainClass } from "./TrainAudioController";

export function useSimulationAudio(
  trains: Train[],
  blocks: TrackBlock[],
  predictedConflicts: PredictedConflict[] = [],
  cameraFocusKm: number = 160
) {
  const announcedConflictIdsRef = useRef<Set<string>>(new Set());
  const lastSpokenTimeRef = useRef<number>(0);
  const prevBlockOccupancyRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Modulate continuous train audio for active moving trains
    trains.forEach((train) => {
      const serviceName = `${train.train_name} ${train.train_number}`.toLowerCase();
      const trainClass: TrainClass = /freight|goods|cargo|wag/.test(serviceName) ? "FREIGHT"
        : /memu|emu|local|suburban/.test(serviceName) ? "MEMU"
        : /vande|rajdhani|shatabdi|duronto|express/.test(serviceName) ? "EXPRESS"
        : "PASSENGER";

      // Distance attenuation relative to camera focus
      const trainPos = train.corridor_position_km ?? train.current_position_km ?? 0;
      const distFromCamera = Math.abs(trainPos - cameraFocusKm);
      const isAudibleRange = distFromCamera < 95;

      if (isAudibleRange) {
        RailwayAudio.updateTrainSpeed(
          train.train_id,
          train.current_speed_kmh,
          trainClass,
          train.current_speed_kmh > 0,
          trainPos,
          cameraFocusKm
        );
      } else {
        RailwayAudio.updateTrainSpeed(train.train_id, 0, trainClass, false, trainPos, cameraFocusKm);
      }
    });

    // 2. Play relay / route lock cues on block occupancy changes
    blocks.forEach((blk) => {
      const prevOcc = prevBlockOccupancyRef.current[blk.id];
      if (prevOcc !== undefined && prevOcc !== blk.is_occupied) {
        if (blk.is_occupied) {
          RailwayAudio.playSignalChange("RED");
        } else {
          RailwayAudio.playSignalChange("GREEN");
        }
      }
      prevBlockOccupancyRef.current[blk.id] = blk.is_occupied;
    });

    // 3. Spoken PA Announcements on Newly Detected Predicted Conflicts
    const currentConflictIds = new Set(predictedConflicts.map((c) => c.conflict_id));
    const now = Date.now();

    predictedConflicts.forEach((conf) => {
      if (!announcedConflictIdsRef.current.has(conf.conflict_id)) {
        announcedConflictIdsRef.current.add(conf.conflict_id);

        // Throttle rapid bursts
        if (now - lastSpokenTimeRef.current > 3000) {
          lastSpokenTimeRef.current = now;

          // 1. Play alert chime
          RailwayAudio.playConflictAlert();

          // 2. Format phonetic speech alert after brief PA chime tail
          setTimeout(() => {
            const trainA = conf.involved_train_ids[0] || "T22436";
            const trainB = conf.involved_train_ids[1] || "T04403";
            const location = conf.location_block_name || conf.location_block_id || "single line section";
            const timeMin = Math.max(1, Math.round((conf.time_to_conflict_sec || conf.predicted_time_sec || 300) / 60));

            const spokenText = `Conflict alert. Train ${trainA} and train ${trainB} converging near ${location}, estimated impact in ${timeMin} minutes. Controller review recommended.`;
            VoiceOverEngine.speakAlert(spokenText);
          }, 220);
        }
      }
    });

    // Prune resolved conflicts from announcement tracker
    announcedConflictIdsRef.current.forEach((id) => {
      if (!currentConflictIds.has(id)) {
        announcedConflictIdsRef.current.delete(id);
      }
    });
  }, [trains, blocks, predictedConflicts, cameraFocusKm]);

  // Teardown when component unmounts
  useEffect(() => {
    return () => {
      RailwayAudio.stopAll();
      VoiceOverEngine.stopAll();
    };
  }, []);
}
