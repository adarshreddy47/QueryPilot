
from ai_engine import generate_sql
from query_engine import execute_query

question = "What is the total revenue?"

sql = generate_sql(question)
print("Generated SQL:", sql)

results = execute_query(sql)
print("Database Results:", results)
