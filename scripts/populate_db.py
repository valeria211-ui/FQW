import psycopg2
from psycopg2.extras import execute_values
from faker import Faker
import random

# Параметры подключения
DB_HOST = "localhost"
DB_PORT = 5433  # если у тебя Docker пробросил порт
DB_NAME = "benchmark"
DB_USER = "admin"
DB_PASSWORD = "admin"

# Количество записей
NUM_USERS = 100_000
NUM_PRODUCTS = 50_000
NUM_ORDERS = 500_000
BATCH_SIZE = 10_000

fake = Faker()

def connect_db():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def bulk_insert_users(conn):
    users = [(fake.user_name(), fake.email(), fake.date_time_this_decade()) for _ in range(NUM_USERS)]
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO users (username, email, created_at) VALUES %s",
            users
        )
    conn.commit()
    print(f"Inserted {NUM_USERS} users")

def bulk_insert_products(conn):
    products = [(fake.word(), fake.sentence(), round(random.uniform(5, 500), 2), fake.date_time_this_decade())
                for _ in range(NUM_PRODUCTS)]
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO products (name, description, price, created_at) VALUES %s",
            products
        )
    conn.commit()
    print(f"Inserted {NUM_PRODUCTS} products")

def bulk_insert_orders(conn):
    # Определяем горячие и холодные id с целыми числами
    num_hot_users = int(NUM_USERS * 0.1)
    hot_users = list(range(1, num_hot_users + 1))         # 10% "горячие"
    cold_users = list(range(num_hot_users + 1, NUM_USERS + 1))

    num_hot_products = int(NUM_PRODUCTS * 0.1)
    hot_products = list(range(1, num_hot_products + 1))
    cold_products = list(range(num_hot_products + 1, NUM_PRODUCTS + 1))

    orders = []
    for _ in range(NUM_ORDERS):
        if random.random() < 0.7:
            user_id = random.choice(hot_users)
            product_id = random.choice(hot_products)
        else:
            user_id = random.choice(cold_users)
            product_id = random.choice(cold_products)

        quantity = random.randint(1, 5)
        total_price = round(quantity * random.uniform(5, 500), 2)
        created_at = fake.date_time_this_decade()

        orders.append((user_id, product_id, quantity, total_price, created_at))

        if len(orders) >= BATCH_SIZE:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    "INSERT INTO orders (user_id, product_id, quantity, total_price, created_at) VALUES %s",
                    orders
                )
            conn.commit()
            orders = []

    # Вставка оставшихся заказов
    if orders:
        with conn.cursor() as cur:
            execute_values(
                cur,
                "INSERT INTO orders (user_id, product_id, quantity, total_price, created_at) VALUES %s",
                orders
            )
        conn.commit()

    print(f"Inserted {NUM_ORDERS} orders")

def main():
    conn = connect_db()
    print("Connected to PostgreSQL")

    bulk_insert_users(conn)
    bulk_insert_products(conn)
    bulk_insert_orders(conn)

    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()
