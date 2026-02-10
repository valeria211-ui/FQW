from flask import Flask, jsonify, request
from flask_cors import CORS
from load_test import run_load_test
import threading
from db import get_connection
import time
from scenarios_config import load_scenarios

app = Flask(__name__)
CORS(app) 

SCENARIO_SQL = load_scenarios()


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
        ORDER BY timestamp DESC
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
        SELECT hits, misses, hit_ratio
        FROM cache_metrics
        WHERE run_id=%s
        ORDER BY timestamp DESC
        LIMIT 1
        """,
        (run_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({"hits": 0, "misses": 0, "hit_ratio": 0})

    hits, misses, hit_ratio = row
    return jsonify({
        "hits": int(hits or 0),
        "misses": int(misses or 0),
        "hit_ratio": float(hit_ratio or 0)
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
