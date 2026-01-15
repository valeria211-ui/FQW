-- Ускоряет поиск пользователя по email (Scenario1 & 2)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Ускоряет фильтрацию WHERE created_at > ...
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
ON orders(created_at);

-- "Покрывающий" индекс для ускорения GROUP BY и COUNT
CREATE INDEX IF NOT EXISTS idx_orders_product_count 
ON orders(product_id);

