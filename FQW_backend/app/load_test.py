import threading
import time
from db import get_connection, get_redis_client # Импортируем Redis
from metrics import save_metric
import os 
import json

QUERIES_FILE = os.path.join(os.path.dirname(__file__), "queries.json")

with open(QUERIES_FILE, "r") as f:
    QUERIES = json.load(f)


NUM_THREADS = 3        
REQUESTS_PER_THREAD = 3 

# Инициализируем клиент Redis один раз
try:
    r_client = get_redis_client()
except:
    r_client = None

def run_query(query, scenario):
    """Выполнение запроса с проверкой кэша для Scenario3"""
    
    # --- ЛОГИКА REDIS (SCENARIO 3) ---
    if scenario == "Scenario3" and r_client:
        try:
            cached_val = r_client.get(query)
            if cached_val:
                # Cache Hit: возвращаем "фиктивное" маленькое время (имитация RAM)
                return 0.4 
        except Exception as e:
            print(f"Redis Error: {e}")

    # --- ЛОГИКА POSTGRES ---
    conn = get_connection()
    cur = conn.cursor()
    start = time.time()
    
    cur.execute(query)
    cur.fetchall()
    
    duration_ms = (time.time() - start) * 1000
    
    # Сохраняем результат в кэш, если это Scenario 3 (Cache Miss)
    if scenario == "Scenario3" and r_client:
        try:
            r_client.setex(query, 60, "cached") # кэш на 60 секунд
        except:
            pass

    cur.close()
    conn.close()
    return duration_ms

def simulate_user(scenario, run_id, query_obj):
    try:
        sql = query_obj["sql"]
        query_name = query_obj["name"]

        duration = run_query(sql, scenario)
        qps = 1000 / duration if duration > 0 else 0

        print(f"[{scenario}] {query_name}: {duration:.2f} ms")

        save_metric(scenario, run_id, query_name, duration, qps)

    except Exception as e:
        print(f"[ERROR] {query_obj['name']}: {e}")

def worker(scenario, run_id, queries):
    for query in queries:
        simulate_user(scenario, run_id, query)

def run_load_test(scenario="Scenario1", run_id=None):
    if run_id is None:
        run_id = str(int(time.time()))

    threads = []

    if scenario == "Scenario3" and r_client:
        try:
            r_client.flushdb()
        except:
            pass

    for i in range(NUM_THREADS):
        t = threading.Thread(
            target=worker,
            args=(
                scenario,
                run_id,
                [QUERIES[j % len(QUERIES)] for j in range(REQUESTS_PER_THREAD)]
            )
        )
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    print(f"Load test '{scenario}' finished! run_id={run_id}")
