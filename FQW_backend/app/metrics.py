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

def save_cache_metric(
    scenario,
    run_id,
    hits,
    misses,
    hit_ratio,
    l1_hits=0,
    l2_hits=0,
    db_fallbacks=0,
    avg_l1_latency_ms=0,
    avg_l2_latency_ms=0,
    avg_db_latency_ms=0
):
    conn = get_connection()
    with conn.cursor() as cur:
        try:
            cur.execute(
                """
                INSERT INTO cache_metrics (
                    scenario_type, run_id, hits, misses, hit_ratio,
                    l1_hits, l2_hits, db_fallbacks,
                    avg_l1_latency_ms, avg_l2_latency_ms, avg_db_latency_ms
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    scenario, run_id, hits, misses, hit_ratio,
                    l1_hits, l2_hits, db_fallbacks,
                    avg_l1_latency_ms, avg_l2_latency_ms, avg_db_latency_ms
                )
            )
        except Exception:
            conn.rollback()
            cur.execute(
                """
                INSERT INTO cache_metrics (scenario_type, run_id, hits, misses, hit_ratio)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (scenario, run_id, hits, misses, hit_ratio)
            )
    conn.commit()
    conn.close()

def set_run_status(run_id, scenario, status, ends_at=None):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO run_status (run_id, scenario_type, status, started_at, ends_at)
            VALUES (%s, %s, %s, NOW(), %s)
            ON CONFLICT (run_id) DO UPDATE
            SET status = EXCLUDED.status,
                scenario_type = EXCLUDED.scenario_type,
                ends_at = COALESCE(EXCLUDED.ends_at, run_status.ends_at)
            """,
            (run_id, scenario, status, ends_at)
        )
    conn.commit()
    conn.close()
