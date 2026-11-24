
import traceback
from decimal import Decimal

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_engine import generate_sql
from query_engine import execute_query
from csv_engine import import_csv

app = FastAPI(title="QueryPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class QuestionRequest(BaseModel):
    question: str
    table_name: str | None = None


@app.get("/")
def home():
    return {"message": "QueryPilot API is running"}


@app.post("/ask")
def ask_question(request: QuestionRequest):
    try:
        sql = generate_sql(
            request.question,
            table_name=request.table_name
        )

        if sql.strip().upper() == "CANNOT_ANSWER":
            return {
                "question": request.question,
                "generated_sql": None,
                "results": [],
                "message": (
                    "This question cannot be answered using "
                    "the available dataset columns."
                )
            }

        results = execute_query(sql)

        for row in results:
            for key, value in row.items():
                if isinstance(value, Decimal):
                    row[key] = float(value)

        return {
            "question": request.question,
            "generated_sql": sql,
            "results": results
        }

    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=400,
            detail="Unable to process this query"
        )


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise ValueError("Please upload a CSV file.")

        content = await file.read()

        if len(content) > 10 * 1024 * 1024:
            raise ValueError("CSV file must be 10 MB or smaller.")

        result = import_csv(
            file.filename,
            content
        )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Unable to save CSV into PostgreSQL. Check backend terminal."
        )
