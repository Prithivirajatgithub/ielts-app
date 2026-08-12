import json
import logging
import os
import re

from google import genai

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


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


async def evaluate_essay(essay_text: str, topic: str) -> dict:
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Essay topic: {topic}\n\n"
        f"Candidate's essay:\n{essay_text}"
    )

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
