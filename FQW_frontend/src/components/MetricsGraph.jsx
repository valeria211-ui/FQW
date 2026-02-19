import { useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ReferenceArea
} from 'recharts';
import { exportSummaryCSV, exportSummaryPDF } from "../utils/reportExport";
import { SaturationCharts } from "./SaturationCharts";

export const MetricsGraph = ({ chartData, percentileData, summary, qpsSeries, cpuSeries, ramSeries, saturationSeries, isSaturationRun, activeRunQuality, cacheSummary, comparisonSummaries, activeScenario, sideBySideData, repeatabilityData }) => {
    const theme = {
        grid: "var(--border)",
        text: "var(--text-muted)",
        tooltipBg: "var(--bg-card)",
        tooltipBorder: "var(--border)",
        title: "var(--text-strong)"
    };

    const formatTime = (isoTs) => {
        if (!isoTs) return "";
        const dt = new Date(isoTs);
        return dt.toLocaleTimeString("ru-RU", { hour12: false });
    };

    const buildSeries = (series, valueKey, smoothKey, windowSize = 3, maxPoints = 240) => {
        const normalized = Array.isArray(series) ? series : [];
        const sliced = normalized.length > maxPoints ? normalized.slice(-maxPoints) : normalized;
        const data = sliced.map((d) => ({
            time: formatTime(d.ts),
            [valueKey]: d[valueKey]
        }));

        const smoothed = data.map((d, idx) => {
            const start = Math.max(0, idx - windowSize + 1);
            const slice = data.slice(start, idx + 1);
            const avg = slice.reduce((sum, x) => sum + x[valueKey], 0) / slice.length;
            return { ...d, [smoothKey]: avg };
        });
        return smoothed;
    };

    const qpsChartData = useMemo(
        () => buildSeries(qpsSeries || [], "qps", "qps_smooth"),
        [qpsSeries]
    );
    const cpuChartData = useMemo(
        () => buildSeries(cpuSeries || [], "cpu", "cpu_smooth"),
        [cpuSeries]
    );
    const ramChartData = useMemo(
        () => buildSeries(ramSeries || [], "ram_mb", "ram_smooth"),
        [ramSeries]
    );

    const cacheData = useMemo(() => ([
        { name: "L1 Hit", value: Number(cacheSummary?.l1_hits || 0) },
        { name: "L2 Hit (Redis)", value: Number(cacheSummary?.l2_hits || 0) },
        { name: "Miss", value: Number(cacheSummary?.misses || 0) }
    ]), [cacheSummary]);
    const cacheColors = ["#52c41a", "#69c0ff", "#ff7875"];
    const warmupSeconds = Number(summary?.warmup_seconds || 0);
    const getWarmupX2 = (data) => {
        if (!Array.isArray(data) || data.length === 0 || warmupSeconds <= 0) return null;
        const idx = Math.min(Math.max(warmupSeconds - 1, 0), data.length - 1);
        return data[idx]?.time || null;
    };
    const qpsWarmupX2 = getWarmupX2(qpsChartData);
    const cpuWarmupX2 = getWarmupX2(cpuChartData);
    const ramWarmupX2 = getWarmupX2(ramChartData);
    const comparisonLabels = {
        Scenario1: "No Index",
        Scenario2: "Index",
        Scenario3: "Redis Cache",
        Scenario4: "Write No Index",
        Scenario5: "Write Heavy Indexes"
    };
    const comparisonData = useMemo(() => (comparisonSummaries || []).map((d) => ({
        name: comparisonLabels[d.scenario] || d.scenario,
        qps: d.throughput_qps || 0,
        avg: d.avg_latency_ms || 0
    })), [comparisonSummaries]);

    const comparisonRows = useMemo(() => (comparisonSummaries || []).map((d) => ({
        name: comparisonLabels[d.scenario] || d.scenario,
        avg_latency_ms: d.avg_latency_ms || 0,
        p95_latency_ms: d.p95_latency_ms || 0,
        p99_latency_ms: d.p99_latency_ms || 0,
        qps: d.throughput_qps || 0,
        avg_cpu: d.avg_cpu_percent || 0,
        peak_cpu: d.peak_cpu_percent || 0,
        efficiency_score: d.efficiency_score || 0,
        avg_ram: d.avg_ram_mb || 0,
        hit_ratio: d.hit_ratio || 0
    })), [comparisonSummaries]);

    const sideBySideChartData = useMemo(() => {
        if (!sideBySideData?.left?.qps_series || !sideBySideData?.right?.qps_series) return [];
        const left = sideBySideData.left.qps_series;
        const right = sideBySideData.right.qps_series;
        const maxLen = Math.max(left.length, right.length);
        const data = [];
        for (let i = 0; i < maxLen; i += 1) {
            data.push({
                sec: i + 1,
                qps_left: left[i]?.qps ?? null,
                qps_right: right[i]?.qps ?? null
            });
        }
        return data;
    }, [sideBySideData]);

    const sideBySideDelta = useMemo(() => {
        const left = sideBySideData?.left?.summary || {};
        const right = sideBySideData?.right?.summary || {};
        if (!Object.keys(left).length || !Object.keys(right).length) return null;

        const pct = (a, b) => {
            const base = Number(a || 0);
            const next = Number(b || 0);
            if (base === 0) return 0;
            return ((next - base) / base) * 100;
        };
        const fmt = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
        const cls = (v, higherIsBetter = true) => {
            if (v === 0) return "delta-neutral";
            const improved = higherIsBetter ? v > 0 : v < 0;
            return improved ? "delta-good" : "delta-bad";
        };

        const qpsDelta = pct(left.throughput_qps, right.throughput_qps);
        const avgLatencyDelta = pct(left.avg_latency_ms, right.avg_latency_ms);
        const p95Delta = pct(left.p95_latency_ms, right.p95_latency_ms);
        const p99Delta = pct(left.p99_latency_ms, right.p99_latency_ms);
        const cpuDelta = pct(left.avg_cpu_percent, right.avg_cpu_percent);
        const efficiencyDelta = pct(left.efficiency_score, right.efficiency_score);

        return {
            qps: { text: fmt(qpsDelta), className: cls(qpsDelta, true) },
            avg_latency: { text: fmt(avgLatencyDelta), className: cls(avgLatencyDelta, false) },
            p95: { text: fmt(p95Delta), className: cls(p95Delta, false) },
            p99: { text: fmt(p99Delta), className: cls(p99Delta, false) },
            avg_cpu: { text: fmt(cpuDelta), className: cls(cpuDelta, false) },
            efficiency: { text: fmt(efficiencyDelta), className: cls(efficiencyDelta, true) },
        };
    }, [sideBySideData]);

    const sideBySideInsights = useMemo(() => {
        if (!sideBySideData?.left?.summary || !sideBySideData?.right?.summary) return [];
        const left = sideBySideData.left.summary;
        const right = sideBySideData.right.summary;
        const mk = (metric, a, b, higherIsBetter = true) => {
            const base = Number(a || 0);
            const next = Number(b || 0);
            if (!base) return null;
            const deltaPct = ((next - base) / base) * 100;
            const improved = higherIsBetter ? deltaPct > 0 : deltaPct < 0;
            return {
                metric,
                runA: base,
                runB: next,
                deltaPct,
                verdict: improved ? "Улучшение" : "Ухудшение"
            };
        };
        return [
            mk("QPS", left.throughput_qps, right.throughput_qps, true),
            mk("Avg Latency (ms)", left.avg_latency_ms, right.avg_latency_ms, false),
            mk("p95 (ms)", left.p95_latency_ms, right.p95_latency_ms, false),
            mk("p99 (ms)", left.p99_latency_ms, right.p99_latency_ms, false),
            mk("Avg CPU (%)", left.avg_cpu_percent, right.avg_cpu_percent, false),
        ].filter(Boolean);
    }, [sideBySideData]);

    const sideBySideWarnings = useMemo(() => {
        const leftQ = sideBySideData?.left?.quality;
        const rightQ = sideBySideData?.right?.quality;
        if (!leftQ || !rightQ) return [];
        const warnings = [];
        if (!leftQ.is_complete || !rightQ.is_complete) {
            warnings.push("Данные неполные: отсутствуют CPU/RAM/метрики для одного из run_id.");
        }
        if (leftQ.run_kind !== rightQ.run_kind) {
            warnings.push("Сравниваются разные типы запусков (normal vs saturation).");
        }
        const ld = Number(leftQ.duration_sec || 0);
        const rd = Number(rightQ.duration_sec || 0);
        if (ld > 0 && rd > 0) {
            const diffRatio = Math.abs(ld - rd) / Math.max(ld, rd);
            if (diffRatio > 0.1) {
                warnings.push(`Разная длительность запусков: ${ld.toFixed(0)}s vs ${rd.toFixed(0)}s.`);
            }
        }
        return warnings;
    }, [sideBySideData]);

    if (isSaturationRun) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button className="history-btn" onClick={() => exportSummaryCSV(summary, comparisonRows, saturationSeries, sideBySideInsights)}>
                        Export CSV
                    </button>
                    <button className="history-btn" onClick={() => exportSummaryPDF(summary, comparisonRows, saturationSeries, sideBySideInsights)}>
                        Export PDF
                    </button>
                </div>
                <div className="chart-card">
                    <h3 className="chart-title">Saturation Analytics</h3>
                    <p className="chart-subtitle">
                        Показаны только графики для режима Saturation: зависимость QPS и p95 от числа потоков.
                    </p>
                    {!activeRunQuality?.is_complete && (
                        <p className="chart-subtitle" style={{ color: "#ff7875" }}>
                            Данные неполные: {Array.isArray(activeRunQuality?.missing) ? activeRunQuality.missing.join(", ") : "проверьте run_id"}.
                        </p>
                    )}
                </div>
                {Array.isArray(saturationSeries) && saturationSeries.length > 0 ? (
                    <SaturationCharts saturationSeries={saturationSeries} />
                ) : (
                    <div className="chart-card">
                        <p className="chart-subtitle">Для этого run_id нет сохраненных saturation stage-метрик.</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                    className="history-btn"
                    onClick={() => exportSummaryCSV(summary, comparisonRows, saturationSeries, sideBySideInsights)}
                >
                    Export CSV
                </button>
                <button
                    className="history-btn"
                    onClick={() => exportSummaryPDF(summary, comparisonRows, saturationSeries, sideBySideInsights)}
                >
                    Export PDF
                </button>
            </div>
            {!activeRunQuality?.is_complete && (
                <div className="chart-card">
                    <h3 className="chart-title">Качество данных</h3>
                    <p className="chart-subtitle" style={{ color: "#ff7875" }}>
                        Данные неполные для текущего run_id: {Array.isArray(activeRunQuality?.missing) ? activeRunQuality.missing.join(", ") : "проверьте источники CPU/RAM/saturation"}.
                    </p>
                </div>
            )}
            {sideBySideChartData.length > 0 && (
                <details className="fold-section" open>
                    <summary className="fold-title">Side-by-side Overlay</summary>
                    <div className="chart-card">
                        <h3 className="chart-title">Side-by-side QPS Overlay</h3>
                        <p className="chart-subtitle">
                            Run A: {sideBySideData?.left?.run_id} ({sideBySideData?.left?.scenario}) | Run B: {sideBySideData?.right?.run_id} ({sideBySideData?.right?.scenario})
                        </p>
                        {sideBySideDelta && (
                            <div className="delta-grid">
                                <div className="delta-item">QPS <b className={sideBySideDelta.qps.className}>{sideBySideDelta.qps.text}</b></div>
                                <div className="delta-item">Avg Latency <b className={sideBySideDelta.avg_latency.className}>{sideBySideDelta.avg_latency.text}</b></div>
                                <div className="delta-item">p95 <b className={sideBySideDelta.p95.className}>{sideBySideDelta.p95.text}</b></div>
                                <div className="delta-item">p99 <b className={sideBySideDelta.p99.className}>{sideBySideDelta.p99.text}</b></div>
                                <div className="delta-item">Avg CPU <b className={sideBySideDelta.avg_cpu.className}>{sideBySideDelta.avg_cpu.text}</b></div>
                                <div className="delta-item">Efficiency <b className={sideBySideDelta.efficiency.className}>{sideBySideDelta.efficiency.text}</b></div>
                            </div>
                        )}
                        {sideBySideWarnings.length > 0 && (
                            <div style={{ marginBottom: "12px", color: "#ff7875", fontSize: "13px" }}>
                                {sideBySideWarnings.map((w, i) => <div key={i}>- {w}</div>)}
                            </div>
                        )}
                        <div style={{ height: "320px", width: "100%" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={sideBySideChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                                    <XAxis dataKey="sec" stroke={theme.text} tick={{ fill: theme.text }} />
                                    <YAxis stroke={theme.text} tick={{ fill: theme.text }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: theme.tooltipBg,
                                            border: `1px solid ${theme.tooltipBorder}`,
                                            borderRadius: "8px"
                                        }}
                                        itemStyle={{ color: theme.title }}
                                    />
                                    <Legend wrapperStyle={{ color: theme.text }} />
                                    <Line type="monotone" dataKey="qps_left" stroke="#69c0ff" strokeWidth={2} dot={false} isAnimationActive={false} name={`Run A (${sideBySideData?.left?.run_id})`} />
                                    <Line type="monotone" dataKey="qps_right" stroke="#ff7875" strokeWidth={2} dot={false} isAnimationActive={false} name={`Run B (${sideBySideData?.right?.run_id})`} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        {sideBySideInsights.length > 0 && (
                            <div style={{ marginTop: "14px", overflowX: "auto" }}>
                                <h4 className="chart-title" style={{ fontSize: "16px", marginBottom: "8px" }}>Итог выводов (Delta %)</h4>
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Метрика</th>
                                            <th>Run A</th>
                                            <th>Run B</th>
                                            <th>Delta %</th>
                                            <th>Вывод</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sideBySideInsights.map((x) => (
                                            <tr key={x.metric}>
                                                <td>{x.metric}</td>
                                                <td>{Number(x.runA).toFixed(2)}</td>
                                                <td>{Number(x.runB).toFixed(2)}</td>
                                                <td>{x.deltaPct >= 0 ? "+" : ""}{x.deltaPct.toFixed(2)}%</td>
                                                <td>{x.verdict}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </details>
            )}

            {Array.isArray(repeatabilityData) && repeatabilityData.length > 0 && (
                <details className="fold-section" open>
                    <summary className="fold-title">Повторяемость (последние 3 прогона)</summary>
                    <div className="chart-card" style={{ overflowX: "auto" }}>
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Scenario</th>
                                    <th>Runs</th>
                                    <th>Avg Latency mean±std</th>
                                    <th>QPS mean±std</th>
                                    <th>Avg CPU mean±std</th>
                                </tr>
                            </thead>
                            <tbody>
                                {repeatabilityData.map((r) => (
                                    <tr key={r.scenario}>
                                        <td>{comparisonLabels[r.scenario] || r.scenario}</td>
                                        <td>{r.runs_count}</td>
                                        <td>{Number(r.avg_latency_ms?.mean || 0).toFixed(2)} ± {Number(r.avg_latency_ms?.stddev || 0).toFixed(2)}</td>
                                        <td>{Number(r.qps?.mean || 0).toFixed(2)} ± {Number(r.qps?.stddev || 0).toFixed(2)}</td>
                                        <td>{Number(r.avg_cpu_percent?.mean || 0).toFixed(2)} ± {Number(r.avg_cpu_percent?.stddev || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            )}

            {Array.isArray(saturationSeries) && saturationSeries.length > 0 && (
                <details className="fold-section" open>
                    <summary className="fold-title">Saturation Анализ</summary>
                    <SaturationCharts saturationSeries={saturationSeries} />
                </details>
            )}

            <details className="fold-section" open>
            <summary className="fold-title">Ресурсы И Cache</summary>
            {/* QPS */}
            <div className="chart-card">
                <h3 className="chart-title">QPS во времени (Grafana-style)</h3>
                <p className="chart-subtitle">Реальное время на оси X и сглаженная линия, как в Grafana.</p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={qpsChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                            {qpsWarmupX2 && (
                                <ReferenceArea
                                    x1={qpsChartData[0]?.time}
                                    x2={qpsWarmupX2}
                                    fill="#7c3aed"
                                    fillOpacity={0.12}
                                    ifOverflow="extendDomain"
                                />
                            )}
                            <XAxis 
                                dataKey="time" 
                                stroke={theme.text}
                                tick={{ fill: theme.text }}
                                label={{ value: 'Время', position: 'insideBottom', offset: -5, fill: theme.text }} 
                            />
                            <YAxis stroke={theme.text} tick={{ fill: theme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: theme.tooltipBg, 
                                    border: `1px solid ${theme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: theme.title }}
                            />
                            <Legend wrapperStyle={{ color: theme.text }} />
                            <Line 
                                type="monotone" 
                                dataKey="qps" 
                                stroke="#69c0ff"
                                strokeWidth={1}
                                dot={false}
                                name="QPS (raw)"
                                isAnimationActive={false}
                                opacity={0.35}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="qps_smooth" 
                                stroke="#69c0ff" 
                                strokeWidth={2} 
                                dot={false} 
                                name="QPS (smooth)"
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* CPU */}
            <div className="chart-card">
                <h3 className="chart-title">CPU Usage (%)</h3>
                <p className="chart-subtitle">Временной ряд загрузки CPU PostgreSQL во время теста. Значение может быть больше 100%, так как отображает суммарную загрузку по нескольким ядрам.</p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cpuChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                            {cpuWarmupX2 && (
                                <ReferenceArea
                                    x1={cpuChartData[0]?.time}
                                    x2={cpuWarmupX2}
                                    fill="#7c3aed"
                                    fillOpacity={0.12}
                                    ifOverflow="extendDomain"
                                />
                            )}
                            <XAxis 
                                dataKey="time" 
                                stroke={theme.text}
                                tick={{ fill: theme.text }}
                                label={{ value: 'Время', position: 'insideBottom', offset: -5, fill: theme.text }} 
                            />
                            <YAxis 
                                stroke={theme.text} 
                                tick={{ fill: theme.text }} 
                                domain={[0, "dataMax"]}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: theme.tooltipBg, 
                                    border: `1px solid ${theme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: theme.title }}
                            />
                            <Legend wrapperStyle={{ color: theme.text }} />
                            <Line 
                                type="monotone" 
                                dataKey="cpu" 
                                stroke="#ffb347"
                                strokeWidth={1}
                                dot={false}
                                name="CPU (raw)"
                                isAnimationActive={false}
                                opacity={0.35}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="cpu_smooth" 
                                stroke="#ffb347"
                                strokeWidth={2}
                                dot={false}
                                name="CPU (smooth)"
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* RAM */}
            <div className="chart-card">
                <h3 className="chart-title">RAM Usage (Redis, MB)</h3>
                <p className="chart-subtitle">Показывает цену оптимизации: Redis потребляет память, но ускоряет ответы.</p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ramChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                            {ramWarmupX2 && (
                                <ReferenceArea
                                    x1={ramChartData[0]?.time}
                                    x2={ramWarmupX2}
                                    fill="#7c3aed"
                                    fillOpacity={0.12}
                                    ifOverflow="extendDomain"
                                />
                            )}
                            <XAxis 
                                dataKey="time" 
                                stroke={theme.text}
                                tick={{ fill: theme.text }}
                                label={{ value: 'Время', position: 'insideBottom', offset: -5, fill: theme.text }} 
                            />
                            <YAxis stroke={theme.text} tick={{ fill: theme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: theme.tooltipBg, 
                                    border: `1px solid ${theme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: theme.title }}
                            />
                            <Legend wrapperStyle={{ color: theme.text }} />
                            <Area type="monotone" dataKey="ram_mb" stroke="#ffd666" fill="#ffd666" fillOpacity={0.25} name="RAM (raw)" isAnimationActive={false} />
                            <Area type="monotone" dataKey="ram_smooth" stroke="#ffa940" fill="#ffa940" fillOpacity={0.35} name="RAM (smooth)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Cache Hit Ratio only for Scenario3 */}
            {(activeScenario === "Scenario3" || (cacheSummary && ((cacheSummary.hits || 0) + (cacheSummary.misses || 0) > 0))) && (
                <div className="chart-card">
                    <h3 className="chart-title">Cache Hit Ratio</h3>
                    <p className="chart-subtitle">Распределение запросов между L1, L2 (Redis) и промахами.</p>
                    <div style={{ height: "280px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: theme.tooltipBg, 
                                        border: `1px solid ${theme.tooltipBorder}`,
                                        borderRadius: "8px"
                                    }}
                                    itemStyle={{ color: theme.title }}
                                />
                                <Legend wrapperStyle={{ color: theme.text }} />
                                <Pie
                                    data={cacheData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    startAngle={90}
                                    endAngle={-270}
                                    paddingAngle={1}
                                    minAngle={1}
                                    isAnimationActive={false}
                                    stroke="none"
                                >
                                    {cacheData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={cacheColors[index % cacheColors.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: "8px", color: theme.text, fontSize: "13px" }}>
                        Hit Ratio: {cacheSummary?.hit_ratio?.toFixed(2) || 0}%
                    </div>
                    <div style={{ marginTop: "6px", color: theme.text, fontSize: "13px" }}>
                        Avg latency: L1 {cacheSummary?.avg_l1_latency_ms?.toFixed(3) || 0} ms, L2 {cacheSummary?.avg_l2_latency_ms?.toFixed(3) || 0} ms, DB {cacheSummary?.avg_db_latency_ms?.toFixed(2) || 0} ms
                    </div>
                </div>
            )}
            </details>

            <details className="fold-section" open>
            <summary className="fold-title">Задержки</summary>
            {/* LATENCY */}
            <div className="chart-card">
                <h3 className="chart-title">Задержка (Latency, ms)</h3>
                <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                            <XAxis dataKey="name" stroke={theme.text} tick={{ fill: theme.text }} />
                            <YAxis stroke={theme.text} tick={{ fill: theme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: theme.tooltipBg, 
                                    border: `1px solid ${theme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: theme.title }}
                            />
                            <Legend wrapperStyle={{ color: theme.text }} />
                            <Bar dataKey="Scenario1" fill="#ff7875" name="No Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario2" fill="#95de64" name="Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario3" fill="#69c0ff" name="Redis" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario4" fill="#ffc069" name="Write No Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario5" fill="#b37feb" name="Write Heavy Indexes" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* PERCENTILES */}
            <div className="chart-card">
                <h3 className="chart-title">Стабильность: Перцентили задержки</h3>
                <p className="chart-subtitle">p99 показывает задержку для 1% самых "несчастливых" запросов. Чем ближе p99 к среднему, тем стабильнее система.</p>
                <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={percentileData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                            <XAxis dataKey="name" stroke={theme.text} tick={{ fill: theme.text }} />
                            <YAxis stroke={theme.text} tick={{ fill: theme.text }} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: theme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: theme.tooltipBg, 
                                    border: `1px solid ${theme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: theme.title }}
                            />
                            <Legend wrapperStyle={{ color: theme.text }} />
                            <Bar dataKey="p95" fill="#8884d8" name="p95 (95% запросов быстрее этого)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="p99" fill="#82ca9d" name="p99 (Пиковая задержка)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            </details>

            {comparisonData.length > 0 && (
                <details className="fold-section">
                    <summary className="fold-title">Итоговое Сравнение Сценариев</summary>
                    <div className="chart-card">
                        <h3 className="chart-title">QPS по сценариям</h3>
                        <div style={{ height: "300px", width: "100%" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
                                    <XAxis dataKey="name" stroke={theme.text} tick={{ fill: theme.text }} />
                                    <YAxis stroke={theme.text} tick={{ fill: theme.text }} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: theme.tooltipBg, 
                                            border: `1px solid ${theme.tooltipBorder}`,
                                            borderRadius: "8px"
                                        }}
                                        itemStyle={{ color: theme.title }}
                                    />
                                    <Legend wrapperStyle={{ color: theme.text }} />
                                    <Bar dataKey="qps" fill="#69c0ff" name="QPS" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="chart-card">
                        <h3 className="chart-title">Итоговая таблица сравнения</h3>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        <th>Scenario</th>
                                        <th>Avg Latency (ms)</th>
                                        <th>p95 (ms)</th>
                                        <th>p99 (ms)</th>
                                        <th>QPS</th>
                                        <th>Avg CPU %</th>
                                        <th>Peak CPU %</th>
                                        <th>Efficiency</th>
                                        <th>Avg RAM (MB)</th>
                                        <th>Hit Ratio %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonRows.map((row, idx) => (
                                        <tr key={idx}>
                                            <td>{row.name}</td>
                                            <td>{row.avg_latency_ms.toFixed(2)}</td>
                                            <td>{row.p95_latency_ms.toFixed(2)}</td>
                                            <td>{row.p99_latency_ms.toFixed(2)}</td>
                                            <td>{row.qps.toFixed(2)}</td>
                                            <td>{row.avg_cpu.toFixed(2)}</td>
                                            <td>{row.peak_cpu.toFixed(2)}</td>
                                            <td>{row.efficiency_score.toFixed(4)}</td>
                                            <td>{row.avg_ram.toFixed(2)}</td>
                                            <td>{row.hit_ratio.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </details>
            )}
        </div>
    );
};
