#!/usr/bin/env bash
set -euo pipefail

DB_USER=${DB_USER:-admin}
DB_PASSWORD=${DB_PASSWORD:-admin}
DB_NAME=${DB_NAME:-benchmark}
POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-benchmark_postgres}
REDIS_CONTAINER=${REDIS_CONTAINER:-benchmark_redis}
SAMPLE_INTERVAL_SEC=${SAMPLE_INTERVAL_SEC:-0.5}
BASE_DIR=${BASE_DIR:-/tmp/fqw_monitor}

mkdir -p "$BASE_DIR"

psql_exec() {
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}

while true; do
  run_id=$(psql_exec "SELECT run_id FROM run_status WHERE status='RUNNING' ORDER BY started_at DESC LIMIT 1;")
  scenario=$(psql_exec "SELECT scenario_type FROM run_status WHERE status='RUNNING' ORDER BY started_at DESC LIMIT 1;")
  if [[ -z "$run_id" ]]; then
    sleep "$SAMPLE_INTERVAL_SEC"
    continue
  fi

  cpu_raw=$(docker stats --no-stream --format "{{.CPUPerc}}" "$POSTGRES_CONTAINER" 2>/dev/null || true)
  redis_info=$(docker exec "$REDIS_CONTAINER" redis-cli info memory 2>/dev/null || true)

  cpu_val=""
  if [[ -n "$cpu_raw" ]]; then
    cpu_val=${cpu_raw%%%}
    cpu_val=${cpu_val/,/.}
  fi

  ram_mb=""
  if [[ -n "$redis_info" ]]; then
    used_bytes=$(echo "$redis_info" | awk -F: '/^used_memory:/ {print $2}' | tr -d '\r')
    if [[ -z "$used_bytes" ]]; then
      used_bytes=$(echo "$redis_info" | awk -F: '/^used_memory_rss:/ {print $2}' | tr -d '\r')
    fi
    if [[ -n "$used_bytes" ]]; then
      ram_mb=$(awk "BEGIN {printf \"%.2f\", $used_bytes/1024/1024}")
    else
      ram_mb="0"
    fi
  else
    ram_mb="0"
  fi

  if [[ -n "$cpu_val" ]]; then
    psql_exec "INSERT INTO cpu_metrics (scenario_type, run_id, cpu_percent) VALUES ('$scenario', '$run_id', $cpu_val);" >/dev/null || true
  fi

  if [[ -n "$ram_mb" ]]; then
    psql_exec "INSERT INTO ram_metrics (scenario_type, run_id, component, ram_mb) VALUES ('$scenario', '$run_id', 'redis', $ram_mb);" >/dev/null || true
  fi

  # Cache hit ratio only for Scenario3 (cache enabled)
  if [[ "$scenario" == "Scenario3" ]]; then
    stats_info=$(docker exec "$REDIS_CONTAINER" redis-cli info stats 2>/dev/null || true)
    hits=$(echo "$stats_info" | awk -F: '/^keyspace_hits/ {print $2}' | tr -d '\r')
    misses=$(echo "$stats_info" | awk -F: '/^keyspace_misses/ {print $2}' | tr -d '\r')

    if [[ -n "$hits" && -n "$misses" ]]; then
      base_file="$BASE_DIR/${run_id}.baseline"
      if [[ ! -f "$base_file" ]]; then
        echo "$hits $misses" > "$base_file"
      fi
      read -r base_hits base_misses < "$base_file"
      dh=$((hits - base_hits))
      dm=$((misses - base_misses))
      if [[ $dh -lt 0 ]]; then dh=0; fi
      if [[ $dm -lt 0 ]]; then dm=0; fi
      total=$((dh + dm))
      if [[ "$total" -gt 0 ]]; then
        hit_ratio=$(awk "BEGIN {printf \"%.2f\", $dh/$total*100}")
      else
        hit_ratio=0
      fi
      psql_exec "INSERT INTO cache_metrics (scenario_type, run_id, hits, misses, hit_ratio) VALUES ('$scenario', '$run_id', $dh, $dm, $hit_ratio);" >/dev/null || true
    fi
  fi

  sleep "$SAMPLE_INTERVAL_SEC"
done
