import os
import time
import re
import subprocess
import traceback
import psycopg
import redis

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_NAME = os.getenv("DB_NAME", "benchmark")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")

POSTGRES_CONTAINER = os.getenv("POSTGRES_CONTAINER", "benchmark_postgres")
REDIS_CONTAINER = os.getenv("REDIS_CONTAINER", "benchmark_redis")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

SAMPLE_INTERVAL_SEC = float(os.getenv("SAMPLE_INTERVAL_SEC", "1.0"))

cache_baseline = {}


def connect_db():
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def get_redis_client():
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)


def parse_mem_to_mb(mem_str):
    if not mem_str:
        return None
    s = mem_str.strip()
    match = re.match(r"([0-9]*\.?[0-9]+)\s*([KMG]i?B)", s)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2)
    if unit in ["KiB", "KB"]:
        return value / 1024.0
    if unit in ["MiB", "MB"]:
        return value
    if unit in ["GiB", "GB"]:
        return value * 1024.0
    return None


def docker_stats_value(container_name, fmt):
    try:
        result = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", fmt, container_name],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            print(f"[monitor] docker stats error for {container_name}: {result.stderr.strip()}", flush=True)
            return None
        raw = result.stdout.strip()
        return raw or None
    except Exception:
        print("[monitor] docker stats exception", flush=True)
        traceback.print_exc()
        return None


def get_postgres_cpu_percent():
    raw = docker_stats_value(POSTGRES_CONTAINER, "{{.CPUPerc}}")
    if not raw:
        return None
    try:
        return float(raw.replace("%", "").replace(",", "."))
    except Exception:
        return None


def get_container_ram_mb(container_name):
    raw = docker_stats_value(container_name, "{{.MemUsage}}")
    if not raw:
        return None
    mem_part = raw.split("/")[0].strip()
    return parse_mem_to_mb(mem_part)


def get_active_run(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT run_id, scenario_type
            FROM run_status
            WHERE status = 'RUNNING'
            ORDER BY started_at DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if row:
            return row

        cur.execute(
            """
            SELECT rs.run_id, rs.scenario_type
            FROM run_status rs
            WHERE rs.status = 'FINISHED'
              AND rs.started_at >= NOW() - INTERVAL '2 minutes'
              AND NOT EXISTS (
                SELECT 1 FROM cpu_metrics cm WHERE cm.run_id = rs.run_id
              )
            ORDER BY rs.started_at DESC
            LIMIT 1
            """
        )
        return cur.fetchone()


def save_cpu_metric(conn, scenario, run_id, cpu):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cpu_metrics (scenario_type, run_id, cpu_percent)
            VALUES (%s, %s, %s)
            """,
            (scenario, run_id, cpu),
        )


def save_ram_metric(conn, scenario, run_id, component, ram_mb):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ram_metrics (scenario_type, run_id, component, ram_mb)
            VALUES (%s, %s, %s, %s)
            """,
            (scenario, run_id, component, ram_mb),
        )


def save_cache_metric(conn, scenario, run_id, hits, misses, hit_ratio):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cache_metrics (
                scenario_type, run_id, hits, misses, hit_ratio,
                l1_hits, l2_hits, db_fallbacks,
                avg_l1_latency_ms, avg_l2_latency_ms, avg_db_latency_ms
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (scenario, run_id, hits, misses, hit_ratio, 0, hits, misses, 0, 0, 0),
        )


def main():
    r = get_redis_client()
    while True:
        conn = None
        try:
            conn = connect_db()
            active = get_active_run(conn)
            if not active:
                time.sleep(SAMPLE_INTERVAL_SEC)
                continue

            run_id, scenario = active
            print(f"[monitor] active run {run_id} ({scenario})", flush=True)

            cpu = get_postgres_cpu_percent()
            if cpu is not None:
                save_cpu_metric(conn, scenario, run_id, cpu)
            else:
                print("[monitor] cpu=None", flush=True)

            redis_mem = get_container_ram_mb(REDIS_CONTAINER)
            if redis_mem is not None:
                save_ram_metric(conn, scenario, run_id, "redis", redis_mem)
            else:
                print("[monitor] ram=None", flush=True)

            # cache_metrics are persisted by app/load_test.py as final per-run values.

            conn.commit()
        except Exception:
            if conn:
                conn.rollback()
            print("[monitor] error during sampling", flush=True)
            traceback.print_exc()
        finally:
            if conn:
                conn.close()

        time.sleep(SAMPLE_INTERVAL_SEC)


if __name__ == "__main__":
    main()
