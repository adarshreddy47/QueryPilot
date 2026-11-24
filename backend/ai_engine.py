
import os
import re
import time
from dotenv import load_dotenv
from google import genai
from database import get_connection

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def get_database_schema():
    """
    Automatically read PostgreSQL tables and columns.
    """
    conn = get_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    table_name,
                    column_name,
                    data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            """)

            columns = cursor.fetchall()

        if not columns:
            raise ValueError(
                "No database tables found. Upload a CSV first."
            )

        tables = {}

        for table_name, column_name, data_type in columns:
            if table_name not in tables:
                tables[table_name] = []

            tables[table_name].append(
                f"{column_name} {data_type}"
            )

        schema = "PostgreSQL database schema:\n\n"

        for table_name, fields in tables.items():
            schema += f"{table_name}(\n"
            schema += ",\n".join(
                f"    {field}" for field in fields
            )
            schema += "\n)\n\n"

        return schema

    finally:
        conn.close()


def generate_sql(question, table_name=None):
    schema = get_database_schema()

    table_instruction = ""

    if table_name:
        table_instruction = (
            f"Use the table named {table_name} "
            "for this question. Do not use other tables."
        )

    prompt = f"""
You are an expert PostgreSQL SQL query generator.

DATABASE SCHEMA:
{schema}

SELECTED DATASET:
{table_instruction}

RULES:
1. Generate exactly one read-only SELECT query.
2. Never generate INSERT, UPDATE, DELETE, DROP,
   ALTER, CREATE, TRUNCATE, or other modifications.
3. Use only existing tables and columns.
4. Understand the actual column names dynamically.
5. Never assume a column called revenue exists.
6. If a revenue column exists, use it when appropriate.
7. If revenue can be calculated from quantity and
   unit price, use SUM(quantity * unit_price).
8. Do not invent missing columns or financial values.
9. If the requested calculation is impossible,
   return exactly: CANNOT_ANSWER
10. Use JOIN only when the schema supports it.
11. Use LIMIT 100 for ordinary row listings.
12. Return SQL only, without markdown or explanation.

USER QUESTION:
{question}
"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=prompt
            )

            sql = (response.text or "").strip()

            sql = re.sub(
                r"^```(?:sql)?\s*|\s*```$",
                "",
                sql,
                flags=re.IGNORECASE
            ).strip()

            return sql

        except Exception as e:
            if "503" in str(e) and attempt < 2:
                print("Gemini is busy. Retrying...")
                time.sleep(5 * (attempt + 1))
            else:
                raise
