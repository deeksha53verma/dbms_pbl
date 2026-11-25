import os
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    """Create a PostgreSQL connection using environment variables."""
    if not os.getenv("DB_PASSWORD"):
        load_dotenv(override=True)
    password = os.getenv("DB_PASSWORD")
    if password is None or password == "":
        raise RuntimeError(
            "PostgreSQL DB_PASSWORD is not configured. Copy .env.example to .env, set DB_PASSWORD, and run database/pg_setup.sql in pgAdmin."
        )
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "rotaract_rvce"),
        user=os.getenv("DB_USER", "postgres"),
        password=password,
    )


@contextmanager
def db_cursor(commit=False):
    """Context manager providing a RealDictCursor with automatic commit/rollback."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
