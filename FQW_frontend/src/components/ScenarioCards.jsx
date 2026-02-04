import { useState, useEffect } from "react";


export const ScenarioCards = ({
    availableRuns,
    setSelectedRunId,
    runLoadTest,
    fetchMetrics,
    status,
    sc,
    selectedRunId,
    durationSecByScenario,
    setDurationSecByScenario,
    scenarioLabels,
    runningUntilByScenario,
    nowTick
}) => {
    console.log(selectedRunId)
    const endAt = runningUntilByScenario?.[sc];
    const remainingMs = endAt ? Math.max(0, endAt - nowTick) : 0;
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingSec = Math.floor((remainingMs % 60000) / 1000);
    const remainingText = endAt && remainingMs > 0
        ? `Осталось ${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`
        : null;
    return <>
        <div key={sc} style={{
            backgroundColor: "#fff", padding: "25px", borderRadius: "16px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column"
        }}>
            <h3 style={{ color: "#333", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>{scenarioLabels?.[sc] || sc}</h3>
            <button onClick={() => runLoadTest(sc, durationSecByScenario[sc])} style={{ backgroundColor: "#8884d8", color: "#fff", padding: "12px", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>Запустить тест</button>

            <div style={{ marginTop: "15px" }}>
                <label style={{ fontSize: "12px", color: "#666" }}>Длительность:</label>
                <select
                    value={durationSecByScenario[sc]}
                    onChange={(e) =>
                        setDurationSecByScenario((prev) => ({ ...prev, [sc]: Number(e.target.value) }))
                    }
                    style={{ width: "100%", padding: "8px", borderRadius: "6px" }}
                >
                    <option value={60}>1 минута</option>
                    <option value={300}>5 минут</option>
                    <option value={600}>10 минут</option>
                    <option value={1800}>30 минут</option>
                </select>
            </div>
            {remainingText && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#444" }}>
                    {remainingText}
                </div>
            )}

            <div style={{ marginTop: "15px" }}>
                <label style={{ fontSize: "12px", color: "#666" }}>Запуск:</label>
                <select value={selectedRunId[sc]} onChange={(e) => setSelectedRunId(prev => ({ ...prev, [sc]: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px" }}>
                    <option value="">-- Выбрать --</option>
                    {availableRuns[sc].map(id => <option key={id} value={id}>{id}</option>)}
                </select>
            </div>

            <button onClick={() => fetchMetrics(sc)} style={{ marginTop: "10px", padding: "10px", backgroundColor: "#e3f2fd", color: "#1976d2", border: "none", borderRadius: "8px", fontWeight: "bold" }}>Метрики</button>
            <p style={{ fontSize: "10px", color: "#999", textAlign: "center", marginTop: "10px" }}>{status[sc]}</p>
        </div>
    </>
}
