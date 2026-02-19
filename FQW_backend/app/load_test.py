import threading
import time
import random
import os
import json
import math
from db import get_connection, get_redis_client
from metrics import save_metric, set_run_status, save_cache_metric

QUERIES_FILE = os.path.join(os.path.dirname(__file__), "queries.json")

with open(QUERIES_FILE, "r") as f:
    READ_QUERIES = json.load(f)

WRITE_QUERIES = [
    {
        "name": "write_insert_order_like",
        "type": "write",
        "sql": """
            INSERT INTO write_bench (user_id, product_id, status, region, channel, amount, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """
    }
]
WRITE_SCENARIOS = {"Scenario4", "Scenario5"}

NUM_THREADS = 10
REQUESTS_PER_THREAD = 10

try:
    r_client = get_redis_client()
except:
    r_client = None

L1_TTL_SEC = int(os.getenv("L1_CACHE_TTL_SEC", "10"))
_l1_cache = {}
_l1_lock = threading.Lock()


class CacheStats:
    def __init__(self):
        self._lock = threading.Lock()
        self.l1_hits = 0
        self.l2_hits = 0
        self.misses = 0
        self.db_fallbacks = 0
        self.l1_latency_sum_ms = 0.0
        self.l2_latency_sum_ms = 0.0
        self.db_latency_sum_ms = 0.0

    def record_l1_hit(self, latency_ms):
        with self._lock:
            self.l1_hits += 1
            self.l1_latency_sum_ms += latency_ms

    def record_l2_hit(self, latency_ms):
        with self._lock:
            self.l2_hits += 1
            self.l2_latency_sum_ms += latency_ms

    def record_miss(self):
        with self._lock:
            self.misses += 1

    def record_db_fallback(self, latency_ms):
        with self._lock:
            self.db_fallbacks += 1
            self.db_latency_sum_ms += latency_ms

    def snapshot(self):
        with self._lock:
            return {
                "l1_hits": self.l1_hits,
                "l2_hits": self.l2_hits,
                "misses": self.misses,
                "db_fallbacks": self.db_fallbacks,
                "avg_l1_latency_ms": (self.l1_latency_sum_ms / self.l1_hits) if self.l1_hits else 0.0,
                "avg_l2_latency_ms": (self.l2_latency_sum_ms / self.l2_hits) if self.l2_hits else 0.0,
                "avg_db_latency_ms": (self.db_latency_sum_ms / self.db_fallbacks) if self.db_fallbacks else 0.0
            }


