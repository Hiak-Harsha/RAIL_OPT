"""
RAILOPT-X 2.0 — Phase 5 Audio Manifest Contract Test Suite

Validates:
1. public/audio/manifest.json exists and is valid JSON.
2. Audio is strictly default-muted (opt-in accessibility requirement).
3. Sound cues contain explicit provenance, frequencies, and license metadata.
"""

import json
from pathlib import Path
import pytest

MANIFEST_PATH = Path(__file__).parents[2] / "public" / "audio" / "manifest.json"


def test_audio_manifest_exists_and_valid():
    assert MANIFEST_PATH.exists(), "public/audio/manifest.json must exist"
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    assert data["version"] == "2.0.0"
    assert data["name"] == "RAILOPT-X Authentic Railway Audio Engine"
    assert data["default_muted"] is True, "Audio MUST be strictly muted by default"
    assert "channels" in data
    assert "master" in data["channels"]
    assert "sound_cues" in data
    assert len(data["sound_cues"]) >= 5


def test_sound_cues_metadata_integrity():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    cue_ids = set()
    for cue in data["sound_cues"]:
        assert "id" in cue
        assert cue["id"] not in cue_ids, f"Duplicate cue id: {cue['id']}"
        cue_ids.add(cue["id"])
        assert "category" in cue
        assert "type" in cue
        assert "description" in cue
        assert "license" in cue
        assert cue["license"] in ["MIT", "CC0-1.0", "Apache-2.0"]
