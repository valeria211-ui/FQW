from flask import Flask, jsonify
from load_test import run_load_test
import threading

app = Flask(__name__)

@app.route("/run_load_test/<scenario>", methods=["POST"])
def start_load_test(scenario):
    thread = threading.Thread(target=run_load_test, args=(scenario,))
    thread.start()
    return jsonify({"status": "Load test started", "scenario": scenario})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)

