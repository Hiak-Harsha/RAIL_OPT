"""
Tests for Voice-Over phonetic number formatting and event alert phrase generation (Task 6).
"""
import pytest
import re

def phonetize(text: str) -> str:
    digit_map = {
        "0": "zero ",
        "1": "one ",
        "2": "two ",
        "3": "three ",
        "4": "four ",
        "5": "five ",
        "6": "six ",
        "7": "seven ",
        "8": "eight ",
        "9": "nine ",
    }
    def replace_match(match):
        digits = match.group(1)
        spelled = "".join(digit_map[d] for d in digits)
        return f"train {spelled.strip()}"

    return re.sub(r"(?:train\s+)?\bT?(\d{4,5})\b", replace_match, text, flags=re.IGNORECASE)

def test_phonetize_vande_bharat_train_number():
    raw = "Approaching train T22436 at Aligarh"
    phonetic = phonetize(raw)
    assert phonetic == "Approaching train two two four three six at Aligarh"

def test_phonetize_freight_train_number():
    raw = "Hold freight T04403 in loop 1"
    phonetic = phonetize(raw)
    assert phonetic == "Hold freight train zero four four zero three in loop 1"

def test_phonetize_multiple_trains():
    raw = "Conflict between T12301 and 12423"
    phonetic = phonetize(raw)
    assert "one two three zero one" in phonetic
    assert "one two four two three" in phonetic
