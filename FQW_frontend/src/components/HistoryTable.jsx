import React from 'react';
import { Clock, BarChart2, Zap, Database, HardDrive } from "lucide-react";

export const HistoryTable = ({ allRuns, onSelectRun }) => {
    // Иконка в зависимости от типа сценария
    const getIcon = (type) => {
        if (type.includes("Redis")) return <Zap size={16} />;
        if (type.includes("SQL") || type.includes("Index")) return <Database size={16} />;
        return <HardDrive size={16} />;
    };

    return (
        <div className="fade-in" style={{ width: "100%" }}>
            <div className="chart-card">
                <h2 style={{ color: "#fff", marginBottom: "25px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <Clock size={24} color="#646cff" /> История всех экспериментов
                </h2>
                
                <table style={{ width: "100%", borderCollapse: "collapse", color: "#e0e0e0" }}>
                    <thead>
                        <tr style={{ textAlign: "left", borderBottom: "2px solid #2d303a" }}>
                            <th style={{ padding: "15px", color: "#888", fontWeight: "600" }}>Сценарий</th>
                            <th style={{ padding: "15px", color: "#888", fontWeight: "600" }}>ID Запуска</th>
                            <th style={{ padding: "15px", color: "#888", fontWeight: "600" }}>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allRuns.length === 0 ? (
                            <tr>
                                <td colSpan="3" style={{ padding: "30px", textAlign: "center", color: "#666" }}>
                                    История пуста. Запустите тесты во вкладке "Мониторинг".
                                </td>
                            </tr>
                        ) : (
                            allRuns.map((run, idx) => (
                                <tr key={idx} className="history-row" style={{ borderBottom: "1px solid #2d303a" }}>
                                    <td style={{ padding: "15px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span className={`status-badge ${run.type.replace(/\s/g, '')}`}>
                                                {getIcon(run.type)} {run.type}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "15px", fontFamily: "monospace", color: "#646cff" }}>
                                        {run.id}
                                    </td>
                                    <td style={{ padding: "15px" }}>
                                        <button 
                                            className="history-btn"
                                            onClick={() => onSelectRun(run.type, run.id)}
                                        >
                                            <BarChart2 size={16} /> Анализ
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};