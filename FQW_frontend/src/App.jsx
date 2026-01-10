import { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [status, setStatus] = useState({
    Scenario1: "Не запускалось",
    Scenario2: "Не запускалось",
    Scenario3: "Не запускалось",
  });
  
  // Храним списки доступных run_id для каждого сценария
  const [availableRuns, setAvailableRuns] = useState({ Scenario1: [], Scenario2: [], Scenario3: [] });
  // Храним выбранный пользователем run_id для каждого сценария
  const [selectedRunId, setSelectedRunId] = useState({ Scenario1: "", Scenario2: "", Scenario3: "" });
  const [metrics, setMetrics] = useState([]);

  // Функция для загрузки списка ID с сервера
  const fetchAvailableRuns = async (scenario) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/runs/${scenario}`);
      setAvailableRuns((prev) => ({ ...prev, [scenario]: response.data }));
      // Если есть запуски, автоматически выбираем самый свежий (первый в списке)
      if (response.data.length > 0) {
        setSelectedRunId((prev) => ({ ...prev, [scenario]: response.data[0] }));
      }
    } catch (error) {
      console.error("Ошибка при получении списка запусков:", error);
    }
  };

  // Загружаем списки ID при первой загрузке страницы
  useEffect(() => {
    ["Scenario1", "Scenario2", "Scenario3"].forEach(fetchAvailableRuns);
  }, []);

  const runLoadTest = async (scenario) => {
  setStatus((prev) => ({ ...prev, [scenario]: "Запуск..." }));
  try {
    const response = await axios.post(`http://127.0.0.1:5050/run_load_test/${scenario}`);
    const newRunId = response.data.run_id;

    setStatus((prev) => ({ ...prev, [scenario]: `Тест запущен! (ID: ${newRunId})` }));

    // 1. Сразу добавляем новый ID в список доступных, чтобы он появился в выпадающем списке
    setAvailableRuns((prev) => ({
      ...prev,
      [scenario]: [newRunId, ...prev[scenario]] // Добавляем в начало списка
    }));

    // 2. Сразу выбираем этот ID как активный
    setSelectedRunId((prev) => ({
      ...prev,
      [scenario]: newRunId
    }));

    // 3. (Опционально) Через 5 секунд обновляем список из БД, когда там уже точно будут данные
    setTimeout(() => fetchAvailableRuns(scenario), 5000);

  } catch (error) {
    console.error(error);
    setStatus((prev) => ({ ...prev, [scenario]: "Ошибка запуска" }));
  }
};

  const fetchMetrics = async (scenario) => {
    const run_id = selectedRunId[scenario];
    if (!run_id) return alert("Выберите ID запуска или запустите новый тест!");
    
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/data/${run_id}`);
      setMetrics(response.data);
    } catch (error) {
      console.error("Ошибка при получении метрик:", error);
    }
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Segoe UI, Arial" }}>
      <h1>📊 Мониторинг производительности БД</h1>

      <div style={{ display: "flex", gap: "30px", marginBottom: "30px" }}>
        {["Scenario1", "Scenario2", "Scenario3"].map((sc) => (
          <div key={sc} style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px" }}>
            <h3>{sc}</h3>
            <button onClick={() => runLoadTest(sc)} style={{ marginBottom: "10px", width: "100%" }}>
              🚀 Запустить тест
            </button>
            
            <div style={{ marginTop: "10px" }}>
              <label>Выбрать запуск: </label>
              <select 
                value={selectedRunId[sc]} 
                onChange={(e) => setSelectedRunId(prev => ({ ...prev, [sc]: e.target.value }))}
                style={{ width: "100%", padding: "5px", marginTop: "5px" }}
              >
                <option value="">-- Выберите ID --</option>
                {availableRuns[sc].map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => fetchMetrics(sc)} 
              style={{ marginTop: "10px", width: "100%", backgroundColor: "#e1f5fe" }}
            >
              👁 Показать метрики
            </button>
            <p style={{ fontSize: "12px", color: "#666" }}>{status[sc]}</p>
          </div>
        ))}
      </div>

      {metrics.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h2>Результаты для ID: {Object.values(selectedRunId).find(id => metrics.some(m => true)) || ""}</h2>
          <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "#f4f4f4" }}>
              <tr>
                <th>Запрос (Query)</th>
                <th>Длительность (ms)</th>
                <th>QPS</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, idx) => (
                <tr key={idx}>
                  <td>{m.query}</td>
                  <td>{m.duration}</td>
                  <td>{m.qps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;