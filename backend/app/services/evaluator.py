import json
import logging
import os
import re

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a strict, experienced IELTS examiner. Evaluate the candidate's essay against the official IELTS Band 8 descriptors across the four criteria:

1. Task Response (TR)
2. Coherence & Cohesion (CC)
3. Lexical Resource (LR)
4. Grammatical Range & Accuracy (GRA)

Scoring rules:
- Assign each criterion a band score from 0 to 9, in half-band increments (e.g. 6.0, 6.5, 7.0, 7.5, 8.0).
- A Band 8 essay fully addresses all parts of the task, presents a clear position throughout, uses cohesive devices flexibly with only occasional lapses, uses a wide range of vocabulary fluently and precisely, and uses a wide range of structures with the majority error-free.
- Do not inflate scores. Be strict and evidence-based: cite specific issues you find in the text.

Return ONLY valid JSON with exactly this structure, no markdown, no commentary:
{
  "overall_band": 0.0,
  "criteria_scores": {
    "task_response": 0.0,
    "coherence_and_cohesion": 0.0,
    "lexical_resource": 0.0,
    "grammatical_range_and_accuracy": 0.0
  },
  "strengths": ["...", "..."],
  "key_improvements": ["...", "..."],
  "band_8_rewrite": "..."
}

Guidance for each field:
- "overall_band": rounded average of the four criteria scores.
- "strengths": 2-4 concise, specific things the candidate did well.
- "key_improvements": 2-4 actionable, specific ways to reach Band 8.
- "band_8_rewrite": a full rewritten version of the essay, of similar length, demonstrating Band 8 standard writing on the same topic and same position.
"""


def _repair_json(text: str) -> str:
    out: list[str] = []
    in_string = False
    i = 0
    escapes = {"\n": "\\n", "\r": "\\r", "\t": "\\t"}
    while i < len(text):
        ch = text[i]
        if in_string:
            if ch == "\\":
                out.append(ch)
                if i + 1 < len(text):
                    out.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                in_string = False
            elif ch in escapes:
                out.append(escapes[ch])
                i += 1
                continue
        elif ch == '"':
            in_string = True
        out.append(ch)
        i += 1
    return "".join(out)


def _parse_json(text: str) -> dict:
    decoder = json.JSONDecoder()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            obj, _ = decoder.raw_decode(text.lstrip())
            return obj
        except json.JSONDecodeError:
            pass
    start = text.find("{")
    while start != -1:
        try:
            obj, _ = decoder.raw_decode(text[start:])
            return obj
        except json.JSONDecodeError:
            start = text.find("{", start + 1)
    raise ValueError("No JSON object found in model response")


def _extract_json(text: str) -> dict:
    candidates = [text, _repair_json(text)]
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        candidates.append(match.group(1))
        candidates.append(_repair_json(match.group(1)))
    last_error: Exception | None = None
    for candidate in candidates:
        try:
            return _parse_json(candidate)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
    if last_error:
        raise last_error
    raise ValueError("No JSON found in model response")


TASK1_SYSTEM_PROMPT = """\
You are a strict, experienced IELTS examiner. Evaluate the candidate's Academic Writing Task 1 essay against the official IELTS Band 8 descriptors across the four criteria:

1. Task Achievement (TA)
2. Coherence & Cohesion (CC)
3. Lexical Resource (LR)
4. Grammatical Range & Accuracy (GRA)

Scoring rules:
- Assign each criterion a band score from 0 to 9, in half-band increments (e.g. 6.0, 6.5, 7.0, 7.5, 8.0).
- Task 1 responses must be at least 150 words; flag responses that fall short.
- A Band 8 response clearly and accurately presents all key features of the chart, makes appropriate comparisons, includes an overview, uses cohesive devices flexibly with only occasional lapses, uses a wide range of vocabulary fluently and precisely, and uses a wide range of structures with the majority error-free.
- Do not inflate scores. Be strict and evidence-based: cite specific issues you find in the text.

Return ONLY valid JSON with exactly this structure, no markdown, no commentary:
{
  "overall_band": 0.0,
  "criteria_scores": {
    "task_achievement": 0.0,
    "coherence_and_cohesion": 0.0,
    "lexical_resource": 0.0,
    "grammatical_range_and_accuracy": 0.0
  },
  "strengths": ["...", "..."],
  "key_improvements": ["...", "..."],
  "band_8_rewrite": "..."
}

Guidance for each field:
- "overall_band": rounded average of the four criteria scores.
- "strengths": 2-4 concise, specific things the candidate did well.
- "key_improvements": 2-4 actionable, specific ways to reach Band 8.
- "band_8_rewrite": a full rewritten version of the essay, of similar length, demonstrating Band 8 standard writing for the same chart and same key features.
"""


async def evaluate_essay(essay_text: str, topic: str, api_key: str | None = None) -> dict:
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Essay topic: {topic}\n\n"
        f"Candidate's essay:\n{essay_text}"
    )

    key_to_use = api_key or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=key_to_use)

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
    except Exception as exc:
        logger.exception("Gemini evaluation failed: %s", exc)
        raise

    return _extract_json(response.text)


SPEAKING_SYSTEM_PROMPT = """\
You are a strict, experienced IELTS Speaking examiner. First transcribe the candidate's audio response verbatim, then evaluate it against the official IELTS Band 8 descriptors for the four Speaking criteria:

1. Fluency & Coherence (FC)
2. Lexical Resource (LR)
3. Grammatical Range & Accuracy (GRA)
4. Pronunciation

