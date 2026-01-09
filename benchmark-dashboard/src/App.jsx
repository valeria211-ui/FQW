import { useState } from "react";
import axios from "axios";

function App() {
  const [status, setStatus] = useState({
    Scenario1: "Не запускалось",
    Scenario2: "Не запускалось",
    Scenario3: "Не запускалось",
  });

  const runLoadTest = async (scenario) => {
    setStatus((prev) => ({ ...prev, [scenario]: "Запуск..." }));
    try {
      const response = await axios.post(`http://127.0.0.1:5050/run_load_test/${scenario}`);
      setStatus((prev) => ({ ...prev, [scenario]: `Тест запущен: ${response.data.scenario}` }));
    } catch (error) {
      console.error(error);
      setStatus((prev) => ({ ...prev, [scenario]: "Ошибка при запуске теста" }));
    }
  };

  return (
    <div style={{ padding: "50px", fontFamily: "Arial" }}>
      <h1>Я МАЕНЬКИЙ КРОЛИК</h1>

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <button
          onClick={() => runLoadTest("Scenario1")}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Запустить Scenario 1
        </button>

        <button
          onClick={() => runLoadTest("Scenario2")}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Запустить Scenario 2
        </button>

        <button
          onClick={() => runLoadTest("Scenario3")}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Запустить Scenario 3
        </button>
      </div>

      <div style={{ fontSize: "18px" }}>
        <p>Статус Scenario 1: {status.Scenario1}</p>
        <p>Статус Scenario 2: {status.Scenario2}</p>
        <p>Статус Scenario 3: {status.Scenario3}</p>
      </div>
    </div>
  );
}

export default App;
