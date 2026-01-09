import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "benchmark",
    "user": "admin",
    "password": "admin"
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)
