
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=5,
        options="-c statement_timeout=10000 -c lock_timeout=5000"
    )

if __name__ == "__main__":
    try:
        conn = get_connection()
        print("PostgreSQL connected successfully!")
        conn.close()
    except Exception as e:
        print("Database connection failed:", e)
