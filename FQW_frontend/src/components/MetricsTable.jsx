import { useState, useEffect } from "react";

export const MetricsTable = ({ metrics, selectedRunId }) => {
    // Используем те же цвета, что и в графиках для единообразия
    const darkTheme = {
        bg: "#ffffff",      // var(--bg-card)
        border: "#2d303a",  // var(--border)
        textMain: "#e0e0e0",
        textMuted: "#ffffff",
        headerBg: "rgba(255, 255, 255, 0.03)"
    };

    if (!metrics || metrics.length === 0) return null;

    return (
        <div 
            className="fade-in" // Добавляем анимацию появления
            style={{
                backgroundColor: darkTheme.bg,
                padding: "30px",
                borderRadius: "20px",
                border: `1px solid ${darkTheme.border}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                overflowX: "auto",
                marginTop: "20px"
            }}
        >
            <h2 style={{ marginBottom: "20px", color: "#000000", fontSize: "1.5rem" }}>
                📋 Результаты ID: <span style={{ color: "#646cff" }}>{selectedRunId[metrics[0]?.scenario_type]}</span>
            </h2>
            
            <table style={{ width: "100%", borderCollapse: "collapse", color: darkTheme.textMain }}>
                <thead>
                    <tr style={{ backgroundColor: darkTheme.headerBg, textAlign: "left" }}>
                        <th style={{ padding: "15px", borderBottom: `2px solid ${darkTheme.border}`, color: darkTheme.textMuted, fontWeight: "600" }}>Запрос (Query)</th>
                        <th style={{ padding: "15px", borderBottom: `2px solid ${darkTheme.border}`, color: darkTheme.textMuted, fontWeight: "600" }}>Длительность (ms)</th>
                        <th style={{ padding: "15px", borderBottom: `2px solid ${darkTheme.border}`, color: darkTheme.textMuted, fontWeight: "600" }}>QPS</th>
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((m, idx) => (
                        <tr 
                            key={idx} 
                            style={{ 
                                borderBottom: `1px solid ${darkTheme.border}`,
                                transition: "background 0.2s" 
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                            <td style={{ padding: "15px", color: darkTheme.textMain, fontSize: "0.95rem" }}>
                                <code>{m.query}</code>
                            </td>
                            <td style={{ padding: "15px", fontWeight: "bold", color: "#646cff" }}>
                                {m.duration} <span style={{ fontWeight: "normal", fontSize: "0.8rem" }}>ms</span>
                            </td>
                            <td style={{ padding: "15px", color: "#52c41a" }}>
                                {m.qps}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};