Scoring rules:
- Assign each criterion a band score from 0 to 9, in half-band increments (e.g. 6.0, 6.5, 7.0, 7.5, 8.0).
- A Band 8 speaker speaks fluently with only occasional repetition or self-correction, develops topics coherently and appropriately, uses a wide range of vocabulary fluently and flexibly to convey precise meaning, uses a wide range of structures flexibly with only occasional inaccuracies, and is easy to understand throughout with only occasional lapses in pronunciation.
- Do not inflate scores. Be strict and evidence-based: cite specific issues you find in the candidate's speech.
- If the audio is empty, too short, or inaudible, note that in the transcript and score accordingly.

Return ONLY valid JSON with exactly this structure, no markdown, no commentary:
{
  "overall_band": 0.0,
  "criteria_scores": {
    "fluency_and_coherence": 0.0,
    "lexical_resource": 0.0,
    "grammatical_range_and_accuracy": 0.0,
    "pronunciation": 0.0
  },
  "transcript": "...",
  "strengths": ["...", "..."],
  "key_improvements": ["...", "..."],
  "band_8_improved_transcript": "..."
}

Guidance for each field:
- "overall_band": rounded average of the four criteria scores.
- "transcript": the word-for-word transcription of what the candidate said.
- "strengths": 2-4 concise, specific things the candidate did well.
- "key_improvements": 2-4 actionable, specific ways to reach Band 8.
- "band_8_improved_transcript": a rewritten version of the candidate's response at Band 8 standard, speaking the same topic, roughly the same length and covering the same points.
"""


async def evaluate_speaking_audio(
    audio_bytes: bytes, mime_type: str, topic: str, api_key: str | None = None
) -> dict:
    prompt = (
        f"{SPEAKING_SYSTEM_PROMPT}\n\n"
        f"Cue card topic: {topic}"
    )

    key_to_use = api_key or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=key_to_use)

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=[
                types.Part(text=prompt),
                types.Part(
                    inline_data=types.Blob(mime_type=mime_type, data=audio_bytes)
                ),
            ],
            config={"response_mime_type": "application/json"},
        )
    except Exception as exc:
        logger.exception("Gemini speaking evaluation failed: %s", exc)
        raise

    return _extract_json(response.text)


async def evaluate_task1_essay(
    essay_text: str, question: str, chart_data_description: str, api_key: str | None = None
) -> dict:
    prompt = (
        f"{TASK1_SYSTEM_PROMPT}\n\n"
        f"Task question: {question}\n\n"
        f"Chart data description:\n{chart_data_description}\n\n"
        f"Candidate's essay:\n{essay_text}"
    )

    key_to_use = api_key or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=key_to_use)

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
    except Exception as exc:
        logger.exception("Gemini Task 1 evaluation failed: %s", exc)
        raise

    return _extract_json(response.text)

TASK1_GENERATOR_PROMPT = """\
You are an official Cambridge IELTS Task 1 test creator.
Generate ONE realistic Academic IELTS Writing Task 1 visual report prompt (either a 'line' chart or a 'bar' chart).

Return ONLY valid JSON matching this exact structure:
{
  "id": "unique-slug-id",
  "title": "Short title describing the visual (e.g. Electricity Production by Source)",
  "subtitle": "Subtitle with unit and timeframe (e.g. TWh, 2010-2020)",
  "chartType": "bar",
  "xAxisKey": "category",
  "series": [
    {"dataKey": "metric1", "name": "Series 1 Name", "color": "#6366f1", "unit": "units"},
    {"dataKey": "metric2", "name": "Series 2 Name", "color": "#10b981", "unit": "units"}
  ],
  "data": [
    {"category": "Year/Group 1", "metric1": 120, "metric2": 85},
    {"category": "Year/Group 2", "metric1": 140, "metric2": 95},
    {"category": "Year/Group 3", "metric1": 170, "metric2": 110}
  ],
  "question": "The chart below shows... Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
  "chart_data_description": "A comprehensive factual breakdown describing the trends, key highs, lows, and numbers shown in this chart so the examiner can evaluate accuracy."
}

Rules:
- "chartType" must be strictly either "bar" or "line".
- Include 3 to 5 categories in the "data" array.
- Include 2 to 3 series metrics with distinct hex colors (e.g. #6366f1, #10b981, #f59e0b).
- Provide a clear, detailed "chart_data_description" so the evaluation model knows the exact ground truth.
"""

async def generate_task1_prompt(api_key: str | None = None) -> dict:
    key_to_use = api_key or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=key_to_use)

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=TASK1_GENERATOR_PROMPT,
            config={"response_mime_type": "application/json"},
        )
    except Exception as exc:
        logger.exception("Failed to generate Task 1 prompt: %s", exc)
        raise

    return _extract_json(response.text)

async def generate_task2_prompt(api_key: str | None = None) -> dict:
    system_instruction = """\
You are an official Cambridge IELTS question writer.
Generate ONE realistic, authentic IELTS Academic Writing Task 2 prompt across common IELTS themes (e.g., Education, Environment, Globalization, Work & Careers, Culture, Urbanization, Health).

Return ONLY valid JSON with this exact schema, no markdown code blocks:
{
  "id": "short-slug-name",
  "text": "The full IELTS prompt question text (including instructions like 'To what extent do you agree or disagree?' or 'Discuss both views and give your opinion.')."
}
"""
    key_to_use = api_key or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=key_to_use)

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=system_instruction,
            config={"response_mime_type": "application/json"},
        )
    except Exception as exc:
        logger.exception("Failed to generate Task 2 prompt: %s", exc)
        raise

    return _extract_json(response.text)