export const MetricsTable = ({ metrics, selectedRunId, summary, phaseSummary, explainPlans, isExplainLoading, onCollectExplain }) => {
    if (!metrics || metrics.length === 0) return null;
    const runId = selectedRunId[metrics[0]?.scenario_type];
    const scanBadge = (scanType) => {
        const s = String(scanType || "").toLowerCase();
        if (s.includes("index scan") || s.includes("index only scan")) {
            return { label: "Index Used", cls: "scan-badge good" };
        }
        if (s.includes("bitmap index scan") || s.includes("bitmap heap scan")) {
            return { label: "Bitmap Index", cls: "scan-badge warn" };
        }
        if (s.includes("seq scan")) {
            return { label: "Seq Scan", cls: "scan-badge bad" };
        }
        return { label: "Other", cls: "scan-badge neutral" };
    };

    return (
        <div className="metrics-table">
            <h2 className="metrics-title">
                Результаты ID: <span className="metrics-id">{runId}</span>
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

            {phaseSummary && (
                <div className="phase-summary">
                    <h3 className="phase-title">Warm-up vs Steady-state</h3>
                    {phaseSummary.insufficient_steady_data && (
                        <div className="phase-warning">
                            Steady-state is too short for reliable analysis.
                            Min required: {phaseSummary.steady_min_seconds || 30}s and {phaseSummary.steady_min_requests || 500} requests.
                            Current: {phaseSummary.steady_duration_seconds || 0}s and {phaseSummary.steady_state?.requests || 0} requests.
                        </div>
                    )}
                    <div className="phase-grid">
                        <div className="phase-card">
                            <div className="phase-label">Warm-up ({phaseSummary.warmup_seconds ?? 0}s)</div>
                            <div className="phase-row">Avg: <b>{phaseSummary.warmup?.avg_latency_ms?.toFixed(2) || "0.00"} ms</b></div>
                            <div className="phase-row">p95: <b>{phaseSummary.warmup?.p95_latency_ms?.toFixed(2) || "0.00"} ms</b></div>
                            <div className="phase-row">p99: <b>{phaseSummary.warmup?.p99_latency_ms?.toFixed(2) || "0.00"} ms</b></div>
                            <div className="phase-row">QPS: <b>{phaseSummary.warmup?.throughput_qps?.toFixed(2) || "0.00"}</b></div>
                            <div className="phase-row">Requests: <b>{phaseSummary.warmup?.requests || 0}</b></div>
                            <div className="phase-row">Raw warm-up: <b>{phaseSummary.warmup_seconds_raw ?? 0}s</b></div>
                        </div>
                        <div className="phase-card">
                            <div className="phase-label">Steady-state</div>
                            <div className="phase-row">Avg: <b>{phaseSummary.steady_state?.avg_latency_ms?.toFixed(2) || "0.00"} ms</b></div>
                            <div className="phase-row">p95: <b>{phaseSummary.steady_state?.p95_latency_ms?.toFixed(2) || "0.00"} ms</b></div>
                            <div className="phase-row">p99: <b>{phaseSummary.steady_state?.p99_latency_ms?.toFixed(2) || "0.00"} ms</b></div>
                            <div className="phase-row">QPS: <b>{phaseSummary.steady_state?.throughput_qps?.toFixed(2) || "0.00"}</b></div>
                            <div className="phase-row">Requests: <b>{phaseSummary.steady_state?.requests || 0}</b></div>
                            <div className="phase-row">Duration: <b>{phaseSummary.steady_duration_seconds || 0}s</b></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="phase-summary">
                <h3 className="phase-title">EXPLAIN ANALYZE</h3>
                <button
                    className="history-btn"
                    onClick={() => onCollectExplain?.(runId)}
                    disabled={isExplainLoading}
                    style={{ marginBottom: "10px", opacity: isExplainLoading ? 0.7 : 1 }}
                >
                    {isExplainLoading ? "Сбор плана..." : "Собрать EXPLAIN"}
                </button>
                {(!explainPlans || explainPlans.length === 0) ? (
                    <div className="phase-row">Планы не собраны. Нажмите "Собрать EXPLAIN".</div>
                ) : (
                    <div className="phase-grid">
                        {explainPlans.map((p, idx) => (
                            <div className="phase-card" key={idx}>
                                {(() => {
                                    const badge = scanBadge(p.scan_type);
                                    return <div className={badge.cls}>{badge.label}</div>;
                                })()}
                                <div className="phase-label">{p.query_name}</div>
                                <div className="phase-row">Scan: <b>{p.scan_type || "-"}</b></div>
                                <div className="phase-row">Node: <b>{p.node_type || "-"}</b></div>
                                <div className="phase-row">Relation: <b>{p.relation_name || "-"}</b></div>
                                <div className="phase-row">Execution: <b>{(p.execution_time_ms || 0).toFixed(2)} ms</b></div>
                                <details style={{ marginTop: "8px" }}>
                                    <summary className="phase-row">Показать JSON план</summary>
                                    <pre className="explain-json">{JSON.stringify(p.raw, null, 2)}</pre>
                                </details>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
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
