import { INTERACTION_CONFIG } from "./interactionConfig";
import type { InteractionState } from "./interactionConfig";
import type { RenderEntity, EntityRef } from "./RailwayRenderModel";
import type { RelationshipGraph } from "./RelationshipGraph";
import type { Point } from "./coordinateTransform";

export interface AttentionResult {
  primary: RenderEntity | null;
  related: RenderEntity[];
  scores: Record<string, number>;
  states: Record<string, InteractionState>;
  highestScore: number;
}

export const getEntityKey = (entity: { type: string; id: string }): string => {
  return `${entity.type}:${entity.id}`;
};

/**
 * 1D Spatial Hash Grid bucket size along the SVG X axis (1320 units total).
 * 120px bucket size guarantees that any entity within awarenessRadius (120px)
 * will be in the cursor's bucket or its immediate neighbor buckets.
 */
const BUCKET_SIZE = 120;

export class AttentionEngine {
  /**
   * Builds an O(1) spatial bucket index for fast proximity queries.
   */
  public static buildSpatialIndex(entities: RenderEntity[]): Map<number, RenderEntity[]> {
    const grid = new Map<number, RenderEntity[]>();
    for (const entity of entities) {
      const bucketIdx = Math.floor(entity.x / BUCKET_SIZE);
      const list = grid.get(bucketIdx) || [];
      list.push(entity);
      grid.set(bucketIdx, list);
    }
    return grid;
  }

  /**
   * Calculates continuous, multi-factor spatial attention across all rendered railway entities.
   * Employs spatial grid indexing to eliminate full $O(N)$ linear scans on every pointer move.
   */
  public static evaluate(
    cursor: Point | null,
    entities: RenderEntity[],
    graph: RelationshipGraph,
    selectedEntity: EntityRef | null,
    spatialGrid?: Map<number, RenderEntity[]>
  ): AttentionResult {
    const scores: Record<string, number> = {};
    const states: Record<string, InteractionState> = {};
    let primary: RenderEntity | null = null;
    let highestScore = 0;

    const { awarenessRadius, weights } = INTERACTION_CONFIG;

    // Use or build spatial index
    const grid = spatialGrid || this.buildSpatialIndex(entities);

    // Determine candidate entities for proximity check
    let proximityCandidates: RenderEntity[] = [];
    if (cursor && cursor.x >= 0 && cursor.y >= 0) {
      const cursorBucket = Math.floor(cursor.x / BUCKET_SIZE);
      for (let b = cursorBucket - 1; b <= cursorBucket + 1; b++) {
        const bucketEntities = grid.get(b);
        if (bucketEntities) {
          proximityCandidates.push(...bucketEntities);
        }
      }
    }

    const candidateSet = new Set(proximityCandidates.map(getEntityKey));

    for (const entity of entities) {
      const key = getEntityKey(entity);
      let proximityScore = 0;

      if (cursor && candidateSet.has(key)) {
        const dist = Math.hypot(cursor.x - entity.x, cursor.y - entity.y);
        if (dist <= awarenessRadius) {
          const normDist = Math.max(0, 1 - dist / awarenessRadius);
          // Cubic smoothing curve: p^2 * (3 - 2p)
          proximityScore = normDist * normDist * (3 - 2 * normDist);
        }
      }

      // Operational relevance & severity
      const severityScore = entity.severity;
      const operationalScore = entity.importance;

      // Base composite attention score
      let score =
        weights.proximity * proximityScore +
        weights.severity * severityScore +
        weights.operational * operationalScore;

      // Selection override boost
      const isSelected = selectedEntity && selectedEntity.type === entity.type && selectedEntity.id === entity.id;
      if (isSelected) {
        score += 2.0; // Dominates attention field
      }

      scores[key] = score;

      if (score > highestScore && (proximityScore > 0 || isSelected)) {
        highestScore = score;
        primary = entity;
      }
    }

    // Determine top-N related entities from graph if a primary entity is focused or selected
    let related: RenderEntity[] = [];
    if (primary) {
      const relatedRefs = graph.getRelatedEntities({ id: primary.id, type: primary.type });
      related = relatedRefs
        .map((ref) => entities.find((e) => e.type === ref.type && e.id === ref.id))
        .filter((e): e is RenderEntity => e !== undefined)
        .slice(0, 4); // Top-4 related operational neighbors

      // Boost related entity scores
      for (const rel of related) {
        const relKey = getEntityKey(rel);
        scores[relKey] = (scores[relKey] || 0) + weights.relationship * 0.8;
      }
    }

    // Classify into 4 Interaction States: ambient | aware | focused | selected
    for (const entity of entities) {
      const key = getEntityKey(entity);
      const isSelected = selectedEntity && selectedEntity.type === entity.type && selectedEntity.id === entity.id;
      if (isSelected) {
        states[key] = "selected";
        continue;
      }

      const score = scores[key] || 0;
      const isPrimary = primary && primary.type === entity.type && primary.id === entity.id;

      if (isPrimary && score >= 0.45) {
        states[key] = "focused";
      } else if (score >= 0.25 || related.some((r) => r.type === entity.type && r.id === entity.id)) {
        states[key] = "aware";
      } else {
        states[key] = "ambient";
      }
    }

    return {
      primary,
      related,
      scores,
      states,
      highestScore
    };
  }
}
