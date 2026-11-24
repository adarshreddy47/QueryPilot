
import io
import re

import pandas as pd
from psycopg2 import sql
from psycopg2.extras import execute_values

from database import get_connection

MAX_ROWS = 1000
MAX_COLUMNS = 50
MAX_FILE_BYTES = 2 * 1024 * 1024


def import_csv(filename, content):
    if not filename or not filename.lower().endswith(".csv"):
        raise ValueError("Please upload a CSV file.")

    if len(content) > MAX_FILE_BYTES:
        raise ValueError("Maximum CSV file size is 2 MB.")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise ValueError("Unable to read CSV file.")

    if df.empty:
        raise ValueError("CSV file contains no data.")

    if len(df) > MAX_ROWS:
        raise ValueError(
            f"Maximum {MAX_ROWS} rows allowed. "
            f"Your file contains {len(df)} rows."
        )

    if len(df.columns) > MAX_COLUMNS:
        raise ValueError("Maximum 50 columns allowed.")

    # Convert column names to safe SQL identifiers
    columns = []
    for index, column in enumerate(df.columns):
        name = re.sub(
            r"[^a-zA-Z0-9_]",
            "_",
            str(column).strip().lower()
        ).strip("_")

        if not name:
            name = f"column_{index + 1}"

        if name[0].isdigit():
            name = "col_" + name

        columns.append(name[:63])

    if len(set(columns)) != len(columns):
        raise ValueError(
            "CSV columns must have unique names."
        )

    df.columns = columns

    # Every upload gets its own table
    import uuid
    table_name = "upload_" + uuid.uuid4().hex[:12]

    # Start with TEXT columns for reliable CSV imports
    df = df.astype(object).where(pd.notna(df), None)

    rows = [
        tuple(None if value is None else str(value)
              for value in row)
        for row in df.itertuples(index=False, name=None)
    ]

    conn = get_connection()

    try:
        with conn:
            with conn.cursor() as cursor:
                create_columns = sql.SQL(", ").join(
                    sql.SQL("{} TEXT").format(
                        sql.Identifier(column)
                    )
                    for column in columns
                )

                cursor.execute(
                    sql.SQL("CREATE TABLE {} ({})").format(
                        sql.Identifier(table_name),
                        create_columns
                    )
                )

                insert_query = sql.SQL(
                    "INSERT INTO {} ({}) VALUES %s"
                ).format(
                    sql.Identifier(table_name),
                    sql.SQL(", ").join(
                        sql.Identifier(column)
                        for column in columns
                    )
                ).as_string(conn)

                execute_values(
                    cursor,
                    insert_query,
                    rows,
                    page_size=100
                )

        return {
            "message": "CSV saved to PostgreSQL successfully",
            "filename": filename,
            "table_name": table_name,
            "rows": len(df),
            "columns": columns,
            "preview": df.head(5).fillna("").to_dict(
                orient="records"
            )
        }

    finally:
        conn.close()