class StageStats:
    def __init__(self):
        self._lock = threading.Lock()
        self.requests = 0
        self.durations = []

    def record(self, duration_ms):
        with self._lock:
            self.requests += 1
            self.durations.append(float(duration_ms))

    def snapshot(self):
        with self._lock:
            durations = list(self.durations)
            requests = int(self.requests)
        if not durations:
            return {"requests": requests, "avg_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0}
        durations.sort()
        n = len(durations)
        avg_ms = sum(durations) / n
        p95_idx = min(n - 1, max(0, math.ceil(0.95 * n) - 1))
        p99_idx = min(n - 1, max(0, math.ceil(0.99 * n) - 1))
        return {
            "requests": requests,
            "avg_ms": avg_ms,
            "p95_ms": durations[p95_idx],
            "p99_ms": durations[p99_idx],
        }


def reset_l1_cache():
    with _l1_lock:
        _l1_cache.clear()


def get_l1(cache_key):
    now = time.time()
    with _l1_lock:
        item = _l1_cache.get(cache_key)
        if not item:
            return None
        expires_at = item["expires_at"]
        if expires_at <= now:
            _l1_cache.pop(cache_key, None)
            return None
        return item["value"]


def set_l1(cache_key, value):
    with _l1_lock:
        _l1_cache[cache_key] = {
            "value": value,
            "expires_at": time.time() + L1_TTL_SEC
        }

def get_random_params(q_type):
    """Возвращает параметры для подстановки в SQL в зависимости от типа запроса"""
    params = ()

    if q_type == "point":
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT email FROM users ORDER BY RANDOM() LIMIT 1;")
            res = cur.fetchone()
            params = (res[0],) if res else ("default@example.com",)
        finally:
            cur.close()
            conn.close()
    elif q_type == "join":
        intervals = ["7 days", "30 days", "90 days"]
        params = (random.choice(intervals),)
    elif q_type == "write":
        statuses = ["new", "paid", "shipped", "cancelled"]
        regions = ["eu", "us", "asia", "latam"]
        channels = ["web", "mobile", "api"]
        params = (
            random.randint(1, 100000),
            random.randint(1, 50000),
            random.choice(statuses),
            random.choice(regions),
            random.choice(channels),
            round(random.uniform(5.0, 1000.0), 2)
        )

    return params

def run_query(query_sql, query_params, scenario, query_type, cache_stats=None):
    """Выполнение запроса с параметрами"""

    cache_key = f"{query_sql}_{query_params}"

    if scenario == "Scenario3" and r_client and query_type != "write":
        l1_start = time.perf_counter()
        l1_value = get_l1(cache_key)
        if l1_value is not None:
            l1_ms = (time.perf_counter() - l1_start) * 1000
            if cache_stats:
                cache_stats.record_l1_hit(l1_ms)
            return max(l1_ms, 0.01)

        try:
            l2_start = time.perf_counter()
            cached_val = r_client.get(cache_key)
            l2_ms = (time.perf_counter() - l2_start) * 1000
            if cached_val is not None:
                set_l1(cache_key, cached_val)
                if cache_stats:
                    cache_stats.record_l2_hit(l2_ms)
                return max(l2_ms, 0.05)
            if cache_stats:
                cache_stats.record_miss()
        except Exception as e:
            print(f"Redis Error: {e}")

    conn = get_connection()
    cur = conn.cursor()
    start = time.perf_counter() 
    
    try:
        cur.execute(query_sql, query_params)
        if query_type != "write":
            cur.fetchall()
        else:
            conn.commit()

        duration_ms = (time.perf_counter() - start) * 1000

        if scenario == "Scenario3" and cache_stats and query_type != "write":
            cache_stats.record_db_fallback(duration_ms)

        if scenario == "Scenario3" and r_client and query_type != "write":
            try:
                r_client.setex(cache_key, 60, "cached")
                set_l1(cache_key, "cached")
            except:
                pass
        return duration_ms
    finally:
        cur.close()
        conn.close()

def simulate_user(scenario, run_id, query_obj, cache_stats=None):
    try:
        sql = query_obj["sql"]
        query_name = query_obj["name"]
        query_type = query_obj["type"]

        params = get_random_params(query_type)

        duration = run_query(sql, params, scenario, query_type, cache_stats)

        print(f"[{scenario}] {query_name}: {duration:.2f} ms (Params: {params})")
        save_metric(scenario, run_id, query_name, duration)

    except Exception as e:
        print(f"[ERROR] {query_obj['name']}: {e}")


def simulate_user_capture(scenario, run_id, query_obj, stage_stats, cache_stats=None):
    try:
        sql = query_obj["sql"]
        query_name = query_obj["name"]
        query_type = query_obj["type"]
        params = get_random_params(query_type)
        duration = run_query(sql, params, scenario, query_type, cache_stats)
        save_metric(scenario, run_id, query_name, duration)
        stage_stats.record(duration)
    except Exception as e:
        print(f"[ERROR] {query_obj['name']}: {e}")

def worker(scenario, run_id, queries, cache_stats=None):
    random.shuffle(queries) 
    for query in queries:
        simulate_user(scenario, run_id, query, cache_stats)

def worker_time(scenario, run_id, end_time, queries, cache_stats=None):
    while time.time() < end_time:
        query = random.choice(queries)
        simulate_user(scenario, run_id, query, cache_stats)


def worker_time_capture(scenario, run_id, end_time, queries, stage_stats, cache_stats=None):
    while time.time() < end_time:
        query = random.choice(queries)
        simulate_user_capture(scenario, run_id, query, stage_stats, cache_stats)


def get_queries_for_scenario(scenario):
    if scenario in WRITE_SCENARIOS:
        return WRITE_QUERIES
    return READ_QUERIES


def save_saturation_stage(run_id, scenario, stage_idx, threads_count, stage_duration_sec, requests_count, qps, avg_ms, p95_ms, p99_ms, stop_reason=None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO saturation_metrics (
                run_id, scenario_type, stage_idx, threads_count, stage_duration_sec,
                requests_count, qps, avg_latency_ms, p95_latency_ms, p99_latency_ms, stop_reason
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                run_id, scenario, stage_idx, threads_count, stage_duration_sec,
                requests_count, qps, avg_ms, p95_ms, p99_ms, stop_reason
            )
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

def run_load_test(scenario="Scenario1", run_id=None, duration_sec=None):
    if run_id is None:
        run_id = str(int(time.time()))

    cache_stats = CacheStats() if scenario == "Scenario3" else None
    if scenario == "Scenario3" and r_client:
        try:
            print(f"[{scenario}] Очистка кэша Redis...")
            r_client.flushdb()
            reset_l1_cache()
        except:
            pass

    if duration_sec:
        ends_at = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + duration_sec))
    else:
        ends_at = None
    set_run_status(run_id, scenario, "RUNNING", ends_at)

    threads = []
    active_queries = get_queries_for_scenario(scenario)

    if duration_sec:
        end_time = time.time() + duration_sec
        for _ in range(NUM_THREADS):
            t = threading.Thread(target=worker_time, args=(scenario, run_id, end_time, active_queries, cache_stats))
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
                    [active_queries[(j + i) % len(active_queries)] for j in range(REQUESTS_PER_THREAD)],
                    cache_stats
                )
            )
            t.start()
            threads.append(t)

    for t in threads:
        t.join()

    set_run_status(run_id, scenario, "FINISHED")

    if scenario == "Scenario3":
        try:
            cache_result = cache_stats.snapshot() if cache_stats else {}
            l1_hits = int(cache_result.get("l1_hits", 0))
            l2_hits = int(cache_result.get("l2_hits", 0))
            misses = int(cache_result.get("misses", 0))
            db_fallbacks = int(cache_result.get("db_fallbacks", 0))
            hits = l1_hits + l2_hits
            total = hits + misses
            hit_ratio = (hits / total * 100) if total > 0 else 0
            save_cache_metric(
                scenario,
                run_id,
                hits,
                misses,
                hit_ratio,
                l1_hits=l1_hits,
                l2_hits=l2_hits,
                db_fallbacks=db_fallbacks,
                avg_l1_latency_ms=cache_result.get("avg_l1_latency_ms", 0),
                avg_l2_latency_ms=cache_result.get("avg_l2_latency_ms", 0),
                avg_db_latency_ms=cache_result.get("avg_db_latency_ms", 0),
            )
        except Exception:
            pass

    print(f"Load test '{scenario}' finished! run_id={run_id}")


