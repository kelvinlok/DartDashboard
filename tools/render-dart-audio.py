"""Render the deterministic electronic dartboard sound pack."""

import argparse
import math
import random
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 44_100
TARGET_PEAK = 10 ** (-1 / 20)


def sample_count(seconds):
    return max(1, int(round(seconds * SAMPLE_RATE)))


def envelope(signal, attack=0.005, release=0.05):
    result = list(signal)
    attack_samples = min(len(result), sample_count(attack))
    release_samples = min(len(result), sample_count(release))
    for index in range(attack_samples):
        result[index] *= index / max(1, attack_samples - 1)
    for index in range(release_samples):
        position = len(result) - release_samples + index
        result[position] *= 1 - index / max(1, release_samples - 1)
    return result


def oscillator(frequency, duration, waveform="sine", phase=0.0):
    result = []
    for index in range(sample_count(duration)):
        angle = 2 * math.pi * frequency * index / SAMPLE_RATE + phase
        if waveform == "triangle":
            value = 2 / math.pi * math.asin(math.sin(angle))
        elif waveform == "square":
            value = 1.0 if math.sin(angle) >= 0 else -1.0
        else:
            value = math.sin(angle)
        result.append(value)
    return result


def tone(frequency, duration, waveform="sine", attack=0.004, release=0.05):
    return envelope(oscillator(frequency, duration, waveform), attack, release)


def pitch_sweep(start_frequency, end_frequency, duration, waveform="sine"):
    result = []
    phase = 0.0
    length = sample_count(duration)
    for index in range(length):
        progress = index / max(1, length - 1)
        frequency = start_frequency + (end_frequency - start_frequency) * progress
        phase += 2 * math.pi * frequency / SAMPLE_RATE
        if waveform == "square":
            result.append(1.0 if math.sin(phase) >= 0 else -1.0)
        elif waveform == "triangle":
            result.append(2 / math.pi * math.asin(math.sin(phase)))
        else:
            result.append(math.sin(phase))
    return envelope(result, 0.003, min(0.08, duration / 2))


def filtered_noise(duration, cutoff=2_000, seed=0):
    rng = random.Random(seed)
    alpha = min(1.0, 2 * math.pi * cutoff / SAMPLE_RATE)
    low = 0.0
    result = []
    for _ in range(sample_count(duration)):
        low += alpha * (rng.uniform(-1, 1) - low)
        result.append(low)
    return envelope(result, 0.001, duration * 0.85)


def mix(layers):
    prepared = [(signal, sample_count(offset) - 1 if offset else 0, gain) for signal, offset, gain in layers]
    length = max((offset + len(signal) for signal, offset, _ in prepared), default=0)
    result = [0.0] * length
    for signal, offset, gain in prepared:
        for index, value in enumerate(signal):
            result[offset + index] += value * gain
    return result


def delay(signal, delay_seconds, gain=0.25):
    offset = sample_count(delay_seconds)
    result = list(signal) + [0.0] * offset
    for index, value in enumerate(signal):
        result[index + offset] += value * gain
    return result


def soft_clip(signal, drive=1.35):
    scale = math.tanh(drive)
    return [math.tanh(value * drive) / scale for value in signal]


def normalize(signal, peak=TARGET_PEAK):
    current_peak = max((abs(value) for value in signal), default=0.0)
    if current_peak == 0:
        return list(signal)
    gain = peak / current_peak
    return [value * gain for value in signal]


