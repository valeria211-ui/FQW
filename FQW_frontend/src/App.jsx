import { useState, useEffect, useRef, useMemo } from "react";
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
import { ThemeToggle } from "./components/ThemeToggle";
import "./App.css";

function App() {
  const scenarios = ["Scenario1", "Scenario2", "Scenario3", "Scenario4", "Scenario5"];
  const scenarioLabels = {
    Scenario1: "Scenario1 — No Index",
    Scenario2: "Scenario2 — Index",
    Scenario3: "Scenario3 — Redis Cache",
    Scenario4: "Scenario4 — Write No Index",
    Scenario5: "Scenario5 — Write Heavy Indexes"
  };

  const [theme, setTheme] = useState("dark");

  const [status, setStatus] = useState({
    Scenario1: "Не запускалось", Scenario2: "Не запускалось", Scenario3: "Не запускалось",
    Scenario4: "Не запускалось", Scenario5: "Не запускалось",
  });
  const [availableRuns, setAvailableRuns] = useState({ Scenario1: [], Scenario2: [], Scenario3: [], Scenario4: [], Scenario5: [] });
  const [selectedRunId, setSelectedRunId] = useState({ Scenario1: "", Scenario2: "", Scenario3: "", Scenario4: "", Scenario5: "" });
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState(null);
  const [qpsSeries, setQpsSeries] = useState([]);
  const [cpuSeries, setCpuSeries] = useState([]);
  const [ramSeries, setRamSeries] = useState([]);
  const [cacheSummary, setCacheSummary] = useState(null);
  const [phaseSummary, setPhaseSummary] = useState(null);
  const [comparisonSummaries, setComparisonSummaries] = useState([]);
  const [sideBySideLeftRun, setSideBySideLeftRun] = useState("");
  const [sideBySideRightRun, setSideBySideRightRun] = useState("");
  const [sideBySideData, setSideBySideData] = useState(null);
  const [explainPlans, setExplainPlans] = useState([]);
  const [isExplainLoading, setIsExplainLoading] = useState(false);
  const [durationSecByScenario, setDurationSecByScenario] = useState({
    Scenario1: 300,
    Scenario2: 300,
    Scenario3: 300,
    Scenario4: 300,
    Scenario5: 300
  });
  const [runningUntilByScenario, setRunningUntilByScenario] = useState({
    Scenario1: null,
    Scenario2: null,
    Scenario3: null,
    Scenario4: null,
    Scenario5: null
  });
  const [nowTick, setNowTick] = useState(Date.now());
  const [activeScenario, setActiveScenario] = useState(null);
  const [fullHistory, setFullHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("tests");
  const isSeriesFetchingRef = useRef(false);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

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

  const runScenarioMap = useMemo(() => {
    const m = {};
    scenarios.forEach((sc) => {
      (availableRuns[sc] || []).forEach((rid) => { m[rid] = sc; });
    });
    return m;
  }, [availableRuns]);

  const sideBySideRunOptions = useMemo(() => {
    const rows = [];
    scenarios.forEach((sc) => {
      (availableRuns[sc] || []).forEach((rid) => {
        rows.push({ run_id: rid, scenario: sc });
      });
    });
    rows.sort((a, b) => String(b.run_id).localeCompare(String(a.run_id)));
    return rows;
  }, [availableRuns]);

  const fetchFullHistory = async () => {
    let combined = [];
    const nameMap = { 
        "Scenario1": "No Index", 
        "Scenario2": "SQL Index", 
        "Scenario3": "Redis Cache",
        "Scenario4": "Write No Index",
        "Scenario5": "Write Heavy Indexes"
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

  useEffect(() => {
    if (!sideBySideLeftRun && sideBySideRunOptions[0]?.run_id) {
      setSideBySideLeftRun(sideBySideRunOptions[0].run_id);
    }
    if (!sideBySideRightRun && sideBySideRunOptions[1]?.run_id) {
      setSideBySideRightRun(sideBySideRunOptions[1].run_id);
    }
  }, [sideBySideRunOptions, sideBySideLeftRun, sideBySideRightRun]);

  const fetchSeries = async (run_id) => {
    if (isSeriesFetchingRef.current) return;
    isSeriesFetchingRef.current = true;
    try {
      const [summaryRes, qpsRes, cpuRes, ramRes, cacheRes] = await Promise.all([
        axios.get(`http://127.0.0.1:5050/metrics/summary/${run_id}`),
        axios.get(`http://127.0.0.1:5050/metrics/qps_series/${run_id}`),
        axios.get(`http://127.0.0.1:5050/metrics/cpu_series/${run_id}`),
        axios.get(`http://127.0.0.1:5050/metrics/ram_series/${run_id}`),
        axios.get(`http://127.0.0.1:5050/metrics/cache_summary/${run_id}`)
      ]);
      let phaseRes = null;
      try {
        phaseRes = await axios.get(`http://127.0.0.1:5050/metrics/phase_summary/${run_id}`);
      } catch (_) {
        phaseRes = null;
      }
      setSummary(summaryRes.data);
      setQpsSeries(qpsRes.data || []);
      setCpuSeries(cpuRes.data || []);
      setRamSeries(ramRes.data || []);
      setCacheSummary(cacheRes.data || null);
      setPhaseSummary(phaseRes?.data || null);
    } finally {
      isSeriesFetchingRef.current = false;
    }
  };

  const fetchExplainPlans = async (run_id) => {
    try {
      const res = await axios.get(`http://127.0.0.1:5050/metrics/explain/${run_id}`);
      setExplainPlans(res.data || []);
    } catch (_) {
      setExplainPlans([]);
    }
  };

  const collectExplainPlans = async (run_id) => {
    if (!run_id) return;
    setIsExplainLoading(true);
    try {
      await axios.post(`http://127.0.0.1:5050/metrics/explain/collect/${run_id}`);
      await fetchExplainPlans(run_id);
    } finally {
      setIsExplainLoading(false);
    }
  };

  const fetchComparisonSummaries = async () => {
    try {
      const results = await Promise.all(
        scenarios.map(async (sc) => {
          const run_id = selectedRunId[sc];
          if (!run_id) return null;
          const res = await axios.get(`http://127.0.0.1:5050/metrics/summary_full/${run_id}`);
          return { scenario: sc, run_id, ...res.data };
        })
      );
      setComparisonSummaries(results.filter(Boolean));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSideBySideData = async (leftRun, rightRun) => {
    if (!leftRun || !rightRun || leftRun === rightRun) {
      setSideBySideData(null);
      return;
    }
    try {
      const [leftSummaryRes, rightSummaryRes, leftQpsRes, rightQpsRes] = await Promise.all([
        axios.get(`http://127.0.0.1:5050/metrics/summary/${leftRun}`),
        axios.get(`http://127.0.0.1:5050/metrics/summary/${rightRun}`),
        axios.get(`http://127.0.0.1:5050/metrics/qps_series/${leftRun}`),
        axios.get(`http://127.0.0.1:5050/metrics/qps_series/${rightRun}`)
      ]);
      const leftScenario = runScenarioMap[leftRun] || "Unknown";
      const rightScenario = runScenarioMap[rightRun] || "Unknown";
      setSideBySideData({
        left: {
          run_id: leftRun,
          scenario: leftScenario,
          label: `${leftRun} (${leftScenario})`,
          summary: leftSummaryRes.data || {},
          qps_series: leftQpsRes.data || []
        },
        right: {
          run_id: rightRun,
          scenario: rightScenario,
          label: `${rightRun} (${rightScenario})`,
          summary: rightSummaryRes.data || {},
          qps_series: rightQpsRes.data || []
        }
      });
    } catch (e) {
      console.error(e);
      setSideBySideData(null);
    }
  };

  const fetchMetrics = async (scenario, forcedId = null) => {
    const run_id = forcedId || selectedRunId[scenario];
    if (!run_id) return alert("Выберите ID!");
    try {
      const response = await axios.get(`http://127.0.0.1:5050/metrics/data/${run_id}`);
      setMetrics(response.data.map(m => ({ ...m, scenario_type: scenario })));
      setActiveScenario(scenario);
      await fetchSeries(run_id);
      await fetchExplainPlans(run_id);
      await fetchComparisonSummaries();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectFromHistory = (displayName, runId) => {
    const reverseMap = {
      "No Index": "Scenario1",
      "SQL Index": "Scenario2",
      "Redis Cache": "Scenario3",
      "Write No Index": "Scenario4",
      "Write Heavy Indexes": "Scenario5"
    };
    const technicalName = reverseMap[displayName] || displayName;
    
    setMetrics([]);
    setSummary(null);
    setQpsSeries([]);
    setCpuSeries([]);
    setRamSeries([]);
    setCacheSummary(null);
    setPhaseSummary(null);
    setExplainPlans([]);
    setComparisonSummaries([]);
    setActiveScenario(technicalName);
    setSelectedRunId(prev => ({ ...prev, [technicalName]: runId }));
    setActiveTab("tests");
    fetchMetrics(technicalName, runId); 
  };

  const runLoadTest = async (scenario, durationSec) => {
    setStatus((prev) => ({ ...prev, [scenario]: "Запуск..." }));
    try {
      const response = await axios.post(`http://127.0.0.1:5050/run_load_test/${scenario}`, {
        duration_sec: durationSec
      });
      const newRunId = response.data.run_id;
      setStatus((prev) => ({ ...prev, [scenario]: `ID: ${newRunId}` }));
      setAvailableRuns(prev => ({ ...prev, [scenario]: [newRunId, ...prev[scenario]] }));
      setSelectedRunId(prev => ({ ...prev, [scenario]: newRunId }));
      setActiveScenario(scenario);
      if (durationSec) {
        setRunningUntilByScenario(prev => ({
          ...prev,
          [scenario]: Date.now() + durationSec * 1000
        }));
      }
      setTimeout(() => fetchAvailableRuns(scenario), 2000);
    } catch (error) {
      setStatus((prev) => ({ ...prev, [scenario]: "Ошибка" }));
    }
  };

  useEffect(() => {
    if (activeTab !== "graphs" || !activeScenario) return;
    const run_id = selectedRunId[activeScenario];
    if (!run_id) return;
    const isLikelyRunning = Boolean(runningUntilByScenario[activeScenario] && runningUntilByScenario[activeScenario] > Date.now());
    const pollMs = isLikelyRunning ? 1200 : 3000;
    const interval = setInterval(() => {
      fetchSeries(run_id).catch(() => {});
    }, pollMs);
    return () => clearInterval(interval);
  }, [activeTab, activeScenario, selectedRunId, runningUntilByScenario]);

  useEffect(() => {
    if (activeTab !== "graphs") return;
    fetchComparisonSummaries().catch(() => {});
  }, [activeTab, selectedRunId]);

  useEffect(() => {
    if (activeTab !== "graphs") return;
    fetchSideBySideData(sideBySideLeftRun, sideBySideRightRun).catch(() => {});
  }, [activeTab, sideBySideLeftRun, sideBySideRightRun, runScenarioMap]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const chartData = useMemo(() => {
    const grouped = metrics.reduce((acc, m) => {
      const nameMap = { point_user_by_email: "Point", orders_aggregation: "Agg", recent_orders_join: "Join" };
      const shortName = nameMap[m.query] || m.query;
      if (!acc[shortName]) acc[shortName] = { name: shortName };
      acc[shortName][m.scenario_type] = parseFloat(m.duration);
      return acc;
    }, {});
    return Object.values(grouped);
  }, [metrics]);

  const percentileData = useMemo(() => {
    return scenarios.map(sc => {
      const scMetrics = metrics.filter(m => m.scenario_type === sc);
      const nameMap = { "Scenario1": "No Index", "Scenario2": "SQL Index", "Scenario3": "Redis" };
      nameMap["Scenario4"] = "Write No Index";
      nameMap["Scenario5"] = "Write Heavy";
      
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
  }, [metrics]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === "tests" ? "active" : ""}`} onClick={() => setActiveTab("tests")} title="Тесты"><Play size={24} /></button>
          <button className={`nav-item ${activeTab === "graphs" ? "active" : ""}`} onClick={() => setActiveTab("graphs")} title="Графики"><BarChart3 size={24} /></button>
          <button className={`nav-item ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")} title="История"><History size={24} /></button>
          <button className={`nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")} title="Настройки"><Settings size={24} /></button>
        </nav>
        <div style={{ marginTop: "auto", marginBottom: "12px" }}>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </aside>

      <main className="main-content">
        <div className="central-container">
          <h1 className="monitoring">
            {activeTab === "tests" ? "Панель тестов" : 
             activeTab === "graphs" ? "Аналитика" :
             activeTab === "history" ? "История запусков" : "Настройки"}
          </h1>

          {activeTab === "tests" && (
            <div className="tab-content fade-in">
              <div className="scenario-cards">
                {scenarios.map((sc) => (
                  <ScenarioCards 
                    key={sc}
                    availableRuns={availableRuns}
                    setSelectedRunId={setSelectedRunId}
                    runLoadTest={runLoadTest}
                    fetchMetrics={fetchMetrics}
                    status={status}
                    sc={sc}
                    selectedRunId={selectedRunId}
                    durationSecByScenario={durationSecByScenario}
                    setDurationSecByScenario={setDurationSecByScenario}
                    scenarioLabels={scenarioLabels}
                    runningUntilByScenario={runningUntilByScenario}
                    nowTick={nowTick}
                  />
                ))}
              </div>
              {metrics.length > 0 && (
                <MetricsTable
                  metrics={metrics}
                  selectedRunId={selectedRunId}
                  summary={summary}
                  phaseSummary={phaseSummary}
                  explainPlans={explainPlans}
                  isExplainLoading={isExplainLoading}
                  onCollectExplain={collectExplainPlans}
                />
              )}
            </div>
          )}

          {activeTab === "graphs" && (
            <div className="tab-content fade-in">
              {metrics.length > 0 ? (
                <>
                  <div className="chart-card" style={{ marginBottom: "16px" }}>
                    <h3 className="chart-title">Side-by-side (Run Overlay)</h3>
                    <div className="side-by-side-controls">
                      <div className="side-select-wrap">
                        <label className="scenario-label">Run A</label>
                        <select className="scenario-select" value={sideBySideLeftRun} onChange={(e) => setSideBySideLeftRun(e.target.value)}>
                          <option value="">-- Выбрать --</option>
                          {sideBySideRunOptions.map((r) => (
                            <option key={`a-${r.run_id}`} value={r.run_id}>{r.run_id} — {r.scenario}</option>
                          ))}
                        </select>
                      </div>
                      <div className="side-select-wrap">
                        <label className="scenario-label">Run B</label>
                        <select className="scenario-select" value={sideBySideRightRun} onChange={(e) => setSideBySideRightRun(e.target.value)}>
                          <option value="">-- Выбрать --</option>
                          {sideBySideRunOptions.map((r) => (
                            <option key={`b-${r.run_id}`} value={r.run_id}>{r.run_id} — {r.scenario}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <MetricsGraph 
                    chartData={chartData} 
                    percentileData={percentileData}
                    summary={summary}
                    qpsSeries={qpsSeries}
                    cpuSeries={cpuSeries}
                    ramSeries={ramSeries}
                    cacheSummary={cacheSummary}
                    comparisonSummaries={comparisonSummaries}
                    activeScenario={activeScenario}
                    sideBySideData={sideBySideData}
                  />
                </>
              ) : (
                <div className="empty-state"><Activity size={48} color="#ccc" /><h3>Данные не загружены</h3><p>Выберите запуск во вкладке "Тесты"</p></div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <HistoryTable allRuns={fullHistory} onSelectRun={handleSelectFromHistory} />
          )}

          {activeTab === "settings" && (
            <div className="tab-content fade-in empty-state"><h3>Настройки</h3><p>Настройка подключений к БД.</p></div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
