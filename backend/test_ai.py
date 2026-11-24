
from ai_engine import generate_sql

question = "What is the total revenue?"

try:
    sql = generate_sql(question)
    print("Question:", question)
    print("Generated SQL:", sql)
except Exception as e:
    print("AI generation failed:", e)
