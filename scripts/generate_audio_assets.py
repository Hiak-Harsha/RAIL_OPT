"""
RAILOPT-X 2.0 — Authentic Audio Asset Generator
Generates clean, CC0-licensed standard PCM audio stems for the railway sound engine.
"""

import math
import struct
import wave
from pathlib import Path

AUDIO_DIR = Path(__file__).parents[1] / "public" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_RATE = 44100


def create_wav_file(filename: str, samples: list[float]):
    filepath = AUDIO_DIR / filename
    with wave.open(str(filepath), "w") as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(SAMPLE_RATE)
        packed = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767.0))))
            for s in samples
        )
        wav.writeframes(packed)
    print(f"Generated audio asset: {filename} ({len(samples)} samples)")


def generate_relay_click():
    # 35ms mechanical transient
    duration_s = 0.035
    total_samples = int(SAMPLE_RATE * duration_s)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 90.0)
        freq = 1200.0 * math.exp(-t * 40.0)
        val = 0.4 * math.sin(2 * math.pi * freq * t) * env
        samples.append(val)
    create_wav_file("relay-click.ogg", samples)
    create_wav_file("relay-click.wav", samples)


def generate_route_lock():
    # 250ms interlocking point machine latch
    duration_s = 0.25
    total_samples = int(SAMPLE_RATE * duration_s)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 18.0)
        f1 = 90.0 + 30.0 * math.sin(2 * math.pi * 15 * t)
        f2 = 180.0
        val = (0.45 * math.sin(2 * math.pi * f1 * t) + 0.25 * math.sin(2 * math.pi * f2 * t)) * env
        samples.append(val)
    create_wav_file("route-lock.ogg", samples)
    create_wav_file("route-lock.wav", samples)


def generate_controller_alert():
    # 400ms soft dual-tone chime (440Hz / 880Hz)
    duration_s = 0.4
    total_samples = int(SAMPLE_RATE * duration_s)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 7.0)
        val = (0.3 * math.sin(2 * math.pi * 440.0 * t) + 0.2 * math.sin(2 * math.pi * 880.0 * t)) * env
        samples.append(val)
    create_wav_file("controller-alert.ogg", samples)
    create_wav_file("controller-alert.wav", samples)


def generate_teleprinter():
    # 30ms mechanical key strike
    duration_s = 0.03
    total_samples = int(SAMPLE_RATE * duration_s)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 120.0)
        val = 0.35 * (math.sin(2 * math.pi * 650.0 * t) + 0.5 * math.sin(2 * math.pi * 1300.0 * t)) * env
        samples.append(val)
    create_wav_file("teleprinter.ogg", samples)
    create_wav_file("teleprinter.wav", samples)


def generate_train_loop(filename: str, base_freq: float, harmonics: list[float], has_click: bool = True):
    # 2.0 second seamless loop
    duration_s = 2.0
    total_samples = int(SAMPLE_RATE * duration_s)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        val = 0.25 * math.sin(2 * math.pi * base_freq * t)
        for h_idx, mult in enumerate(harmonics):
            val += (0.12 / (h_idx + 1.2)) * math.sin(2 * math.pi * (base_freq * mult) * t)
        
        # Periodic wheel joint click at ~0.65s and ~1.45s
        if has_click:
            for click_time in [0.45, 0.49, 1.25, 1.29]:
                dt = t - click_time
                if 0 <= dt <= 0.02:
                    val += 0.2 * math.exp(-dt * 200.0) * math.sin(2 * math.pi * 850.0 * dt)

        samples.append(val * 0.5)
    
    create_wav_file(f"{filename}.ogg", samples)
    create_wav_file(f"{filename}.wav", samples)


if __name__ == "__main__":
    generate_relay_click()
    generate_route_lock()
    generate_controller_alert()
    generate_teleprinter()
    generate_train_loop("train-express-loop", 80.0, [1.5, 2.0, 3.0], has_click=True)
    generate_train_loop("train-freight-loop", 48.0, [2.0, 3.0, 4.0], has_click=True)
    generate_train_loop("train-memu-loop", 110.0, [2.0, 4.0], has_click=False)
    generate_train_loop("train-passenger-loop", 70.0, [1.5, 2.0], has_click=True)
    print("All authentic audio stems generated successfully.")
