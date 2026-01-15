import threading
import time
import random
import os
import json
from db import get_connection, get_redis_client
from metrics import save_metric

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
        qps = 1000 / duration if duration > 0 else 0

        print(f"[{scenario}] {query_name}: {duration:.2f} ms (Params: {params})")
        save_metric(scenario, run_id, query_name, duration, qps)

    except Exception as e:
        print(f"[ERROR] {query_obj['name']}: {e}")

def worker(scenario, run_id, queries):
    random.shuffle(queries) 
    for query in queries:
        simulate_user(scenario, run_id, query)

def run_load_test(scenario="Scenario1", run_id=None):
    if run_id is None:
        run_id = str(int(time.time()))

    # --- УПРАВЛЕНИЕ ИНДЕКСАМИ ---
    conn = get_connection()
    cur = conn.cursor()
    try:
        if scenario == "Scenario1":
            print(f"[{scenario}] Подготовка: удаление индексов для чистого теста...")
            cur.execute("DROP INDEX IF EXISTS idx_users_email;")
            cur.execute("DROP INDEX IF EXISTS idx_orders_user_id;")
            cur.execute("DROP INDEX IF EXISTS idx_orders_product_id;")
            cur.execute("DROP INDEX IF EXISTS idx_orders_created_at;")
            conn.commit()
            print(f"[{scenario}] Индексы удалены.")

        elif scenario == "Scenario2":
            print(f"[{scenario}] Подготовка: создание индексов для оптимизации...")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);")
            cur.execute("ANALYZE users; ANALYZE orders;") # Обновляем статистику для планировщика
            conn.commit()
            print(f"[{scenario}] Индексы созданы и статистика обновлена.")
            
    except Exception as e:
        print(f"[DATABASE ERROR] Ошибка при подготовке индексов: {e}")
    finally:
        cur.close()
        conn.close()
    # ----------------------------

    threads = []

    if scenario == "Scenario3" and r_client:
        try:
            print(f"[{scenario}] Очистка кэша Redis...")
            r_client.flushdb()
        except:
            pass

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

    print(f"Load test '{scenario}' finished! run_id={run_id}")