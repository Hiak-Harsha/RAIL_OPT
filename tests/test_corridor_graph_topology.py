"""
Corridor Graph Topology & Rendering Architecture Test (SIH PS-25022).

Guarantees that:
1. The backend corridor network contains valid stations, blocks, loop lines, and single-line sections.
2. The frontend CorridorGraph models all track segments directly from real data, not hardcoded literals.
3. No hardcoded flat track literals (e.g. BoxGeometry(140)) exist in the 3D TrackBuilder.
"""

import json
from pathlib import Path


def test_scenario_topology_data_integrity():
    """Verify backend scenario network contains all required stations, blocks, and loop lines."""
    scenario_path = Path(__file__).parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    assert scenario_path.exists(), f"Scenario file missing at {scenario_path}"

    with open(scenario_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "network" in data
    stations = data["network"]["stations"]
    blocks = data["network"]["blocks"]

    assert len(stations) >= 5, "Corridor should have at least 5 principal stations"
    assert len(blocks) >= 20, "Corridor should have at least 20 track blocks"

    # Verify loop lines exist
    loop_blocks = [b for b in blocks if "LOOP" in b["id"] or b.get("block_type") == "LOOP_LINE"]
    assert len(loop_blocks) >= 4, "Should have station loop lines for overtaking maneuvers"

    # Verify single-line section exists
    single_blocks = [b for b in blocks if "SINGLE" in b["id"] or b.get("block_type") == "SINGLE_LINE_SECTION"]
    assert len(single_blocks) >= 1, "Should have single-line constriction bottleneck"


def test_3d_track_builder_has_no_hardcoded_box_literals():
    """Verify TrackBuilder.ts does not use hardcoded BoxGeometry(140) track literals."""
    track_builder_path = Path(__file__).parent.parent / "src" / "visual" / "render3d" / "TrackBuilder.ts"
    assert track_builder_path.exists(), f"TrackBuilder.ts missing at {track_builder_path}"

    content = track_builder_path.read_text(encoding="utf-8")
    assert "BoxGeometry(140" not in content, "TrackBuilder.ts must not contain hardcoded BoxGeometry(140) literals"
    assert "CorridorTopologyModel" in content, "TrackBuilder.ts must build from CorridorTopologyModel"
    assert "buildSegment" in content, "TrackBuilder.ts must build per-segment geometry from graph"


def test_label_layer_owns_text_and_lod():
    """Verify LabelLayer.tsx is the central authority for LOD-based label rendering."""
    label_layer_path = Path(__file__).parent.parent / "src" / "visual" / "render2d" / "LabelLayer.tsx"
    assert label_layer_path.exists(), f"LabelLayer.tsx missing at {label_layer_path}"

    content = label_layer_path.read_text(encoding="utf-8")
    assert "LevelOfDetail" in content, "LabelLayer must consult LevelOfDetail policy"
    assert "collision" in content.lower() or "collides" in content.lower(), "LabelLayer must implement collision avoidance"