def boundary_fade(signal, duration=0.005):
    result = list(signal)
    fade_samples = min(len(result) // 2, sample_count(duration))
    for index in range(fade_samples):
        factor = index / max(1, fade_samples - 1)
        result[index] *= factor
        result[-1 - index] *= factor
    return result


def ensure_duration(signal, minimum_seconds):
    minimum_length = sample_count(minimum_seconds)
    return list(signal) + [0.0] * max(0, minimum_length - len(signal))


def master(signal, minimum_seconds=0.0):
    prepared = ensure_duration(signal, minimum_seconds)
    prepared = boundary_fade(soft_clip(prepared))
    return normalize(prepared)


def read_wav(path):
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        frame_rate = source.getframerate()
        frame_count = source.getnframes()
        raw = source.readframes(frame_count)

    if sample_width == 1:
        decoded = [(value - 128) / 128 for value in raw]
    elif sample_width == 2:
        decoded = [value / 32_768 for value in struct.unpack(f"<{len(raw) // 2}h", raw)]
    elif sample_width == 4:
        decoded = [value / 2_147_483_648 for value in struct.unpack(f"<{len(raw) // 4}i", raw)]
    else:
        raise ValueError(f"Unsupported {sample_width * 8}-bit voice WAV: {path}")

    mono = []
    for offset in range(0, len(decoded), channels):
        mono.append(sum(decoded[offset:offset + channels]) / channels)
    if frame_rate == SAMPLE_RATE:
        return mono

    output_length = int(round(len(mono) * SAMPLE_RATE / frame_rate))
    resampled = []
    for index in range(output_length):
        source_position = index * frame_rate / SAMPLE_RATE
        left = min(len(mono) - 1, int(source_position))
        right = min(len(mono) - 1, left + 1)
        fraction = source_position - left
        resampled.append(mono[left] * (1 - fraction) + mono[right] * fraction)
    return resampled


def trim_silence(signal):
    peak = max((abs(value) for value in signal), default=0.0)
    if peak == 0:
        raise ValueError("Rendered voice is silent")
    threshold = max(0.008, peak * 0.025)
    active = [index for index, value in enumerate(signal) if abs(value) >= threshold]
    padding = sample_count(0.015)
    start = max(0, active[0] - padding)
    end = min(len(signal), active[-1] + padding + 1)
    return signal[start:end]


def high_pass(signal, cutoff=110):
    if not signal:
        return []
    dt = 1 / SAMPLE_RATE
    rc = 1 / (2 * math.pi * cutoff)
    alpha = rc / (rc + dt)
    result = [0.0]
    previous_input = signal[0]
    for value in signal[1:]:
        filtered = alpha * (result[-1] + value - previous_input)
        result.append(filtered)
        previous_input = value
    return result


def process_voice(path):
    voice = trim_silence(read_wav(path))
    voice = normalize(high_pass(voice), 0.72)
    voice = delay(voice, 0.085, 0.2)
    return normalize(soft_clip(voice, 1.15), 0.76)


def impact(strength=1.0, seed=1, duration=0.16):
    return mix([
        (filtered_noise(duration, 2_600, seed), 0.0, 0.8 * strength),
        (pitch_sweep(190, 65, duration * 0.9, "sine"), 0.0, 0.7 * strength),
        (tone(1_900, min(0.045, duration), "square", 0.001, 0.04), 0.0, 0.16 * strength),
    ])


def notes(frequencies, duration=0.1, spacing=0.085, waveform="sine"):
    return mix([
        (tone(frequency, duration, waveform), index * spacing, 1.0)
        for index, frequency in enumerate(frequencies)
    ])


def render_pack(voices):
    single = mix([
        (impact(0.62, 11, 0.13), 0.0, 1.0),
        (tone(880, 0.105), 0.035, 0.45),
    ])
    double = mix([
        (impact(0.82, 22, 0.16), 0.0, 1.0),
        (notes([660, 990], 0.09, 0.085, "triangle"), 0.045, 0.52),
    ])
    triple_accent = delay(notes([660, 880, 1_320], 0.085, 0.075), 0.042, 0.24)
    triple = mix([
        (impact(0.96, 33, 0.17), 0.0, 1.0),
        (triple_accent, 0.035, 0.55),
    ])
    outer_bull = mix([
        (impact(1.02, 44, 0.2), 0.0, 0.9),
        (pitch_sweep(110, 58, 0.2), 0.0, 0.8),
        (filtered_noise(0.065, 5_500, 45), 0.012, 0.38),
        (pitch_sweep(440, 880, 0.26, "triangle"), 0.045, 0.46),
    ])
    turn_change = mix([
        (tone(523.25, 0.11, "triangle"), 0.0, 0.48),
        (tone(659.25, 0.12, "triangle"), 0.13, 0.42),
    ])

    bull_flourish = notes([523.25, 659.25, 783.99, 1_046.5], 0.13, 0.09)
    bullseye = mix([
        (impact(1.18, 55, 0.22), 0.0, 1.0),
        (pitch_sweep(220, 110, 0.2), 0.0, 0.75),
        (bull_flourish, 0.035, 0.62),
        (voices["bullseye"], 0.39, 0.92),
    ])
    bust = mix([
        (impact(0.58, 66, 0.19), 0.0, 0.8),
        (pitch_sweep(520, 145, 0.36, "square"), 0.03, 0.28),
        (pitch_sweep(470, 120, 0.36, "triangle"), 0.03, 0.34),
        (voices["bust"], 0.31, 0.9),
    ])
    checkout_fanfare = mix([
        (notes([523.25, 659.25, 783.99, 1_046.5], 0.15, 0.095), 0.0, 0.75),
        (tone(523.25, 0.3), 0.3, 0.35),
        (tone(659.25, 0.3), 0.3, 0.3),
        (tone(783.99, 0.3), 0.3, 0.3),
    ])
    checkout = mix([
        (impact(1.28, 77, 0.24), 0.0, 1.0),
        (checkout_fanfare, 0.035, 0.72),
        (voices["checkout"], 0.44, 0.96),
    ])

    return {
        "hit-single.wav": master(single),
        "hit-double.wav": master(double),
        "hit-triple.wav": master(triple),
        "outer-bull.wav": master(outer_bull),
        "bullseye.wav": master(bullseye, 0.75),
        "bust.wav": master(bust, 0.7),
        "checkout.wav": master(checkout, 0.8),
        "turn-change.wav": master(turn_change),
    }


def write_wav(path, signal):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = b"".join(struct.pack("<h", round(max(-1.0, min(1.0, value)) * 32_767)) for value in signal)
    with wave.open(str(path), "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(SAMPLE_RATE)
        destination.writeframes(pcm)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bullseye-voice", required=True, type=Path)
    parser.add_argument("--bust-voice", required=True, type=Path)
    parser.add_argument("--checkout-voice", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    arguments = parser.parse_args()

    voices = {
        "bullseye": process_voice(arguments.bullseye_voice),
        "bust": process_voice(arguments.bust_voice),
        "checkout": process_voice(arguments.checkout_voice),
    }
    pack = render_pack(voices)
    for filename, signal in pack.items():
        output_path = arguments.output_dir / filename
        write_wav(output_path, signal)
        size = output_path.stat().st_size
        print(f"{filename}: {len(signal) / SAMPLE_RATE:.3f}s, {size:,} bytes")


if __name__ == "__main__":
    main()
