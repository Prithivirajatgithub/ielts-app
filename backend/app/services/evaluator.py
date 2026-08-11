import json
import os

from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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


async def evaluate_essay(essay_text: str, topic: str) -> dict:
    user_prompt = (
        f"Essay topic: {topic}\n\n"
        f"Candidate's essay:\n{essay_text}"
    )

    response = await client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    content = response.choices[0].message.content
    return json.loads(content)
