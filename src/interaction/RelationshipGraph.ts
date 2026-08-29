import type { Train, TrackBlock, Station, PredictedConflict } from "../types/railway";
import type { EntityRef } from "./RailwayRenderModel";

export interface RailwayGraphContext {
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  predictedConflicts: PredictedConflict[];
}

export class RelationshipGraph {
  private context: RailwayGraphContext;

  constructor(context: RailwayGraphContext) {
    this.context = context;
  }

  public updateContext(context: RailwayGraphContext) {
    this.context = context;
  }

  /**
   * Returns all topologically and operationally related entities for a given entity.
   * Resolves authentic signal references and operational connections.
   */
  public getRelatedEntities(target: EntityRef): EntityRef[] {
    const related: EntityRef[] = [];
    const seen = new Set<string>();

    const addRef = (ref: EntityRef) => {
      const key = `${ref.type}:${ref.id}`;
      if (!seen.has(key) && !(ref.type === target.type && ref.id === target.id)) {
        seen.add(key);
        related.push(ref);
      }
    };

    if (target.type === "TRAIN") {
      const train = this.context.trains.find((t) => t.train_id === target.id);
      if (train) {
        // 1. Current block & its signals
        if (train.current_block_id) {
          addRef({ id: train.current_block_id, type: "BLOCK" });
          const currBlock = this.context.blocks.find(b => b.id === train.current_block_id);
          if (currBlock && currBlock.signals) {
            for (const sigId of currBlock.signals) {
              addRef({ id: sigId, type: "SIGNAL" });
            }
          }
        }

        // 2. Next blocks in route
        for (const blockId of train.route_block_ids.slice(train.route_index, train.route_index + 3)) {
          addRef({ id: blockId, type: "BLOCK" });
        }

        // 3. Active conflicts involving this train
        for (const conf of this.context.predictedConflicts) {
          if (conf.involved_train_ids.includes(train.train_id)) {
            addRef({ id: conf.conflict_id, type: "CONFLICT" });
            if (conf.location_block_id) {
              addRef({ id: conf.location_block_id, type: "BLOCK" });
            }
            // Opposing conflict trains
            for (const otherId of conf.involved_train_ids) {
              if (otherId !== train.train_id) {
                addRef({ id: otherId, type: "TRAIN" });
              }
            }
          }
        }
      }
    } else if (target.type === "CONFLICT") {
      const conf = this.context.predictedConflicts.find((c) => c.conflict_id === target.id);
      if (conf) {
        // 1. Involved trains
        for (const tid of conf.involved_train_ids) {
          addRef({ id: tid, type: "TRAIN" });
        }
        // 2. Conflict location block and signals
        if (conf.location_block_id) {
          addRef({ id: conf.location_block_id, type: "BLOCK" });
          const block = this.context.blocks.find(b => b.id === conf.location_block_id);
          if (block && block.signals) {
            for (const sigId of block.signals) {
              addRef({ id: sigId, type: "SIGNAL" });
            }
          }
        }
      }
    } else if (target.type === "BLOCK") {
      const block = this.context.blocks.find((b) => b.id === target.id);
      if (block) {
        // 1. Authentic Signals on this block
        if (block.signals) {
          for (const sigId of block.signals) {
            addRef({ id: sigId, type: "SIGNAL" });
          }
        }
        // 2. Occupying train
        if (block.occupied_by_train_id) {
          addRef({ id: block.occupied_by_train_id, type: "TRAIN" });
        }
        // 3. Conflicts at this block
        for (const conf of this.context.predictedConflicts) {
          if (conf.location_block_id === block.id) {
            addRef({ id: conf.conflict_id, type: "CONFLICT" });
            for (const tid of conf.involved_train_ids) {
              addRef({ id: tid, type: "TRAIN" });
            }
          }
        }
        // 4. From / To Stations
        if (block.from_node) addRef({ id: block.from_node, type: "STATION" });
        if (block.to_node) addRef({ id: block.to_node, type: "STATION" });
      }
    } else if (target.type === "SIGNAL") {
      // Find block containing this signal
      const parentBlock = this.context.blocks.find(b => b.signals && b.signals.includes(target.id));
      if (parentBlock) {
        addRef({ id: parentBlock.id, type: "BLOCK" });
        if (parentBlock.occupied_by_train_id) {
          addRef({ id: parentBlock.occupied_by_train_id, type: "TRAIN" });
        }
      }
    } else if (target.type === "STATION") {
      const stn = this.context.stations.find((s) => s.id === target.id || s.code === target.id);
      if (stn) {
        for (const plat of stn.platforms) {
          addRef({ id: plat.id, type: "PLATFORM" });
        }
        for (const lb of stn.loop_blocks) {
          addRef({ id: lb, type: "BLOCK" });
        }
      }
    } else if (target.type === "PLATFORM") {
      // Find parent station
      const parentStn = this.context.stations.find(s => s.platforms && s.platforms.some(p => p.id === target.id));
      if (parentStn) {
        addRef({ id: parentStn.id, type: "STATION" });
      }
    }

    return related;
  }
}
