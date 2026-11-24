
import sqlparse

def validate_sql(sql):
    statements = sqlparse.parse(sql.strip())

    if len(statements) != 1:
        raise ValueError("Only one SQL statement is allowed")

    statement = statements[0]

    if statement.get_type() != "SELECT":
        raise ValueError("Only SELECT queries are allowed")

    return sql.strip()
