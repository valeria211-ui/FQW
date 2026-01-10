from flask import Flask, jsonify
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

    # Запуск эмулятора нагрузки в отдельном потоке
    thread = threading.Thread(target=run_load_test, args=(scenario, run_id))
    thread.start()

    return jsonify({"status": "Load test started", "scenario": scenario, "run_id": run_id})

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
    cur.execute("SELECT query_name, duration_ms, qps_metric FROM metrics WHERE run_id=%s", (run_id,))
    data = [{"query": r[0], "duration": r[1], "qps": r[2]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
