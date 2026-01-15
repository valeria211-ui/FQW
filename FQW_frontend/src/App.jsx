import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Play, 
  BarChart3, 
  History, 
  Settings, 
  Layers, 
  Activity 
} from "lucide-react"; // Импортируем иконки Lucide
import { ScenarioCards } from "./components/ScenarioCards";
import { MetricsTable } from "./components/MetricsTable";
import { MetricsGraph } from "./components/MetricsGraph";
import "./App.css";

function App() {
  const [status, setStatus] = useState({
    Scenario1: "Не запускалось", Scenario2: "Не запускалось", Scenario3: "Не запускалось",
  });
  const [availableRuns, setAvailableRuns] = useState({ Scenario1: [], Scenario2: [], Scenario3: [] });
  const [selectedRunId, setSelectedRunId] = useState({ Scenario1: "", Scenario2: "", Scenario3: "" });
  const [metrics, setMetrics] = useState([]);
  
  // Состояние для переключения вкладок
  const [activeTab, setActiveTab] = useState("tests");

  const fetchAvailableRuns = async (scenario) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/runs/${scenario}`);
      setAvailableRuns((prev) => ({ ...prev, [scenario]: response.data }));
      if (response.data.length > 0) {
        setSelectedRunId((prev) => ({ ...prev, [scenario]: response.data[0] }));
      }
    } catch (error) {
      console.error("Ошибка:", error);
    }
  };

  useEffect(() => {
    ["Scenario1", "Scenario2", "Scenario3"].forEach(fetchAvailableRuns);
  }, []);

  const runLoadTest = async (scenario) => {
    setStatus((prev) => ({ ...prev, [scenario]: "Запуск..." }));
    try {
      const response = await axios.post(`http://127.0.0.1:5050/run_load_test/${scenario}`);
      const newRunId = response.data.run_id;
      setStatus((prev) => ({ ...prev, [scenario]: `ID: ${newRunId}` }));
      setAvailableRuns(prev => ({ ...prev, [scenario]: [newRunId, ...prev[scenario]] }));
      setSelectedRunId(prev => ({ ...prev, [scenario]: newRunId }));
      setTimeout(() => fetchAvailableRuns(scenario), 5000);
    } catch (error) {
      setStatus((prev) => ({ ...prev, [scenario]: "Ошибка" }));
    }
  };

  const fetchMetrics = async (scenario) => {
    const run_id = selectedRunId[scenario];
    if (!run_id) return alert("Выберите ID!");
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/data/${run_id}`);
      setMetrics(response.data.map(m => ({ ...m, scenario_type: scenario })));
    } catch (error) {
      console.error(error);
    }
  };

  const getChartData = () => {
    const grouped = metrics.reduce((acc, m) => {
      const nameMap = {
        point_user_by_email: "Point Query",
        orders_aggregation: "Aggregation",
        recent_orders_join: "Complex Join",
      };
      const shortName = nameMap[m.query] || m.query;
      if (!acc[shortName]) {
        acc[shortName] = { name: shortName };
      }
      acc[shortName][m.scenario_type] = parseFloat(m.duration);
      return acc;
    }, {});
    const resArr = []
    for (const key in grouped) {
      resArr.push({...grouped[key], name : key})
    }
    return resArr
  };

  const getLineChartData = () => {
    return metrics.map((m, index) => ({
      name: index + 1,
      qps: parseFloat(m.qps),
      query: m.query,
      duration: parseFloat(m.duration)
    }));
  };

  const getBarChartData = () => {
    const grouped = metrics.reduce((acc, m) => {
      const nameMap = {
        point_user_by_email: "Point Query",
        orders_aggregation: "Aggregation",
        recent_orders_join: "Complex Join",
      };
      const shortName = nameMap[m.query] || m.query;
      if (!acc[shortName]) acc[shortName] = { name: shortName };
      acc[shortName][m.scenario_type] = parseFloat(m.qps);
      return acc;
    }, {});
    return Object.values(grouped);
  };

  return (
    <div className="layout">
      {/* СОВРЕМЕННЫЙ САЙДБАР С ИКОНКАМИ LUCIDE */}
      <aside className="sidebar">

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === "tests" ? "active" : ""}`}
            onClick={() => setActiveTab("tests")}
            title="Запуск тестов"
          >
            <Play size={24} strokeWidth={2.5} />
          </button>
          
          <button 
            className={`nav-item ${activeTab === "graphs" ? "active" : ""}`}
            onClick={() => setActiveTab("graphs")}
            title="Графики"
          >
            <BarChart3 size={24} strokeWidth={2.5} />
          </button>

          <button 
            className={`nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
            title="История"
          >
            <History size={24} strokeWidth={2.5} />
          </button>

          <button 
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title="Настройки"
          >
            <Settings size={24} strokeWidth={2.5} />
          </button>
        </nav>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="main-content">
        <div className="central-container">

          <h1 className="monitoring">
            {activeTab === "tests" ? "🚀 Панель управления тестами" : 
             activeTab === "graphs" ? "📈 Аналитика производительности" :
             activeTab === "history" ? "📜 История запусков" : "⚙️ Настройки системы"}
          </h1>

          {/* ВКЛАДКА 1: ТЕСТЫ */}
          {activeTab === "tests" && (
            <div className="tab-content fade-in">
              <div className="scenario-cards">
                {["Scenario1", "Scenario2", "Scenario3"].map((sc) => (
                  <ScenarioCards 
                    key={sc}
                    availableRuns={availableRuns} 
                    setSelectedRunId={setSelectedRunId} 
                    runLoadTest={runLoadTest} 
                    fetchMetrics={fetchMetrics} 
                    status={status} 
                    sc={sc} 
                    selectedRunId={selectedRunId} 
                  />
                ))}
              </div>
              {metrics.length > 0 && (
                <MetricsTable metrics={metrics} selectedRunId={selectedRunId} />
              )}
            </div>
          )}

          {/* ВКЛАДКА 2: ГРАФИКИ */}
          {activeTab === "graphs" && (
            <div className="tab-content fade-in">
              {metrics.length > 0 ? (
                <MetricsGraph 
                  getChartData={getChartData} 
                  getLineChartData={getLineChartData} 
                  getBarChartData={getBarChartData} 
                />
              ) : (
                <div className="empty-state">
                  <Activity size={48} color="#ccc" style={{ marginBottom: "20px" }} />
                  <h3>Данные не загружены</h3>
                  <p>Вернитесь во вкладку тестов, выберите запуск и нажмите "Показать метрики"</p>
                </div>
              )}
            </div>
          )}

          {/* ЗАГЛУШКИ ДЛЯ НОВЫХ ВКЛАДОК */}
          {activeTab === "history" && (
            <div className="tab-content fade-in empty-state">
              <h3>📜 История запусков</h3>
              <p>Здесь будет расширенный список всех ваших тестов с фильтрацией.</p>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="tab-content fade-in empty-state">
              <h3>⚙️ Настройки</h3>
              <p>Настройка подключений к MongoDB, PostgreSQL и Redis.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;