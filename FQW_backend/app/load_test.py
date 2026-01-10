import threading
import time
from db import get_connection
from metrics import save_metric  # импорт функции сохранения метрик

# Пример списка SQL-запросов для эмулятора
TEST_QUERIES = [
    "SELECT * FROM orders WHERE user_id = 1;",
    "SELECT product_id, COUNT(*) FROM orders GROUP BY product_id ORDER BY COUNT(*) DESC LIMIT 10;",
    "SELECT u.user_id, COUNT(o.order_id) FROM users u JOIN orders o ON u.user_id=o.user_id GROUP BY u.user_id;"
]

NUM_THREADS = 3        # Количество параллельных потоков
REQUESTS_PER_THREAD = 3 # Сколько запросов выполняет каждый поток

def run_query(query):
    """Выполнение запроса и возврат времени в мс"""
    conn = get_connection()
    cur = conn.cursor()
    start = time.time()
    cur.execute(query)
    cur.fetchall()
    duration_ms = (time.time() - start) * 1000
    cur.close()
    conn.close()
    return duration_ms

def simulate_user(scenario, run_id, query):
    """Эмуляция одного "пользователя" с записью метрики"""
    duration = run_query(query)
    qps = 1000 / duration if duration > 0 else 0
    print(f"[{scenario}] Query executed in {duration:.2f} ms, QPS={qps:.2f}")
    
    # Сохраняем метрику в БД
    save_metric(scenario, run_id, query, duration, qps)

def worker(scenario, run_id, queries):
    """Запуск нескольких запросов в потоке"""
    for query in queries:
        simulate_user(scenario, run_id, query)

def run_load_test(scenario="Scenario1", run_id = None):
    """Главная функция запуска нагрузки"""
    if run_id is None:
        run_id = str(int(time.time()))  # уникальный ID запуска
    threads = []

    # Каждый поток берет запросы по циклу
    for i in range(NUM_THREADS):
        t = threading.Thread(
            target=worker,
            args=(scenario, run_id, [TEST_QUERIES[j % len(TEST_QUERIES)] for j in range(REQUESTS_PER_THREAD)])
        )
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    print(f"Load test '{scenario}' finished! run_id={run_id}")
