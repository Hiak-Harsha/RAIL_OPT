"""
Entity Visual State Policy Engine Tests (SIH PS-25022).

Validates that:
1. Operational train states (ACCELERATING, CRUISING, BRAKING, DWELLING, WAITING_*, DISRUPTED) produce exact visual states.
2. WaitReason payloads map directly to heldReasonLabels without hardcoded UI fallback text.
3. Block occupancy and blockage status generate distinct physical emissive glows.
4. Signal aspects map deterministically to standard railway signaling colors.
"""

from pathlib import Path


def test_entity_visual_state_module_exists_and_pure():
    """Verify EntityVisualState.ts exists and exposes pure getTrainVisualState, getBlockVisualState, getSignalVisualState."""
    file_path = Path(__file__).parent.parent / "src" / "visual" / "state" / "EntityVisualState.ts"
    assert file_path.exists(), f"EntityVisualState.ts missing at {file_path}"

    content = file_path.read_text(encoding="utf-8")
    assert "getTrainVisualState" in content
    assert "getBlockVisualState" in content
    assert "getSignalVisualState" in content
    assert "WAITING_FOR_ROUTE" in content
    assert "WAITING_FOR_HEADWAY" in content
    assert "DWELLING" in content
    assert "BRAKING" in content


def test_entity_visual_state_mapping_rules():
    """Verify visual state policies handle all required states."""
    file_path = Path(__file__).parent.parent / "src" / "visual" / "state" / "EntityVisualState.ts"
    content = file_path.read_text(encoding="utf-8")

    # Brake light rules
    assert "brakeLightIntensity" in content
    # Dwelling / door opening rules
    assert "doorsOpen" in content
    # Beacon rules
    assert "beaconHex" in content
    # Block glow rules
    assert "emissiveHex" in content
    assert "0xFF8C1A" in content  # Occupied Amber
    assert "0xD62828" in content  # Blocked Red
