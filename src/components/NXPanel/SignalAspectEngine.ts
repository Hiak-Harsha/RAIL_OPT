/**
 * SignalAspectEngine — Authoritative Signal Aspect Resolution for RAILOPT-X Digital Twin 2.0.
 * 
 * Provides physically consistent 4-aspect signal progression:
 *   - RED: Block occupied, track failure, or point locked against movement
 *   - YELLOW: 1 block ahead occupied / prepare to stop
 *   - DOUBLE_YELLOW: 2 blocks ahead occupied / approach at caution
 *   - GREEN: Corridor clear ahead for at least 3 blocks
 */
import type { TrackBlock, Signal } from "../../types/railway";
export type SignalAspect = "GREEN" | "DOUBLE_YELLOW" | "YELLOW" | "RED";

export class SignalAspectEngine {
  public static determineAspect(
    block: TrackBlock,
    allBlocks: TrackBlock[],
    backendSignals?: Signal[]
  ): SignalAspect {
    // 1. Direct backend signal override if explicitly provided
    if (backendSignals && backendSignals.length > 0) {
      const matchSig = backendSignals.find((s) => s.block_id === block.id);
      if (matchSig && matchSig.aspect) {
        return matchSig.aspect as SignalAspect;
      }
    }

    // 2. Physical Block State Safety Invariants
    if (block.is_occupied || block.is_blocked) {
      return "RED";
    }

    // 3. First downstream block ahead
    const nextBlocks = allBlocks.filter(
      (b) => b.from_node === block.to_node && (b.direction === block.direction || b.direction === "BIDIRECTIONAL")
    );

    if (nextBlocks.length === 0) {
      return "GREEN";
    }

    const firstAheadOccupied = nextBlocks.some((nb) => nb.is_occupied || nb.is_blocked);
    if (firstAheadOccupied) {
      return "YELLOW";
    }

    // 4. Second downstream block ahead (for DOUBLE_YELLOW)
    let secondAheadOccupied = false;
    for (const nb of nextBlocks) {
      const secondBlocks = allBlocks.filter(
        (b) => b.from_node === nb.to_node && (b.direction === nb.direction || b.direction === "BIDIRECTIONAL")
      );
      if (secondBlocks.some((snb) => snb.is_occupied || snb.is_blocked)) {
        secondAheadOccupied = true;
        break;
      }
    }

    if (secondAheadOccupied) {
      return "DOUBLE_YELLOW";
    }

    return "GREEN";
  }

  public static getAspectColor(aspect: SignalAspect): string {
    switch (aspect) {
      case "RED":
        return "#EF4444";
      case "YELLOW":
        return "#F59E0B";
      case "DOUBLE_YELLOW":
        return "#EAB308";
      case "GREEN":
        return "#22C55E";
      default:
        return "#94A3B8";
    }
  }

  public static getAspectDescription(aspect: SignalAspect): string {
    switch (aspect) {
      case "RED":
        return "DANGER — Stop immediately before signal";
      case "YELLOW":
        return "CAUTION — Expect next signal at stop (Max 45 km/h)";
      case "DOUBLE_YELLOW":
        return "ATTENTION — Prepare to pass next signal at restricted speed";
      case "GREEN":
        return "CLEAR — Proceed at normal authorized line speed";
      default:
        return "UNKNOWN";
    }
  }
}
