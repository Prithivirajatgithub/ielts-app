from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="IELTS Band 8 API",
    version="0.1.0",
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


class SpeakingRequest(BaseModel):
    prompt: str = Field(description="The speaking question / task prompt")
    transcript: str = Field(description="The candidate's transcribed speech")


class SpeakingResponse(BaseModel):
    fluency_and_coherence: float = Field(description="Band score for Fluency & Coherence (0-9)")
    lexical_resource: float = Field(description="Band score for Lexical Resource (0-9)")
    grammatical_range_and_accuracy: float = Field(description="Band score for Grammatical Range & Accuracy (0-9)")
    pronunciation: float = Field(description="Band score for Pronunciation (0-9)")
    overall_band: float = Field(description="Overall band score (0-9)")
    feedback: str = Field(description="Detailed written feedback for the candidate")


@app.get("/")
def root():
    return {"message": "IELTS Band 8 API"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/evaluate-essay", response_model=EssayResponse)
def evaluate_essay(request: EssayRequest):
    # TODO: call OpenAI to score the essay against the IELTS band descriptors.
    return EssayResponse(
        task_response=0.0,
        coherence_and_cohesion=0.0,
        lexical_resource=0.0,
        grammatical_range_and_accuracy=0.0,
        overall_band=0.0,
        feedback="Not yet implemented.",
    )


@app.post("/api/v1/evaluate-speaking", response_model=SpeakingResponse)
def evaluate_speaking(request: SpeakingRequest):
    # TODO: call OpenAI to score the speaking transcript against the IELTS band descriptors.
    return SpeakingResponse(
        fluency_and_coherence=0.0,
        lexical_resource=0.0,
        grammatical_range_and_accuracy=0.0,
        pronunciation=0.0,
        overall_band=0.0,
        feedback="Not yet implemented.",
    )
