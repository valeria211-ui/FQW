import { useState, useEffect } from "react";
import axios from "axios";
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
      const shortName = m.query.includes("JOIN") ? "Complex Join" : m.query.includes("GROUP") ? "Aggregation" : "Point Query";
      if (!acc[shortName]) acc[shortName] = { name: shortName };
      acc[shortName][m.scenario_type] = parseFloat(m.duration);
      return acc;
    }, {});
    return Object.values(grouped);
  };

  return (
    /* ВНЕШНЯЯ ОБОЛОЧКА */
    <div className="layout">
      
      {/* ЦЕНТРАЛЬНЫЙ КОНТЕЙНЕР (ограничивает ширину и центрирует) */}
      <div className="central-container">
        
        <h1 className="monitoring">
          📊 Мониторинг производительности БД
        </h1>

        {/* КАРТОЧКИ СЦЕНАРИЕВ */}
        <div className="scenario-cards">
          {["Scenario1", "Scenario2", "Scenario3"].map((sc) => (
            <ScenarioCards availableRuns ={availableRuns} setSelectedRunId={setSelectedRunId} runLoadTest={runLoadTest} fetchMetrics={fetchMetrics} status={status} sc={sc} selectedRunId={selectedRunId}/>
          ))}
        </div>

        {/* ГРАФИК */}
        {metrics.length > 0 && (
          <MetricsGraph getChartData={getChartData}/>
        )}

        {/* ТАБЛИЦА */}
        {metrics.length > 0 && (
          <MetricsTable metrics={metrics} selectedRunId={selectedRunId}/>
        )}

      </div> 
    </div> 
  );
}

export default App;