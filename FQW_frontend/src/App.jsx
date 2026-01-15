import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Play, 
  BarChart3, 
  History, 
  Settings, 
  Activity 
} from "lucide-react";
import { ScenarioCards } from "./components/ScenarioCards";
import { MetricsTable } from "./components/MetricsTable";
import { MetricsGraph } from "./components/MetricsGraph";
import { HistoryTable } from "./components/HistoryTable"; 
import "./App.css";

function App() {
  const scenarios = ["Scenario1", "Scenario2", "Scenario3"];
  
  const [status, setStatus] = useState({
    Scenario1: "Не запускалось", Scenario2: "Не запускалось", Scenario3: "Не запускалось",
  });
  const [availableRuns, setAvailableRuns] = useState({ Scenario1: [], Scenario2: [], Scenario3: [] });
  const [selectedRunId, setSelectedRunId] = useState({ Scenario1: "", Scenario2: "", Scenario3: "" });
  const [metrics, setMetrics] = useState([]);
  const [fullHistory, setFullHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("tests");

  // Загрузка доступных ID для выпадающих списков
  const fetchAvailableRuns = async (scenario) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/runs/${scenario}`);
      setAvailableRuns((prev) => ({ ...prev, [scenario]: response.data }));
      if (response.data.length > 0 && !selectedRunId[scenario]) {
        setSelectedRunId((prev) => ({ ...prev, [scenario]: response.data[0] }));
      }
    } catch (error) {
      console.error("Ошибка загрузки запусков:", error);
    }
  };

  useEffect(() => {
    scenarios.forEach(fetchAvailableRuns);
  }, []);

  // Функция для загрузки истории всех запусков
  const fetchFullHistory = async () => {
    let combined = [];
    const nameMap = { 
        "Scenario1": "No Index", 
        "Scenario2": "SQL Index", 
        "Scenario3": "Redis Cache" 
    };
    
    for (const sc of scenarios) {
        try {
            const response = await axios.get(`http://127.0.0.1:5050/metrics/runs/${sc}`);
            const runsWithTypes = response.data.map(id => ({ 
                id, 
                type: nameMap[sc] || sc 
            }));
            combined = [...combined, ...runsWithTypes];
        } catch (e) {
            console.error(`Ошибка истории для ${sc}`, e);
        }
    }
    setFullHistory(combined.sort((a, b) => b.id.localeCompare(a.id)));
  };

  useEffect(() => {
    if (activeTab === "history") {
        fetchFullHistory();
    }
  }, [activeTab]);

  const fetchMetrics = async (scenario, forcedId = null) => {
    const run_id = forcedId || selectedRunId[scenario];
    if (!run_id) return alert("Выберите ID!");
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/data/${run_id}`);
      setMetrics(response.data.map(m => ({ ...m, scenario_type: scenario })));
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectFromHistory = (displayName, runId) => {
    const reverseMap = { "No Index": "Scenario1", "SQL Index": "Scenario2", "Redis Cache": "Scenario3" };
    const technicalName = reverseMap[displayName] || displayName;
    
    setMetrics([]); // Сбрасываем старые данные перед загрузкой
    setSelectedRunId(prev => ({ ...prev, [technicalName]: runId }));
    setActiveTab("tests");
    fetchMetrics(technicalName, runId); 
  };

  const runLoadTest = async (scenario) => {
    setStatus((prev) => ({ ...prev, [scenario]: "Запуск..." }));
    try {
      const response = await axios.post(`http://127.0.0.1:5050/run_load_test/${scenario}`);
      const newRunId = response.data.run_id;
      setStatus((prev) => ({ ...prev, [scenario]: `ID: ${newRunId}` }));
      setAvailableRuns(prev => ({ ...prev, [scenario]: [newRunId, ...prev[scenario]] }));
      setSelectedRunId(prev => ({ ...prev, [scenario]: newRunId }));
      setTimeout(() => fetchAvailableRuns(scenario), 2000);
    } catch (error) {
      setStatus((prev) => ({ ...prev, [scenario]: "Ошибка" }));
    }
  };

  // --- ФУНКЦИИ ОБРАБОТКИ ДАННЫХ ДЛЯ ГРАФИКОВ ---

  const getChartData = () => {
    const grouped = metrics.reduce((acc, m) => {
      const nameMap = { point_user_by_email: "Point", orders_aggregation: "Agg", recent_orders_join: "Join" };
      const shortName = nameMap[m.query] || m.query;
      if (!acc[shortName]) acc[shortName] = { name: shortName };
      acc[shortName][m.scenario_type] = parseFloat(m.duration);
      return acc;
    }, {});
    return Object.values(grouped);
  };

  const getPercentileData = () => {
    return scenarios.map(sc => {
      const scMetrics = metrics.filter(m => m.scenario_type === sc);
      const nameMap = { "Scenario1": "No Index", "Scenario2": "SQL Index", "Scenario3": "Redis" };
      
      if (scMetrics.length === 0) return { name: nameMap[sc], p95: 0, p99: 0 };

      const durations = scMetrics.map(m => parseFloat(m.duration)).sort((a, b) => a - b);
      const p95Index = Math.floor(durations.length * 0.95);
      const p99Index = Math.floor(durations.length * 0.99);

      return {
        name: nameMap[sc],
        p95: durations[p95Index] || 0,
        p99: durations[p99Index] || 0
      };
    });
  };

  const getLineChartData = () => metrics.map((m, i) => ({ name: i + 1, qps: parseFloat(m.qps) }));

  const getBarChartData = () => {
    const grouped = metrics.reduce((acc, m) => {
      const nameMap = { point_user_by_email: "Point", orders_aggregation: "Agg", recent_orders_join: "Join" };
      const shortName = nameMap[m.query] || m.query;
      if (!acc[shortName]) acc[shortName] = { name: shortName };
      acc[shortName][m.scenario_type] = parseFloat(m.qps);
      return acc;
    }, {});
    return Object.values(grouped);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === "tests" ? "active" : ""}`} onClick={() => setActiveTab("tests")} title="Тесты"><Play size={24} /></button>
          <button className={`nav-item ${activeTab === "graphs" ? "active" : ""}`} onClick={() => setActiveTab("graphs")} title="Графики"><BarChart3 size={24} /></button>
          <button className={`nav-item ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")} title="История"><History size={24} /></button>
          <button className={`nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")} title="Настройки"><Settings size={24} /></button>
        </nav>
      </aside>

      <main className="main-content">
        <div className="central-container">
          <h1 className="monitoring">
            {activeTab === "tests" ? "🚀 Панель тестов" : 
             activeTab === "graphs" ? "📈 Аналитика" :
             activeTab === "history" ? "📜 История запусков" : "⚙️ Настройки"}
          </h1>

          {activeTab === "tests" && (
            <div className="tab-content fade-in">
              <div className="scenario-cards">
                {scenarios.map((sc) => (
                  <ScenarioCards key={sc} availableRuns={availableRuns} setSelectedRunId={setSelectedRunId} runLoadTest={runLoadTest} fetchMetrics={fetchMetrics} status={status} sc={sc} selectedRunId={selectedRunId} />
                ))}
              </div>
              {metrics.length > 0 && <MetricsTable metrics={metrics} selectedRunId={selectedRunId} />}
            </div>
          )}

          {activeTab === "graphs" && (
            <div className="tab-content fade-in">
              {metrics.length > 0 ? (
                <MetricsGraph 
                  getChartData={getChartData} 
                  getLineChartData={getLineChartData} 
                  getBarChartData={getBarChartData} 
                  getPercentileData={getPercentileData}
                />
              ) : (
                <div className="empty-state"><Activity size={48} color="#ccc" /><h3>Данные не загружены</h3><p>Выберите запуск во вкладке "Тесты"</p></div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <HistoryTable allRuns={fullHistory} onSelectRun={handleSelectFromHistory} />
          )}

          {activeTab === "settings" && (
            <div className="tab-content fade-in empty-state"><h3>⚙️ Настройки</h3><p>Настройка подключений к БД.</p></div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;