def run_saturation_test(
    scenario="Scenario1",
    run_id=None,
    stage_duration_sec=30,
    thread_steps=None,
    latency_multiplier=2.0
):
    if run_id is None:
        run_id = str(int(time.time()))
    if not thread_steps:
        thread_steps = [10, 20, 40, 80, 120]

    cache_stats = CacheStats() if scenario == "Scenario3" else None
    if scenario == "Scenario3" and r_client:
        try:
            r_client.flushdb()
            reset_l1_cache()
        except Exception:
            pass

    set_run_status(run_id, scenario, "RUNNING")
    queries = get_queries_for_scenario(scenario)
    baseline_p95 = None

    for idx, threads_count in enumerate(thread_steps, start=1):
        stage_stats = StageStats()
        end_time = time.time() + int(stage_duration_sec)
        threads = []
        for _ in range(int(threads_count)):
            t = threading.Thread(
                target=worker_time_capture,
                args=(scenario, run_id, end_time, queries, stage_stats, cache_stats),
            )
            t.start()
            threads.append(t)
        for t in threads:
            t.join()

        snap = stage_stats.snapshot()
        elapsed = max(1.0, float(stage_duration_sec))
        qps = float(snap["requests"]) / elapsed
        avg_ms = float(snap["avg_ms"])
        p95_ms = float(snap["p95_ms"])
        p99_ms = float(snap["p99_ms"])
        stop_reason = None

        if baseline_p95 is None and p95_ms > 0:
            baseline_p95 = p95_ms

        if baseline_p95 and p95_ms >= baseline_p95 * float(latency_multiplier):
            stop_reason = f"p95 reached {latency_multiplier}x baseline"

        save_saturation_stage(
            run_id, scenario, idx, threads_count, int(stage_duration_sec),
            int(snap["requests"]), qps, avg_ms, p95_ms, p99_ms, stop_reason
        )

        if stop_reason:
            break

    set_run_status(run_id, scenario, "FINISHED")
    print(f"Saturation test '{scenario}' finished! run_id={run_id}")
