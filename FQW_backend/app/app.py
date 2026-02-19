from flask import Flask, jsonify, request
from flask_cors import CORS
from load_test import run_load_test
import threading
from db import get_connection
import time
from datetime import timedelta
import os
import json
from psycopg2.extras import Json
from scenarios_config import load_scenarios

app = Flask(__name__)
CORS(app) 

SCENARIO_SQL = load_scenarios()
QUERIES_FILE = os.path.join(os.path.dirname(__file__), "queries.json")

def ensure_runtime_schema():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS l1_hits BIGINT DEFAULT 0")
        cur.execute("ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS l2_hits BIGINT DEFAULT 0")
        cur.execute("ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS db_fallbacks BIGINT DEFAULT 0")
        cur.execute("ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS avg_l1_latency_ms NUMERIC(10,4) DEFAULT 0")
        cur.execute("ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS avg_l2_latency_ms NUMERIC(10,4) DEFAULT 0")
        cur.execute("ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS avg_db_latency_ms NUMERIC(10,4) DEFAULT 0")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS query_plans (
                plan_id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT NOW(),
                run_id VARCHAR(50) NOT NULL,
                scenario_type VARCHAR(50),
                query_name VARCHAR(100) NOT NULL,
                plan_json JSONB NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

ensure_runtime_schema()


def load_read_queries():
    if not os.path.exists(QUERIES_FILE):
        return []
    with open(QUERIES_FILE, "r") as f:
        return json.load(f)


def compute_warmup_seconds(series, steady_window=5, tolerance=0.10, consecutive=3):
    if not series or len(series) < steady_window:
        return 0

    tail = [v for _, v in series[-steady_window:]]
    steady_avg = sum(tail) / len(tail)
    if steady_avg == 0:
        return 0

    window = min(3, len(series))
    hits = 0
    start_ts = series[0][0]

    for i in range(len(series)):
        w_start = max(0, i - window + 1)
        w_vals = [v for _, v in series[w_start:i + 1]]
        w_avg = sum(w_vals) / len(w_vals)
        if abs(w_avg - steady_avg) / steady_avg <= tolerance:
            hits += 1
            if hits >= consecutive:
                return int((series[i][0] - start_ts).total_seconds())
        else:
            hits = 0

    return int((series[-1][0] - start_ts).total_seconds())


def phase_metrics(cur, run_id, ts_from=None, ts_to=None):
    where_parts = ["run_id=%s"]
    params = [run_id]

    if ts_from is not None:
        where_parts.append("timestamp >= %s")
        params.append(ts_from)
    if ts_to is not None:
        where_parts.append("timestamp < %s")
        params.append(ts_to)
    where_clause = " AND ".join(where_parts)

    cur.execute(
        f"""
        SELECT
            COUNT(*)::int,
            AVG(duration_ms),
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms),
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)
        FROM metrics
        WHERE {where_clause}
        """,
        tuple(params)
    )
    row = cur.fetchone() or (0, None, None, None)
    count, avg_ms, p95_ms, p99_ms = row

    cur.execute(
        f"""
        SELECT AVG(per_sec)
        FROM (
            SELECT date_trunc('second', timestamp) AS ts, COUNT(*)::float AS per_sec
            FROM metrics
            WHERE {where_clause}
            GROUP BY ts
        ) t
        """,
        tuple(params)
    )
    qps_row = cur.fetchone()
    qps = qps_row[0] if qps_row and qps_row[0] is not None else 0

    return {
        "requests": int(count or 0),
        "avg_latency_ms": float(avg_ms) if avg_ms is not None else 0.0,
        "p95_latency_ms": float(p95_ms) if p95_ms is not None else 0.0,
        "p99_latency_ms": float(p99_ms) if p99_ms is not None else 0.0,
        "throughput_qps": float(qps),
    }


def execute_sql_commands(sql_commands):
    if not sql_commands:
        return

    conn = get_connection()
    cur = conn.cursor()
    try:
        for command in sql_commands:
            clean_cmd = command.strip()
            if clean_cmd:
                cur.execute(clean_cmd)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Ошибка в SQL сценарии: {e}")
        raise e
    finally:
        cur.close()
        conn.close()


def prepare_database(scenario):
    """Подготавливает БД под заданный сценарий"""
    sql_commands = SCENARIO_SQL.get(scenario)
    if sql_commands:
        execute_sql_commands(sql_commands)
    else:
        print(f"Сценарий {scenario} не найден!")


@app.route("/run_load_test/<scenario>", methods=["POST"])
def start_load_test(scenario):
    """Запуск нагрузки с подготовкой БД"""
    prepare_database(scenario)

    run_id = str(int(time.time()))
    payload = request.get_json(silent=True) or {}
    duration_sec = payload.get("duration_sec")
    duration_min = payload.get("duration_min")
    if duration_sec is None and duration_min is not None:
        try:
            duration_sec = int(duration_min) * 60
        except Exception:
            duration_sec = None
    if duration_sec is not None:
        try:
            duration_sec = int(duration_sec)
            if duration_sec <= 0:
                duration_sec = None
        except Exception:
            duration_sec = None

    thread = threading.Thread(target=run_load_test, args=(scenario, run_id, duration_sec))
    thread.start()

    return jsonify({
        "status": "Load test started",
        "scenario": scenario,
        "run_id": run_id,
        "duration_sec": duration_sec
    })


@app.route("/metrics/runs/<scenario>", methods=["GET"])
def get_runs(scenario):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT run_id FROM metrics WHERE scenario_type=%s ORDER BY run_id DESC", (scenario,))
    runs = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(runs)


@app.route("/metrics/data/<run_id>", methods=["GET"])
def get_metrics(run_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT query_name, duration_ms FROM metrics WHERE run_id=%s", (run_id,))
    data = [{"query": r[0], "duration": r[1]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route("/metrics/summary/<run_id>", methods=["GET"])
def get_metrics_summary(run_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            AVG(duration_ms) AS avg_latency_ms,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_latency_ms,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_latency_ms
        FROM metrics
        WHERE run_id=%s
        """,
        (run_id,)
    )
    row = cur.fetchone()

    cur.execute(
        """
        SELECT AVG(per_sec) AS avg_qps
        FROM (
            SELECT COUNT(*)::float AS per_sec
            FROM metrics
            WHERE run_id=%s
            GROUP BY date_trunc('second', timestamp)
        ) t
        """,
        (run_id,)
    )
    qps_row = cur.fetchone()

    cur.execute(
        """
        SELECT date_trunc('second', timestamp) AS ts, COUNT(*)::float AS qps
        FROM metrics
        WHERE run_id=%s
        GROUP BY ts
        ORDER BY ts
        """,
        (run_id,)
    )
    qps_series = cur.fetchall()

    cur.execute(
        """
        SELECT AVG(cpu_percent), MAX(cpu_percent)
        FROM cpu_metrics
        WHERE run_id=%s
        """,
        (run_id,)
    )
    cpu_row = cur.fetchone()

    cur.execute(
        """
        SELECT scenario_type
        FROM run_status
        WHERE run_id=%s
        LIMIT 1
        """,
        (run_id,)
    )
    scenario_row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return jsonify({
            "avg_latency_ms": 0,
            "throughput_qps": 0,
            "p95_latency_ms": 0,
            "p99_latency_ms": 0
        })

    avg_latency_ms, p95_latency_ms, p99_latency_ms = row
    throughput_qps = qps_row[0] if qps_row and qps_row[0] is not None else 0
    avg_cpu, peak_cpu = (cpu_row or (None, None))

    warmup_seconds = compute_warmup_seconds(qps_series)
    scenario_type = scenario_row[0] if scenario_row else None
    warmup_label = "DB warm-up" if scenario_type != "Scenario3" else "Cache warm-up"

    return jsonify({
        "avg_latency_ms": float(avg_latency_ms) if avg_latency_ms is not None else 0,
        "throughput_qps": float(throughput_qps),
        "p95_latency_ms": float(p95_latency_ms) if p95_latency_ms is not None else 0,
        "p99_latency_ms": float(p99_latency_ms) if p99_latency_ms is not None else 0,
        "avg_cpu_percent": float(avg_cpu) if avg_cpu is not None else 0,
        "peak_cpu_percent": float(peak_cpu) if peak_cpu is not None else 0,
        "warmup_seconds": warmup_seconds,
        "warmup_label": warmup_label
    })


@app.route("/metrics/phase_summary/<run_id>", methods=["GET"])
def get_phase_summary(run_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        steady_min_seconds = 30
        steady_min_requests = 500
        warmup_cap_ratio = 0.5

        cur.execute(
            """
            SELECT date_trunc('second', timestamp) AS ts, COUNT(*)::float AS qps
            FROM metrics
            WHERE run_id=%s
            GROUP BY ts
            ORDER BY ts
            """,
            (run_id,)
        )
        qps_series = cur.fetchall()
        if not qps_series:
            return jsonify({
                "warmup_seconds": 0,
                "warmup_seconds_raw": 0,
                "warmup_seconds_capped": 0,
                "warmup_cap_ratio": warmup_cap_ratio,
                "run_duration_seconds": 0,
                "steady_duration_seconds": 0,
                "steady_min_seconds": steady_min_seconds,
                "steady_min_requests": steady_min_requests,
                "steady_is_valid": False,
                "insufficient_steady_data": True,
                "warmup": phase_metrics(cur, run_id),
                "steady_state": phase_metrics(cur, run_id),
            })

        cur.execute(
            """
            SELECT MIN(timestamp), MAX(timestamp)
            FROM metrics
            WHERE run_id=%s
            """,
            (run_id,)
        )
        span_row = cur.fetchone() or (None, None)
        min_ts, max_ts = span_row
        if min_ts is not None and max_ts is not None:
            run_duration_seconds = max(1, int((max_ts - min_ts).total_seconds()))
        else:
            run_duration_seconds = max(1, int((qps_series[-1][0] - qps_series[0][0]).total_seconds()))

        warmup_seconds_raw = compute_warmup_seconds(qps_series)
        warmup_cap_seconds = int(run_duration_seconds * warmup_cap_ratio)
        warmup_seconds = max(0, min(warmup_seconds_raw, warmup_cap_seconds))

        start_ts = qps_series[0][0]
        split_ts = start_ts + timedelta(seconds=warmup_seconds)

        warmup = phase_metrics(cur, run_id, ts_from=start_ts, ts_to=split_ts)
        steady = phase_metrics(cur, run_id, ts_from=split_ts, ts_to=None)
        steady_duration_seconds = max(0, run_duration_seconds - warmup_seconds)
        steady_is_valid = (
            steady_duration_seconds >= steady_min_seconds and
            int(steady.get("requests", 0)) >= steady_min_requests
        )

        return jsonify({
            "warmup_seconds": warmup_seconds,
            "warmup_seconds_raw": warmup_seconds_raw,
            "warmup_seconds_capped": warmup_seconds,
            "warmup_cap_ratio": warmup_cap_ratio,
            "run_duration_seconds": run_duration_seconds,
            "steady_duration_seconds": steady_duration_seconds,
            "steady_min_seconds": steady_min_seconds,
            "steady_min_requests": steady_min_requests,
            "steady_is_valid": steady_is_valid,
            "insufficient_steady_data": (not steady_is_valid),
            "split_ts": split_ts.isoformat(),
            "warmup": warmup,
            "steady_state": steady,
        })
    finally:
        cur.close()
        conn.close()


def get_plan_summary(plan_root):
    if not isinstance(plan_root, dict):
        return {"node_type": "Unknown", "relation_name": None, "execution_time_ms": 0.0}

    node_type = plan_root.get("Node Type")
    relation = plan_root.get("Relation Name")

    def find_scan(node):
        if not isinstance(node, dict):
            return None
        nt = node.get("Node Type", "")
        if "Scan" in nt:
            return nt, node.get("Relation Name")
        for child in node.get("Plans", []) or []:
            res = find_scan(child)
            if res:
                return res
        return None

    scan = find_scan(plan_root)
    scan_type = scan[0] if scan else node_type
    scan_relation = scan[1] if scan else relation

    return {
        "node_type": node_type,
        "scan_type": scan_type,
        "relation_name": scan_relation
    }


@app.route("/metrics/explain/collect/<run_id>", methods=["POST"])
def collect_explain(run_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT scenario_type FROM run_status WHERE run_id=%s LIMIT 1", (run_id,))
        row = cur.fetchone()
        scenario_type = row[0] if row else None
        if scenario_type in {"Scenario4", "Scenario5"}:
            return jsonify({
                "status": "skipped",
                "reason": "Write-heavy scenario: EXPLAIN collection is focused on read queries."
            })

        read_queries = load_read_queries()
        if not read_queries:
            return jsonify({"status": "error", "message": "queries.json not found or empty"}), 400

        cur.execute("SELECT email FROM users LIMIT 1")
        email_row = cur.fetchone()
        sample_email = email_row[0] if email_row else "default@example.com"

        saved = 0
        for q in read_queries:
            query_name = q.get("name")
            query_sql = q.get("sql")
            q_type = q.get("type")
            if not query_name or not query_sql:
                continue

            params = ()
            if q_type == "point":
                params = (sample_email,)
            elif q_type == "join":
                params = ("30 days",)

            explain_sql = "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query_sql
            cur.execute(explain_sql, params)
            explain_row = cur.fetchone()
            if not explain_row:
                continue

            explain_payload = explain_row[0]
            if isinstance(explain_payload, list) and explain_payload:
                root = explain_payload[0]
            else:
                root = explain_payload

            plan = root.get("Plan", {}) if isinstance(root, dict) else {}
            summary = get_plan_summary(plan)
            execution_time = float(root.get("Execution Time", 0)) if isinstance(root, dict) else 0.0

            plan_doc = {
                "query_name": query_name,
                "scenario_type": scenario_type,
                "execution_time_ms": execution_time,
                "summary": summary,
                "raw": root
            }

            cur.execute(
                """
                INSERT INTO query_plans (run_id, scenario_type, query_name, plan_json)
                VALUES (%s, %s, %s, %s)
                """,
                (run_id, scenario_type, query_name, Json(plan_doc))
            )
            saved += 1

        conn.commit()
        return jsonify({"status": "ok", "saved_plans": saved})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/metrics/explain/<run_id>", methods=["GET"])
def get_explain_plans(run_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT DISTINCT ON (query_name) query_name, scenario_type, plan_json, created_at
            FROM query_plans
            WHERE run_id=%s
            ORDER BY query_name, created_at DESC
            """,
            (run_id,)
        )
        rows = cur.fetchall()
        plans = []
        for query_name, scenario_type, plan_json, created_at in rows:
            if not isinstance(plan_json, dict):
                continue
            plans.append({
                "query_name": query_name,
                "scenario_type": scenario_type,
                "created_at": created_at.isoformat() if created_at else None,
                "execution_time_ms": float(plan_json.get("execution_time_ms", 0)),
                "scan_type": (plan_json.get("summary") or {}).get("scan_type"),
                "relation_name": (plan_json.get("summary") or {}).get("relation_name"),
                "node_type": (plan_json.get("summary") or {}).get("node_type"),
                "raw": plan_json.get("raw")
            })
        return jsonify(plans)
    finally:
        cur.close()
        conn.close()


@app.route("/metrics/summary_full/<run_id>", methods=["GET"])
def get_metrics_summary_full(run_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            AVG(duration_ms) AS avg_latency_ms,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_latency_ms,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_latency_ms
        FROM metrics
        WHERE run_id=%s
        """,
        (run_id,)
    )
    row = cur.fetchone()

    cur.execute(
        """
        SELECT AVG(per_sec) AS avg_qps
        FROM (
            SELECT COUNT(*)::float AS per_sec
            FROM metrics
            WHERE run_id=%s
            GROUP BY date_trunc('second', timestamp)
        ) t
        """,
        (run_id,)
    )
    qps_row = cur.fetchone()

    cur.execute(
        """
        SELECT AVG(cpu_percent), MAX(cpu_percent)
        FROM cpu_metrics
        WHERE run_id=%s
        """,
        (run_id,)
    )
    cpu_row = cur.fetchone()

    cur.execute(
        """
        SELECT AVG(ram_mb), MAX(ram_mb)
        FROM ram_metrics
        WHERE run_id=%s AND component='redis'
        """,
        (run_id,)
    )
    ram_row = cur.fetchone()

    cur.execute(
        """
        SELECT hits, misses, hit_ratio
        FROM cache_metrics
        WHERE run_id=%s
        ORDER BY
            CASE
                WHEN COALESCE(avg_l1_latency_ms, 0) + COALESCE(avg_l2_latency_ms, 0) + COALESCE(avg_db_latency_ms, 0) > 0
                THEN 0 ELSE 1
            END,
            timestamp DESC
        LIMIT 1
        """,
        (run_id,)
    )
    cache_row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return jsonify({
            "avg_latency_ms": 0,
            "throughput_qps": 0,
            "p95_latency_ms": 0,
            "p99_latency_ms": 0,
            "avg_cpu_percent": 0,
            "peak_cpu_percent": 0,
            "avg_ram_mb": 0,
            "peak_ram_mb": 0,
            "hit_ratio": 0
        })

    avg_latency_ms, p95_latency_ms, p99_latency_ms = row
    throughput_qps = qps_row[0] if qps_row and qps_row[0] is not None else 0
    avg_cpu, peak_cpu = (cpu_row or (None, None))
    avg_ram, peak_ram = (ram_row or (None, None))
    hit_ratio = cache_row[2] if cache_row and cache_row[2] is not None else 0

    return jsonify({
        "avg_latency_ms": float(avg_latency_ms) if avg_latency_ms is not None else 0,
        "throughput_qps": float(throughput_qps),
        "p95_latency_ms": float(p95_latency_ms) if p95_latency_ms is not None else 0,
        "p99_latency_ms": float(p99_latency_ms) if p99_latency_ms is not None else 0,
        "avg_cpu_percent": float(avg_cpu) if avg_cpu is not None else 0,
        "peak_cpu_percent": float(peak_cpu) if peak_cpu is not None else 0,
        "avg_ram_mb": float(avg_ram) if avg_ram is not None else 0,
        "peak_ram_mb": float(peak_ram) if peak_ram is not None else 0,
        "hit_ratio": float(hit_ratio)
    })


@app.route("/metrics/qps_series/<run_id>", methods=["GET"])
def get_qps_series(run_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            date_trunc('second', timestamp) AS ts,
            COUNT(*)::float AS qps
        FROM metrics
        WHERE run_id=%s
        GROUP BY ts
        ORDER BY ts
        """,
        (run_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    data = [{"ts": r[0].isoformat(), "qps": float(r[1])} for r in rows]
    return jsonify(data)


@app.route("/metrics/cpu_series/<run_id>", methods=["GET"])
def get_cpu_series(run_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT timestamp, cpu_percent
        FROM cpu_metrics
        WHERE run_id=%s
        ORDER BY timestamp
        """,
        (run_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    data = [{"ts": r[0].isoformat(), "cpu": float(r[1])} for r in rows]
    return jsonify(data)


@app.route("/metrics/ram_series/<run_id>", methods=["GET"])
def get_ram_series(run_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT timestamp, ram_mb
        FROM ram_metrics
        WHERE run_id=%s AND component='redis'
        ORDER BY timestamp
        """,
        (run_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    data = [{"ts": r[0].isoformat(), "ram_mb": float(r[1])} for r in rows]
    return jsonify(data)


@app.route("/metrics/cache_summary/<run_id>", methods=["GET"])
def get_cache_summary(run_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            hits, misses, hit_ratio,
            COALESCE(l1_hits, 0), COALESCE(l2_hits, 0), COALESCE(db_fallbacks, 0),
            COALESCE(avg_l1_latency_ms, 0), COALESCE(avg_l2_latency_ms, 0), COALESCE(avg_db_latency_ms, 0)
        FROM cache_metrics
        WHERE run_id=%s
        ORDER BY
            CASE
                WHEN COALESCE(avg_l1_latency_ms, 0) + COALESCE(avg_l2_latency_ms, 0) + COALESCE(avg_db_latency_ms, 0) > 0
                THEN 0 ELSE 1
            END,
            timestamp DESC
        LIMIT 1
        """,
        (run_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({
            "hits": 0,
            "misses": 0,
            "hit_ratio": 0,
            "l1_hits": 0,
            "l2_hits": 0,
            "db_fallbacks": 0,
            "avg_l1_latency_ms": 0,
            "avg_l2_latency_ms": 0,
            "avg_db_latency_ms": 0
        })

    hits, misses, hit_ratio, l1_hits, l2_hits, db_fallbacks, avg_l1, avg_l2, avg_db = row
    # Backward compatibility for rows written by old monitor format.
    if (l1_hits or 0) == 0 and (l2_hits or 0) == 0 and (hits or 0) > 0:
        l2_hits = hits
    if (db_fallbacks or 0) == 0 and (misses or 0) > 0:
        db_fallbacks = misses
    return jsonify({
        "hits": int(hits or 0),
        "misses": int(misses or 0),
        "hit_ratio": float(hit_ratio or 0),
        "l1_hits": int(l1_hits or 0),
        "l2_hits": int(l2_hits or 0),
        "db_fallbacks": int(db_fallbacks or 0),
        "avg_l1_latency_ms": float(avg_l1 or 0),
        "avg_l2_latency_ms": float(avg_l2 or 0),
        "avg_db_latency_ms": float(avg_db or 0)
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
