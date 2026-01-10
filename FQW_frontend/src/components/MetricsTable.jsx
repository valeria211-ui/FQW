

import { useState, useEffect } from "react";


export const MetricsTable = ({ metrics, selectedRunId }) => {
    return <>
        <div style={{
            backgroundColor: "#fff", padding: "30px", borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflowX: "auto"
        }}>
            <h2 style={{ marginBottom: "20px" }}>
                Подробные результаты ID: {selectedRunId[metrics[0]?.scenario_type]}
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ backgroundColor: "#f8f9fa", textAlign: "left" }}>
                        <th style={{ padding: "15px", borderBottom: "2px solid #eee", textAlign: "left" }}>Запрос (Query)</th>
                        <th style={{ padding: "15px", borderBottom: "2px solid #eee", textAlign: "left" }}>Длительность (ms)</th>
                        <th style={{ padding: "15px", borderBottom: "2px solid #eee", textAlign: "left" }}>QPS</th>
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "15px", color: "#444", fontSize: "0.95rem", textAlign: "left" }}>{m.query}</td>
                            <td style={{ padding: "15px", fontWeight: "bold", color: "#1a1a1a", textAling: "left" }}>{m.duration}</td>
                            <td style={{ padding: "15px", color: "#666", textAlign: "left" }}>{m.qps}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </>
}