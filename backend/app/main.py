import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.evaluator import (
    evaluate_essay,
    evaluate_speaking_audio,
    evaluate_task1_essay,
)
from app.services.listening import grade_test, list_tests_public, synthesize_test_audio

load_dotenv()

if not os.getenv("GEMINI_API_KEY"):
    logging.getLogger(__name__).warning("GEMINI_API_KEY is not set. AI features will not work.")

app = FastAPI(
    title="IELTS Band 8 API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EssayRequest(BaseModel):
    question: str = Field(description="The IELTS essay question / task prompt")
    essay: str = Field(description="The candidate's essay text")


class EssayResponse(BaseModel):
    task_response: float = Field(description="Band score for Task Response (0-9)")
    coherence_and_cohesion: float = Field(description="Band score for Coherence & Cohesion (0-9)")
    lexical_resource: float = Field(description="Band score for Lexical Resource (0-9)")
    grammatical_range_and_accuracy: float = Field(description="Band score for Grammatical Range & Accuracy (0-9)")
    overall_band: float = Field(description="Overall band score (0-9)")
    feedback: str = Field(description="Detailed written feedback for the candidate")


class Task1Request(BaseModel):
    question: str = Field(description="The IELTS Task 1 prompt / question")
    essay: str = Field(description="The candidate's Task 1 essay text")
    chart_data_description: str = Field(
        description="A textual description of the chart data the essay is based on"
    )


class Task1Response(BaseModel):
    task_achievement: float = Field(description="Band score for Task Achievement (0-9)")
    coherence_and_cohesion: float = Field(description="Band score for Coherence & Cohesion (0-9)")
    lexical_resource: float = Field(description="Band score for Lexical Resource (0-9)")
    grammatical_range_and_accuracy: float = Field(description="Band score for Grammatical Range & Accuracy (0-9)")
    overall_band: float = Field(description="Overall band score (0-9)")
    feedback: str = Field(description="Detailed written feedback for the candidate")


class SpeakingResponse(BaseModel):
    overall_band: float = Field(description="Overall band score (0-9)")
    criteria_scores: dict[str, float] = Field(
        description="Band scores for Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation"
    )
    transcript: str = Field(description="Transcript of the candidate's speech")
    strengths: list[str] = Field(description="Specific things the candidate did well")
    key_improvements: list[str] = Field(
        description="Actionable, specific ways to reach Band 8"
    )
    band_8_improved_transcript: str = Field(
        description="A rewritten version of the candidate's response at Band 8 standard"
    )


class ListeningQuestion(BaseModel):
    id: str = Field(description="Question id")
    number: int = Field(description="Question number")
    type: str = Field(description="form_completion or multiple_choice")
    prompt: str = Field(description="Instructions for the question type")
    label: str = Field(description="Question text or form field label")
    options: list[dict[str, str]] | None = Field(
        default=None, description="Options for multiple choice questions"
    )
    timestamp: str | None = Field(default=None, description="Approximate time reference")


class ListeningTest(BaseModel):
    id: str
    title: str
    subtitle: str
    section: int
    instructions: str
    audio_url: str
    expected_duration_seconds: int
    total_questions: int
    questions: list[ListeningQuestion]


class ListeningTestsResponse(BaseModel):
    tests: list[ListeningTest]


class GradeRequest(BaseModel):
    test_id: str = Field(description="Id of the listening test to grade")
    answers: dict[str, str] = Field(description="Map of question id to user answer")


class QuestionFeedback(BaseModel):
    id: str
    number: int
    type: str
    label: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    excerpt: str
    timestamp: str | None = None


class TranscriptLine(BaseModel):
    speaker: str
    text: str


class GradeResponse(BaseModel):
    test_id: str
    raw_score: int
    total_questions: int
    correct_count: int
    incorrect_count: int
    band_score: float
    feedback: list[QuestionFeedback]
    transcript: list[TranscriptLine]
    answer_lines: list[int] = Field(
        description="Indexes into transcript whose lines contain the answers"
    )


@app.get("/")
def root():
    return {"message": "IELTS Band 8 API"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/evaluate-essay", response_model=EssayResponse)
async def evaluate_essay_endpoint(request: EssayRequest):
    result = await evaluate_essay(essay_text=request.essay, topic=request.question)

    scores = result["criteria_scores"]
    strengths = "\n".join(f"- {s}" for s in result["strengths"])
    improvements = "\n".join(f"- {i}" for i in result["key_improvements"])
    feedback = (
        f"Strengths:\n{strengths}\n\n"
        f"Key improvements:\n{improvements}\n\n"
        f"Band 8 rewrite:\n{result['band_8_rewrite']}"
    )

    return EssayResponse(
        task_response=scores["task_response"],
        coherence_and_cohesion=scores["coherence_and_cohesion"],
        lexical_resource=scores["lexical_resource"],
        grammatical_range_and_accuracy=scores["grammatical_range_and_accuracy"],
        overall_band=result["overall_band"],
        feedback=feedback,
    )


@app.post("/api/v1/evaluate-task1", response_model=Task1Response)
async def evaluate_task1_endpoint(request: Task1Request):
    result = await evaluate_task1_essay(
        essay_text=request.essay,
        question=request.question,
        chart_data_description=request.chart_data_description,
    )

    scores = result["criteria_scores"]
    strengths = "\n".join(f"- {s}" for s in result["strengths"])
    improvements = "\n".join(f"- {i}" for i in result["key_improvements"])
    feedback = (
        f"Strengths:\n{strengths}\n\n"
        f"Key improvements:\n{improvements}\n\n"
        f"Band 8 rewrite:\n{result['band_8_rewrite']}"
    )

    return Task1Response(
        task_achievement=scores["task_achievement"],
        coherence_and_cohesion=scores["coherence_and_cohesion"],
        lexical_resource=scores["lexical_resource"],
        grammatical_range_and_accuracy=scores["grammatical_range_and_accuracy"],
        overall_band=result["overall_band"],
        feedback=feedback,
    )


@app.post("/api/v1/evaluate-speaking", response_model=SpeakingResponse)
async def evaluate_speaking_endpoint(
    audio: UploadFile = File(...),
    topic: str = Form(...),
):
    audio_bytes = await audio.read()
    result = await evaluate_speaking_audio(
        audio_bytes=audio_bytes,
        mime_type=audio.content_type or "audio/webm",
        topic=topic,
    )
    return result


@app.get("/api/v1/listening/tests", response_model=ListeningTestsResponse)
def get_listening_tests():
    return {"tests": list_tests_public()}


@app.get("/api/v1/listening/audio/{test_id}")
def get_listening_audio(test_id: str):
    try:
        content, media_type = synthesize_test_audio(test_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown listening test")
    except Exception as exc:
        logger.error("Could not synthesize audio for %s: %s", test_id, exc)
        raise HTTPException(status_code=500, detail="Could not synthesize audio")

    extension = "mp3" if media_type == "audio/mpeg" else "wav"
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Disposition": f'inline; filename="listening_{test_id}.{extension}"',
    }

    def audio_stream():
        yield content

    return StreamingResponse(
        audio_stream(),
        media_type=media_type,
        headers=headers,
    )


@app.post("/api/v1/listening/grade", response_model=GradeResponse)
def grade_listening(request: GradeRequest):
    try:
        return grade_test(request.test_id, request.answers)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown listening test")
