import psycopg2
from psycopg2.extras import execute_values
from faker import Faker
import random
import argparse

# Параметры подключения
DB_HOST = "localhost"
DB_PORT = 5433  # если у тебя Docker пробросил порт
DB_NAME = "benchmark"
DB_USER = "admin"
DB_PASSWORD = "admin"

fake = Faker()


def connect_db():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def truncate_tables(conn):
    with conn.cursor() as cur:
        cur.execute("TRUNCATE orders, products, users RESTART IDENTITY CASCADE;")
    conn.commit()


def bulk_insert_users(conn, num_users, batch_size):
    users = [(fake.user_name(), fake.email(), fake.date_time_this_decade()) for _ in range(num_users)]
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO users (username, email, created_at) VALUES %s",
            users
        )
    conn.commit()
    print(f"Inserted {num_users} users")


def bulk_insert_products(conn, num_products, batch_size):
    products = [(fake.word(), fake.sentence(), round(random.uniform(5, 500), 2), fake.date_time_this_decade())
                for _ in range(num_products)]
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO products (name, description, price, created_at) VALUES %s",
            products
        )
    conn.commit()
    print(f"Inserted {num_products} products")


def bulk_insert_orders(conn, num_users, num_products, num_orders, batch_size):
    num_hot_users = int(num_users * 0.1)
    hot_users = list(range(1, num_hot_users + 1))
    cold_users = list(range(num_hot_users + 1, num_users + 1))

    num_hot_products = int(num_products * 0.1)
    hot_products = list(range(1, num_hot_products + 1))
    cold_products = list(range(num_hot_products + 1, num_products + 1))

    orders = []
    for _ in range(num_orders):
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

        if len(orders) >= batch_size:
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    "INSERT INTO orders (user_id, product_id, quantity, total_price, created_at) VALUES %s",
                    orders
                )
            conn.commit()
            orders = []

    if orders:
        with conn.cursor() as cur:
            execute_values(
                cur,
                "INSERT INTO orders (user_id, product_id, quantity, total_price, created_at) VALUES %s",
                orders
            )
        conn.commit()

    print(f"Inserted {num_orders} orders")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=100_000)
    parser.add_argument("--products", type=int, default=50_000)
    parser.add_argument("--orders", type=int, default=500_000)
    parser.add_argument("--batch", type=int, default=10_000)
    parser.add_argument("--truncate", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    conn = connect_db()
    print("Connected to PostgreSQL")

    if args.truncate:
        truncate_tables(conn)
        print("Tables truncated")

    bulk_insert_users(conn, args.users, args.batch)
    bulk_insert_products(conn, args.products, args.batch)
    bulk_insert_orders(conn, args.users, args.products, args.orders, args.batch)

    conn.close()
    print("Done!")


if __name__ == "__main__":
    main()
