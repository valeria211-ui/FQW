import threading
import time
from db import get_connection

# Пример списка SQL-запросов для эмулятора
TEST_QUERIES = [
    "SELECT * FROM orders WHERE user_id = 1;",
    "SELECT product_id, COUNT(*) FROM orders GROUP BY product_id ORDER BY COUNT(*) DESC LIMIT 10;",
    "SELECT u.user_id, COUNT(o.order_id) FROM users u JOIN orders o ON u.user_id=o.user_id GROUP BY u.user_id;"
]

def run_query(query):
    conn = get_connection()
    cur = conn.cursor()
    start = time.time()
    cur.execute(query)
    cur.fetchall()
    duration_ms = (time.time() - start) * 1000
    cur.close()
    conn.close()
    return duration_ms

def simulate_user(query):
    duration = run_query(query)
    print(f"Query executed in {duration:.2f} ms")
    # Здесь можно добавить запись в таблицу metrics

def run_load_test(scenario="Scenario 1", users_count=50):
    threads = []
    for i in range(users_count):
        query = TEST_QUERIES[i % len(TEST_QUERIES)]
        t = threading.Thread(target=simulate_user, args=(query,))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()
    print(f"Load test {scenario} finished!")
