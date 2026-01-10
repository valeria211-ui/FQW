import { useState, useEffect } from "react";


export const ScenarioCards = ({availableRuns, setSelectedRunId,runLoadTest, fetchMetrics, status , sc , selectedRunId}) => {
    console.log(selectedRunId)
    return <>
        <div key={sc} style={{
            backgroundColor: "#fff", padding: "25px", borderRadius: "16px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column"
        }}>
            <h3 style={{ color: "#333", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>{sc}</h3>
            <button onClick={() => runLoadTest(sc)} style={{ backgroundColor: "#d846da", color: "#fff", padding: "12px", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>🚀 Запустить тест</button>

            <div style={{ marginTop: "15px" }}>
                <label style={{ fontSize: "12px", color: "#666" }}>Запуск:</label>
                <select value={selectedRunId[sc]} onChange={(e) => setSelectedRunId(prev => ({ ...prev, [sc]: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px" }}>
                    <option value="">-- Выбрать --</option>
                    {availableRuns[sc].map(id => <option key={id} value={id}>{id}</option>)}
                </select>
            </div>

            <button onClick={() => fetchMetrics(sc)} style={{ marginTop: "10px", padding: "10px", backgroundColor: "#e3f2fd", color: "#1976d2", border: "none", borderRadius: "8px", fontWeight: "bold" }}>👁 Метрики</button>
            <p style={{ fontSize: "10px", color: "#999", textAlign: "center", marginTop: "10px" }}>{status[sc]}</p>
        </div>
    </>
}