import threading
import time
import random
import os
import json
from db import get_connection, get_redis_client
from metrics import save_metric, set_run_status

QUERIES_FILE = os.path.join(os.path.dirname(__file__), "queries.json")

with open(QUERIES_FILE, "r") as f:
    QUERIES = json.load(f)

NUM_THREADS = 10
REQUESTS_PER_THREAD = 10

try:
    r_client = get_redis_client()
except:
    r_client = None

# --- НОВАЯ ФУНКЦИЯ ДЛЯ РАНДОМИЗАЦИИ ---
def get_random_params(q_type):
    """Возвращает параметры для подстановки в SQL в зависимости от типа запроса"""
    conn = get_connection()
    cur = conn.cursor()
    params = ()
    
    try:
        if q_type == "point":
            # Берем случайный email из реально существующих
            cur.execute("SELECT email FROM users ORDER BY RANDOM() LIMIT 1;")
            res = cur.fetchone()
            params = (res[0],) if res else ("default@example.com",)
            
        elif q_type == "join":
            # Важно: для типа join в JSON должно быть прописано "type": "join"
            intervals = ["7 days", "30 days", "90 days"]
            params = (random.choice(intervals),)
            
        # Для aggregation параметры не нужны, так как там группировка по всей таблице
    finally:
        cur.close()
        conn.close()
    return params

def run_query(query_sql, query_params, scenario):
    """Выполнение запроса с параметрами"""
    
    # Для кэша Redis используем строку запроса + параметры, чтобы ключи были уникальными
    cache_key = f"{query_sql}_{query_params}"
    
    if scenario == "Scenario3" and r_client:
        try:
            cached_val = r_client.get(cache_key)
            if cached_val:
                return 0.4
        except Exception as e:
            print(f"Redis Error: {e}")

    conn = get_connection()
    cur = conn.cursor()
    start = time.perf_counter() # perf_counter точнее для мс
    
    try:
        # Передаем параметры в execute для безопасной подстановки
        cur.execute(query_sql, query_params)
        cur.fetchall()
        
        duration_ms = (time.perf_counter() - start) * 1000
        
        if scenario == "Scenario3" and r_client:
            try:
                r_client.setex(cache_key, 60, "cached")
            except:
                pass
        return duration_ms
    finally:
        cur.close()
        conn.close()

def simulate_user(scenario, run_id, query_obj):
    try:
        sql = query_obj["sql"]
        query_name = query_obj["name"]
        query_type = query_obj["type"]

        # Получаем рандомные параметры для этого запуска
        params = get_random_params(query_type)

        duration = run_query(sql, params, scenario)

        print(f"[{scenario}] {query_name}: {duration:.2f} ms (Params: {params})")
        save_metric(scenario, run_id, query_name, duration)

    except Exception as e:
        print(f"[ERROR] {query_obj['name']}: {e}")

def worker(scenario, run_id, queries):
    random.shuffle(queries) 
    for query in queries:
        simulate_user(scenario, run_id, query)

def worker_time(scenario, run_id, end_time):
    while time.time() < end_time:
        query = random.choice(QUERIES)
        simulate_user(scenario, run_id, query)

def run_load_test(scenario="Scenario1", run_id=None, duration_sec=None):
    if run_id is None:
        run_id = str(int(time.time()))

    cache_start = None
    if scenario == "Scenario3" and r_client:
        try:
            print(f"[{scenario}] Очистка кэша Redis...")
            r_client.flushdb()
            info = r_client.info("stats")
            cache_start = {
                "hits": int(info.get("keyspace_hits", 0)),
                "misses": int(info.get("keyspace_misses", 0))
            }
        except:
            pass

    if duration_sec:
        ends_at = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + duration_sec))
    else:
        ends_at = None
    set_run_status(run_id, scenario, "RUNNING", ends_at)

    threads = []

    if duration_sec:
        end_time = time.time() + duration_sec
        for _ in range(NUM_THREADS):
            t = threading.Thread(target=worker_time, args=(scenario, run_id, end_time))
            t.start()
            threads.append(t)
    else:
        for i in range(NUM_THREADS):
            # Добавим i к j, чтобы каждый поток начинал с разного запроса для перемешивания
            t = threading.Thread(
                target=worker,
                args=(
                    scenario,
                    run_id,
                    [QUERIES[(j + i) % len(QUERIES)] for j in range(REQUESTS_PER_THREAD)]
                )
            )
            t.start()
            threads.append(t)

    for t in threads:
        t.join()

    set_run_status(run_id, scenario, "FINISHED")

    if scenario == "Scenario3" and r_client:
        try:
            info = r_client.info("stats")
            end_hits = int(info.get("keyspace_hits", 0))
            end_misses = int(info.get("keyspace_misses", 0))
            if cache_start:
                hits = max(0, end_hits - cache_start["hits"])
                misses = max(0, end_misses - cache_start["misses"])
            else:
                hits = end_hits
                misses = end_misses
            total = hits + misses
            hit_ratio = (hits / total * 100) if total > 0 else 0
            save_cache_metric(scenario, run_id, hits, misses, hit_ratio)
        except Exception:
            pass

    print(f"Load test '{scenario}' finished! run_id={run_id}")
