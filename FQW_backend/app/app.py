from flask import Flask, jsonify, request
from flask_cors import CORS
from load_test import run_load_test
import threading
import os
from db import get_connection
import time

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех маршрутов

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # родитель папки app/

SCENARIO_FILES = {
    "Scenario1": os.path.join(BASE_DIR, "scenarios", "scenario1.sql"),
    "Scenario2": os.path.join(BASE_DIR, "scenarios", "scenario2.sql"),
    "Scenario3": os.path.join(BASE_DIR, "scenarios", "scenario3.sql")
}

def execute_sql_file(filepath):
    if not os.path.exists(filepath):
        print(f"Файл не найден: {filepath}")
        return
    
    conn = get_connection()
    cur = conn.cursor()
    try:
        with open(filepath, "r") as f:
            # Читаем и разделяем команды по точке с запятой
            sql_content = f.read()
            commands = sql_content.split(';')
            
            for command in commands:
                clean_cmd = command.strip()
                if clean_cmd:
                    cur.execute(clean_cmd)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"🔥 Ошибка в SQL сценарии {filepath}: {e}")
        # Выбрасываем исключение дальше, чтобы Flask показал его в логах
        raise e 
    finally:
        cur.close()
        conn.close()

def prepare_database(scenario):
    """Подготавливает БД под заданный сценарий"""
    sql_file = SCENARIO_FILES.get(scenario)
    if sql_file:
        execute_sql_file(sql_file)
    else:
        print(f"Сценарий {scenario} не найден!")

@app.route("/run_load_test/<scenario>", methods=["POST"])
def start_load_test(scenario):
    """Запуск нагрузки с подготовкой БД"""
    # Подготовка БД
    prepare_database(scenario)

    # Генерация уникального run_id (можно использовать timestamp)
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

    # Запуск эмулятора нагрузки в отдельном потоке
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

    return jsonify({
        "avg_latency_ms": float(avg_latency_ms) if avg_latency_ms is not None else 0,
        "throughput_qps": float(throughput_qps),
        "p95_latency_ms": float(p95_latency_ms) if p95_latency_ms is not None else 0,
        "p99_latency_ms": float(p99_latency_ms) if p99_latency_ms is not None else 0
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
