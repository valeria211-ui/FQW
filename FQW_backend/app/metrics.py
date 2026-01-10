from db import get_connection
import time

def save_metric(scenario, run_id, query_name, duration_ms, qps_metric):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO metrics (scenario_type, run_id, query_name, duration_ms, qps_metric)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (scenario, run_id, query_name, duration_ms, qps_metric)
        )
    conn.commit()
    conn.close()
