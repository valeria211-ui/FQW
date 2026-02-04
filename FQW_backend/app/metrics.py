from db import get_connection
import time

def save_metric(scenario, run_id, query_name, duration_ms):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO metrics (scenario_type, run_id, query_name, duration_ms)
            VALUES (%s, %s, %s, %s)
            """,
            (scenario, run_id, query_name, duration_ms)
        )
    conn.commit()
    conn.close()

def save_cpu_metric(scenario, run_id, cpu_percent):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cpu_metrics (scenario_type, run_id, cpu_percent)
            VALUES (%s, %s, %s)
            """,
            (scenario, run_id, cpu_percent)
        )
    conn.commit()
    conn.close()

def save_ram_metric(scenario, run_id, component, ram_mb):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ram_metrics (scenario_type, run_id, component, ram_mb)
            VALUES (%s, %s, %s, %s)
            """,
            (scenario, run_id, component, ram_mb)
        )
    conn.commit()
    conn.close()

def save_cache_metric(scenario, run_id, hits, misses, hit_ratio):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cache_metrics (scenario_type, run_id, hits, misses, hit_ratio)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (scenario, run_id, hits, misses, hit_ratio)
        )
    conn.commit()
    conn.close()
