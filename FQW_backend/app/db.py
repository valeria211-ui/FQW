import psycopg2
import redis

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "benchmark",
    "user": "admin",
    "password": "admin"
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def get_redis_client():
    return redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)