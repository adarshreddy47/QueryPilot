
from database import get_connection
from psycopg2.extras import RealDictCursor
from sql_validator import validate_sql

def execute_query(sql):
    sql = validate_sql(sql)

    conn = get_connection()

    try:
        conn.set_session(
            readonly=True,
            autocommit=False
        )

        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cursor:
            cursor.execute(
                "SET LOCAL statement_timeout = '5000ms'"
            )
            cursor.execute(sql)
            results = cursor.fetchmany(100)

        return [dict(row) for row in results]

    finally:
        conn.rollback()
        conn.close()
