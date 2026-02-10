export const MetricsTable = ({ metrics, selectedRunId, summary }) => {
    if (!metrics || metrics.length === 0) return null;

    return (
        <div className="metrics-table">
            <h2 className="metrics-title">
                Результаты ID: <span className="metrics-id">{selectedRunId[metrics[0]?.scenario_type]}</span>
            </h2>

            {summary && (
                <div className="metrics-summary">
                    <div className="summary-card">
                        <div className="summary-label">Average Latency</div>
                        <div className="summary-value blue">{summary.avg_latency_ms?.toFixed(2)} ms</div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Throughput</div>
                        <div className="summary-value green">{summary.throughput_qps?.toFixed(2)} QPS</div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Latency p95</div>
                        <div className="summary-value blue">{summary.p95_latency_ms?.toFixed(2)} ms</div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Latency p99</div>
                        <div className="summary-value blue">{summary.p99_latency_ms?.toFixed(2)} ms</div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Avg CPU (Postgres)</div>
                        <div className="summary-value orange">{summary.avg_cpu_percent?.toFixed(2)} %</div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Peak CPU (Postgres)</div>
                        <div className="summary-value orange">{summary.peak_cpu_percent?.toFixed(2)} %</div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">{summary.warmup_label || "Warm-up Time"}</div>
                        <div className="summary-value green">{summary.warmup_seconds ?? 0} s</div>
                    </div>
                </div>
            )}
            
            <table className="metrics-table-grid">
                <thead>
                    <tr>
                        <th>Запрос (Query)</th>
                        <th>Длительность (ms)</th>
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((m, idx) => (
                        <tr key={idx}>
                            <td><code>{m.query}</code></td>
                            <td className="duration">{m.duration} <span>ms</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
