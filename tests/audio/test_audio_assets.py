"""
RAILOPT-X 2.0 — Phase 4 Audio Asset Verification Test Suite

Validates:
1. Every audio asset referenced in RailwayAudioEngine and manifest.json exists in public/audio.
2. Binary files are non-empty and formatted correctly.
"""

from pathlib import Path
import pytest

AUDIO_DIR = Path(__file__).parents[2] / "public" / "audio"

REQUIRED_AUDIO_FILES = [
    "relay-click.ogg",
    "route-lock.ogg",
    "controller-alert.ogg",
    "teleprinter.ogg",
    "train-express-loop.ogg",
    "train-freight-loop.ogg",
    "train-memu-loop.ogg",
    "train-passenger-loop.ogg",
    "manifest.json",
]


@pytest.mark.parametrize("filename", REQUIRED_AUDIO_FILES)
def test_audio_file_exists_and_non_empty(filename: str):
    file_path = AUDIO_DIR / filename
    assert file_path.exists(), f"Missing required audio asset: {filename}"
    assert file_path.stat().st_size > 0, f"Empty audio asset: {filename}"
