import os
import yaml

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PATH = os.path.join(BASE_DIR, "scenarios", "scenarios.yml")


def load_scenarios(config_path=DEFAULT_PATH):
    if not os.path.exists(config_path):
        return {}

    with open(config_path, "r") as f:
        data = yaml.safe_load(f) or {}

    scenarios = {}
    for item in data.get("scenarios", []):
        sid = item.get("id")
        sql_list = item.get("sql")
        if not sid or not sql_list:
            continue
        scenarios[sid] = sql_list

    return scenarios
