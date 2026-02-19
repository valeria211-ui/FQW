-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Товары
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Заказы
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id),
    product_id INT NOT NULL REFERENCES products(product_id),
    quantity INT NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для сценариев записи (Write Overhead)
CREATE TABLE IF NOT EXISTS write_bench (
    wb_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    region VARCHAR(20) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Таблица для метрик
CREATE TABLE IF NOT EXISTS metrics (
    metric_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    scenario_type VARCHAR(50),
    run_id VARCHAR(50),
    query_name VARCHAR(100),
    duration_ms NUMERIC(10,2),
    qps_metric NUMERIC(10,2)
);

-- Таблица для метрик CPU по времени
CREATE TABLE IF NOT EXISTS cpu_metrics (
    cpu_metric_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    scenario_type VARCHAR(50),
    run_id VARCHAR(50),
    cpu_percent NUMERIC(7,2)
);

-- Таблица для метрик памяти (RAM)
CREATE TABLE IF NOT EXISTS ram_metrics (
    ram_metric_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    scenario_type VARCHAR(50),
    run_id VARCHAR(50),
    component VARCHAR(50),
    ram_mb NUMERIC(10,2)
);

-- Таблица для метрик кэширования (Redis)
CREATE TABLE IF NOT EXISTS cache_metrics (
    cache_metric_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    scenario_type VARCHAR(50),
    run_id VARCHAR(50),
    hits BIGINT,
    misses BIGINT,
    hit_ratio NUMERIC(5,2),
    l1_hits BIGINT DEFAULT 0,
    l2_hits BIGINT DEFAULT 0,
    db_fallbacks BIGINT DEFAULT 0,
    avg_l1_latency_ms NUMERIC(10,4) DEFAULT 0,
    avg_l2_latency_ms NUMERIC(10,4) DEFAULT 0,
    avg_db_latency_ms NUMERIC(10,4) DEFAULT 0
);

-- Таблица состояния запусков
CREATE TABLE IF NOT EXISTS run_status (
    run_id VARCHAR(50) PRIMARY KEY,
    scenario_type VARCHAR(50),
    status VARCHAR(20),
    started_at TIMESTAMP DEFAULT NOW(),
    ends_at TIMESTAMP
);

-- Сохраненные планы выполнения запросов (EXPLAIN ANALYZE)
CREATE TABLE IF NOT EXISTS query_plans (
    plan_id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    run_id VARCHAR(50) NOT NULL,
    scenario_type VARCHAR(50),
    query_name VARCHAR(100) NOT NULL,
    plan_json JSONB NOT NULL
);
