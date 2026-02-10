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
                <h2 className="history-title">
                    <Clock size={24} color="var(--accent)" /> История всех экспериментов
                </h2>
                
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Сценарий</th>
                            <th>ID Запуска</th>
                            <th>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allRuns.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="history-empty">
                                    История пуста. Запустите тесты во вкладке "Мониторинг".
                                </td>
                            </tr>
                        ) : (
                            allRuns.map((run, idx) => (
                                <tr key={idx} className="history-row">
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span className={`status-badge ${run.type.replace(/\s/g, '')}`}>
                                                {getIcon(run.type)} {run.type}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="history-id">{run.id}</td>
                                    <td>
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
