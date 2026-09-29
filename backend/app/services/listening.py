import asyncio
import json
import logging
import os
import re
import wave
from io import BytesIO
from pathlib import Path

import edge_tts
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

DATA_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "listening_tests.json"
)

_audio_cache: dict[str, tuple[bytes, str]] = {}

TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"]

DEFAULT_VOICE = "Kore"

# Person A (Student) -> female neural voice, Person B (Agent) -> male neural
# voice. Overridable per test via the "edge_tts_voices" key in listening_tests.json.
DEFAULT_EDGE_TTS_VOICES: dict[str, str] = {
    "Student": "en-GB-SoniaNeural",
    "Agent": "en-GB-RyanNeural",
}

GENDER_LABELS: dict[str, str] = {
    "Student": "Female",
    "Agent": "Male",
}

IELTS_LISTENING_BANDS: list[tuple[int, float]] = [
    (40, 9.0),
    (39, 9.0),
    (38, 8.5),
    (37, 8.5),
    (36, 8.0),
    (35, 8.0),
    (34, 7.5),
    (33, 7.5),
    (32, 7.5),
    (31, 7.0),
    (30, 7.0),
    (29, 6.5),
    (28, 6.5),
    (27, 6.5),
    (26, 6.5),
    (25, 6.0),
    (24, 6.0),
    (23, 6.0),
    (22, 5.5),
    (21, 5.5),
    (20, 5.5),
    (19, 5.5),
    (18, 5.5),
    (17, 5.0),
    (16, 5.0),
    (15, 4.5),
    (14, 4.5),
    (13, 4.5),
    (12, 4.0),
    (11, 4.0),
    (10, 4.0),
    (9, 3.5),
    (8, 3.5),
    (7, 3.0),
    (6, 3.0),
    (5, 2.5),
    (4, 2.5),
    (3, 2.0),
    (2, 1.0),
    (1, 1.0),
    (0, 0.0),
]


def _load_tests() -> list[dict]:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["tests"]


def get_test(test_id: str) -> dict:
    for test in _load_tests():
        if test["id"] == test_id:
            return test
    raise KeyError(f"Unknown listening test: {test_id}")


def list_tests_public() -> list[dict]:
    tests = []
    for test in _load_tests():
        questions = []
        for q in test["questions"]:
            questions.append(
                {
                    "id": q["id"],
                    "number": q["number"],
                    "type": q["type"],
                    "prompt": q["prompt"],
                    "label": q["label"],
                    "options": q.get("options"),
                    "timestamp": q.get("timestamp"),
                }
            )
        tests.append(
            {
                "id": test["id"],
                "title": test["title"],
                "subtitle": test["subtitle"],
                "section": test["section"],
                "instructions": test["instructions"],
                "audio_url": f"/api/v1/listening/audio/{test['id']}",
                "expected_duration_seconds": test.get("expected_duration_seconds", 70),
                "total_questions": len(questions),
                "questions": questions,
            }
        )
    return tests


def _status_code(exc: Exception) -> int | None:
    return (
        getattr(exc, "status_code", None)
        or getattr(exc, "code", None)
        or getattr(exc, "status", None)
    )


GEMINI_TTS_TIMEOUT_SECONDS = 20.0


def _tts_speak_dialogue(test: dict) -> tuple[bytes, int]:
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY"),
        http_options=types.HttpOptions(timeout=GEMINI_TTS_TIMEOUT_SECONDS),
    )

    speaker_voices = test.get("speaker_voices", {})
    speakers: list[str] = []
    for line in test["transcript"]:
        if line["speaker"] not in speakers:
            speakers.append(line["speaker"])

    speakers_config = test.get("speakers_config") or {}
    person_a_cfg = speakers_config.get("person_a") or {}
    person_b_cfg = speakers_config.get("person_b") or {}
    person_a = person_a_cfg.get("speaker") or (speakers[0] if speakers else "Person A")
    person_b = person_b_cfg.get("speaker") or (
        speakers[1] if len(speakers) > 1 else person_a
    )
    person_a_desc = person_a_cfg.get("description", "a young female")
    person_b_desc = person_b_cfg.get("description", "a male")

    dialogue = "\n".join(
        f"{line['speaker']}: {line['text']}" for line in test["transcript"]
    )
    prompt = (
        f"Speak this two-person IELTS Listening conversation. Give {person_a} "
        f"({person_a_desc}) and {person_b} ({person_b_desc}) clearly distinct "
        "voices, and read each turn exactly in the labelled order with natural "
        "pauses:\n\n"
        f"{dialogue}"
    )

    speaker_voice_configs = [
        types.SpeakerVoiceConfig(
            speaker=speaker,
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=speaker_voices.get(speaker, DEFAULT_VOICE)
                )
            ),
        )
        for speaker in speakers
    ]

    last_exc: Exception | None = None
    for model in TTS_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                            speaker_voice_configs=speaker_voice_configs
                        )
                    ),
                ),
            )
            part = response.candidates[0].content.parts[0]
            inline = part.inline_data
            if inline is None:
                raise RuntimeError("No inline audio returned by TTS model")
            match = re.search(r"rate=(\d+)", inline.mime_type or "")
            rate = int(match.group(1)) if match else 24000
            return inline.data, rate
        except Exception as exc:
            last_exc = exc
            code = _status_code(exc)
            logger.warning(
                "Multi-speaker TTS model %s failed%s: %s",
                model,
                f" (HTTP {code})" if code else "",
                exc,
            )
    raise RuntimeError("All TTS models failed") from last_exc


