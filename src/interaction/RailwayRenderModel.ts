import type { Train, TrackBlock, Station, Signal, Platform, PredictedConflict } from "../types/railway";
import type { SignalAspect } from "../components/NXPanel/SignalHead";

export type EntityType = "TRAIN" | "BLOCK" | "SIGNAL" | "STATION" | "PLATFORM" | "CONFLICT";

export interface EntityRef {
  id: string;
  type: EntityType;
}

export interface RenderEntity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  importance: number;  // 0.0 to 1.0
  severity: number;    // 0.0 to 1.0 (0=normal, 1=critical safety hazard)
  data: any;
  label: string;
  secondaryLabel?: string;
}

export interface RailwayRenderModelInput {
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  signals?: Signal[];
  platforms?: Platform[];
  predictedConflicts: PredictedConflict[];
  scaleX: (km: number) => number;
  trainPositions: Record<string, { x: number; y: number }>;
  yUpMain: number;
  yDownMain: number;
  ySingleLine: number;
  getBlockSignalAspect: (block: TrackBlock) => SignalAspect;
}

export function buildRailwayRenderModel({
  trains,
  blocks,
  stations,
  signals = [],
  platforms = [],
  predictedConflicts,
  scaleX,
  trainPositions,
  yUpMain,
  yDownMain,
  ySingleLine,
  getBlockSignalAspect
}: RailwayRenderModelInput): RenderEntity[] {
  const entities: RenderEntity[] = [];

  // 1. Render Trains
  for (const train of trains) {
    const pos = trainPositions[train.train_id] || {
      x: scaleX(train.corridor_position_km ?? train.current_position_km),
      y: train.direction === "UP" ? yUpMain : yDownMain
    };

    // Higher importance for Vande Bharat (P5) and Rajdhani (P4)
    const importance = train.priority >= 5 ? 1.0 : train.priority === 4 ? 0.85 : train.priority === 3 ? 0.7 : 0.5;
    
    // Severity from delay and status
    const delayMin = train.total_delay_sec / 60.0;
    const severity = train.status === "DISRUPTED" ? 1.0 : delayMin > 10 ? 0.8 : delayMin > 3 ? 0.4 : 0.1;

    entities.push({
      id: train.train_id,
      type: "TRAIN",
      x: pos.x,
      y: pos.y,
      importance,
      severity,
      data: train,
      label: `${train.train_number} ${train.train_name}`,
      secondaryLabel: `${Math.round(train.current_speed_kmh)} km/h • ${delayMin > 0 ? `+${Math.round(delayMin)}m` : "ON-TIME"}`
    });
  }

  // 2. Render Predicted Conflicts
  for (const conf of predictedConflicts) {
    const targetBlock = blocks.find((b) => b.id === conf.location_block_id);
    let x = scaleX(170); // default bottleneck center
    let y = ySingleLine;

    if (targetBlock) {
      const fStn = stations.find((s) => s.id === targetBlock.from_node);
      const tStn = stations.find((s) => s.id === targetBlock.to_node);
      if (fStn && tStn) {
        x = scaleX((fStn.position_km + tStn.position_km) / 2);
        const isSingle = targetBlock.id.includes("SINGLE") || targetBlock.block_type === "SINGLE_LINE_SECTION";
        y = isSingle ? ySingleLine : (targetBlock.direction === "UP" ? yUpMain : yDownMain);
      }
    }

    const severity = conf.severity === "CRITICAL" ? 1.0 : conf.severity === "HIGH" ? 0.85 : 0.6;

    entities.push({
      id: conf.conflict_id,
      type: "CONFLICT",
      x,
      y,
      importance: 1.0,
      severity,
      data: conf,
      label: `CONFLICT ${conf.conflict_id}`,
      secondaryLabel: `${conf.conflict_nature} (TTC: ${conf.time_to_conflict_sec.toFixed(0)}s)`
    });
  }

  // 3. Render Track Blocks
  for (const block of blocks) {
    const fromStn = stations.find((s) => s.id === block.from_node);
    const toStn = stations.find((s) => s.id === block.to_node);
    if (!fromStn || !toStn) continue;

    const x = scaleX((fromStn.position_km + toStn.position_km) / 2);
    const isSingle = block.id.includes("SINGLE") || block.block_type === "SINGLE_LINE_SECTION";
    const y = isSingle ? ySingleLine : (block.direction === "UP" ? yUpMain : yDownMain);

    const importance = block.is_occupied || block.is_blocked ? 0.8 : 0.4;
    const severity = block.is_blocked ? 1.0 : block.is_occupied ? 0.5 : 0.0;

    entities.push({
      id: block.id,
      type: "BLOCK",
      x,
      y,
      importance,
      severity,
      data: block,
      label: block.name,
      secondaryLabel: `${block.length_km.toFixed(1)} km • Max ${block.current_speed_limit_kmh} km/h`
    });
  }

  // 4. Render Authentic Backend Signals (or block-derived fallback)
  if (signals && signals.length > 0) {
    for (const sig of signals) {
      const parentBlock = blocks.find(b => b.signals && b.signals.includes(sig.id));
      let sigX = scaleX(100.0);
      let sigY = yUpMain;

      if (parentBlock) {
        const fromStn = stations.find(s => s.id === parentBlock.from_node);
        const toStn = stations.find(s => s.id === parentBlock.to_node);
        if (fromStn && toStn) {
          const isUp = parentBlock.direction === "UP";
          sigX = isUp ? scaleX(fromStn.position_km) + 38 : scaleX(toStn.position_km) - 38;
          sigY = isUp ? yUpMain : yDownMain;
        }
      }

      const aspect = sig.aspect;
      const severity = aspect === "RED" ? 0.7 : aspect === "YELLOW" ? 0.4 : 0.0;

      entities.push({
        id: sig.id,
        type: "SIGNAL",
        x: sigX,
        y: sigY,
        importance: 0.6,
        severity,
        data: sig,
        label: `SIGNAL ${sig.id}`,
        secondaryLabel: `${sig.aspect} • Interlocking Active`
      });
    }
  } else {
    // Fallback iteration over blocks
    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      const fromStn = stations.find((s) => s.id === b.from_node);
      const toStn = stations.find((s) => s.id === b.to_node);
      if (!fromStn || !toStn) continue;

      const isUp = b.direction === "UP";
      const sigX = isUp ? scaleX(fromStn.position_km) + 38 : scaleX(toStn.position_km) - 38;
      const sigY = isUp ? yUpMain : yDownMain;
      const aspect = getBlockSignalAspect(b);
      const severity = aspect === "RED" ? 0.7 : aspect === "YELLOW" ? 0.4 : 0.0;
      const sigId = (b.signals && b.signals.length > 0) ? b.signals[0] : `SIG_${b.id}`;

      entities.push({
        id: sigId,
        type: "SIGNAL",
        x: sigX,
        y: sigY,
        importance: 0.6,
        severity,
        data: { signalId: sigId, aspect, blockId: b.id, direction: isUp ? "UP" : "DOWN" },
        label: `SIGNAL ${sigId}`,
        secondaryLabel: `${aspect} • Direction: ${isUp ? "UP" : "DOWN"}`
      });
    }
  }

  // 5. Render Platforms
  for (const plat of platforms) {
    const parentStn = stations.find(s => s.id === plat.station_id || s.code === plat.station_id);
    const x = parentStn ? scaleX(parentStn.position_km) : scaleX(100.0);
    const y = (yUpMain + yDownMain) / 2 + 15;

    entities.push({
      id: plat.id,
      type: "PLATFORM",
      x,
      y,
      importance: 0.65,
      severity: plat.is_occupied ? 0.3 : 0.0,
      data: plat,
      label: `PLATFORM ${plat.name}`,
      secondaryLabel: plat.is_occupied ? `OCCUPIED BY ${plat.occupied_by}` : `AVAILABLE (${plat.length_meters}m)`
    });
  }

  // 6. Render Stations
  for (const stn of stations) {
    const x = scaleX(stn.position_km);
    entities.push({
      id: stn.id,
      type: "STATION",
      x,
      y: (yUpMain + yDownMain) / 2,
      importance: 0.7,
      severity: 0.0,
      data: stn,
      label: `${stn.name} (${stn.code})`,
      secondaryLabel: `KM ${stn.position_km.toFixed(1)}`
    });
  }

  return entities;
}