def _wav_bytes(pcm: bytes, sample_rate: int) -> bytes:
    buf = BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def _synthesize_gemini_audio(test: dict) -> bytes:
    pcm, sample_rate = _tts_speak_dialogue(test)
    return _wav_bytes(pcm, sample_rate)


def _edge_tts_mp3(lines: list[tuple[str, str]]) -> bytes:
    output = BytesIO()

    async def _synthesize() -> None:
        for text, voice in lines:
            communicate = edge_tts.Communicate(text, voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    output.write(chunk["data"])

    asyncio.run(_synthesize())
    return output.getvalue()


def _synthesize_edge_tts_audio(test: dict) -> bytes:
    edge_voices = test.get("edge_tts_voices") or {}
    lines: list[tuple[str, str]] = []
    for line in test["transcript"]:
        speaker = line["speaker"]
        voice = (
            edge_voices.get(speaker)
            or DEFAULT_EDGE_TTS_VOICES.get(speaker)
            or "en-GB-SoniaNeural"
        )
        logger.info(
            "[TTS] Synthesizing %s (%s)...",
            speaker,
            GENDER_LABELS.get(speaker, voice),
        )
        lines.append((line["text"], voice))
    return _edge_tts_mp3(lines)


def synthesize_test_audio(test_id: str) -> tuple[bytes, str]:
    cached = _audio_cache.get(test_id)
    if cached:
        return cached
    test = get_test(test_id)
    try:
        audio = _synthesize_gemini_audio(test)
        media_type = "audio/wav"
    except Exception as exc:
        code = _status_code(exc)
        if code in (429, 503):
            logger.warning(
                "Gemini TTS rate limited (HTTP %s) for %s, falling back to edge-tts: %s",
                code,
                test_id,
                exc,
            )
        else:
            logger.exception(
                "Gemini TTS failed for %s, falling back to edge-tts: %s", test_id, exc
            )
        try:
            audio = _synthesize_edge_tts_audio(test)
            media_type = "audio/mpeg"
        except Exception as fallback_exc:
            logger.exception(
                "edge-tts fallback failed for %s: %s", test_id, fallback_exc
            )
            raise RuntimeError("Could not synthesize listening audio") from fallback_exc
    _audio_cache[test_id] = (audio, media_type)
    return audio, media_type


def _normalize(value: str) -> str:
    text = value.strip().lower()
    text = text.replace("£", "").replace("$", "").replace(",", "").replace(".", "")
    return " ".join(text.split())


def _answer_matches(correct: str, given: str) -> bool:
    normalized_correct = _normalize(correct)
    normalized_given = _normalize(given)
    if not normalized_given:
        return False
    if normalized_correct == normalized_given:
        return True
    correct_digits = re.sub(r"[^0-9]", "", normalized_correct)
    given_digits = re.sub(r"[^0-9]", "", normalized_given)
    return bool(correct_digits) and correct_digits == given_digits


def _band_from_scaled(scaled: int) -> float:
    for threshold, band in IELTS_LISTENING_BANDS:
        if scaled >= threshold:
            return band
    return 0.0


def band_score(raw_score: int, total_questions: int) -> float:
    if total_questions <= 0:
        return 0.0
    scaled = max(0, min(40, round(raw_score / total_questions * 40)))
    return _band_from_scaled(scaled)


def grade_test(test_id: str, answers: dict[str, str]) -> dict:
    test = get_test(test_id)
    questions = test["questions"]
    transcript = test["transcript"]

    feedback = []
    correct_count = 0
    for question in questions:
        given = (answers.get(question["id"]) or "").strip()
        is_correct = _answer_matches(question["answer"], given)
        if is_correct:
            correct_count += 1
        feedback.append(
            {
                "id": question["id"],
                "number": question["number"],
                "type": question["type"],
                "label": question["label"],
                "user_answer": given,
                "correct_answer": question["answer"],
                "is_correct": is_correct,
                "excerpt": question["excerpt"],
                "timestamp": question.get("timestamp"),
            }
        )

    answer_lines = []
    for index, line in enumerate(transcript):
        if any(question["excerpt"] in line["text"] for question in questions):
            answer_lines.append(index)

    return {
        "test_id": test_id,
        "raw_score": correct_count,
        "total_questions": len(questions),
        "correct_count": correct_count,
        "incorrect_count": len(questions) - correct_count,
        "band_score": band_score(correct_count, len(questions)),
        "feedback": feedback,
        "transcript": transcript,
        "answer_lines": answer_lines,
    }
