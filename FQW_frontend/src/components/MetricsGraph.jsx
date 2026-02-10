import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { exportSummaryCSV, exportSummaryPDF } from "../utils/reportExport";

export const MetricsGraph = ({ getChartData, getPercentileData, summary, qpsSeries, cpuSeries, ramSeries, cacheSummary, comparisonSummaries, activeScenario }) => {
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

    const buildSeries = (series, valueKey, smoothKey, windowSize = 3) => {
        const data = series.map((d) => ({
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

    const qpsChartData = buildSeries(qpsSeries || [], "qps", "qps_smooth");
    const cpuChartData = buildSeries(cpuSeries || [], "cpu", "cpu_smooth");
    const ramChartData = buildSeries(ramSeries || [], "ram_mb", "ram_smooth");

    const cacheData = [
        { name: "Hit", value: cacheSummary?.hits || 0 },
        { name: "Miss", value: cacheSummary?.misses || 0 }
    ];
    const cacheColors = ["#52c41a", "#ff7875"];
    const comparisonLabels = {
        Scenario1: "No Index",
        Scenario2: "Index",
        Scenario3: "Redis Cache"
    };
    const comparisonData = (comparisonSummaries || []).map((d) => ({
        name: comparisonLabels[d.scenario] || d.scenario,
        qps: d.throughput_qps || 0,
        avg: d.avg_latency_ms || 0
    }));

    const comparisonRows = (comparisonSummaries || []).map((d) => ({
        name: comparisonLabels[d.scenario] || d.scenario,
        avg_latency_ms: d.avg_latency_ms || 0,
        p95_latency_ms: d.p95_latency_ms || 0,
        p99_latency_ms: d.p99_latency_ms || 0,
        qps: d.throughput_qps || 0,
        avg_cpu: d.avg_cpu_percent || 0,
        peak_cpu: d.peak_cpu_percent || 0,
        avg_ram: d.avg_ram_mb || 0,
        hit_ratio: d.hit_ratio || 0
    }));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                    className="history-btn"
                    onClick={() => exportSummaryCSV(summary, comparisonRows)}
                >
                    Export CSV
                </button>
                <button
                    className="history-btn"
                    onClick={() => exportSummaryPDF(summary, comparisonRows)}
                >
                    Export PDF
                </button>
            </div>
            <div className="section-title">Ресурсы и производительность</div>

            {/* QPS */}
            <div className="chart-card">
                <h3 className="chart-title">QPS во времени (Grafana-style)</h3>
                <p className="chart-subtitle">Реальное время на оси X и сглаженная линия, как в Grafana.</p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={qpsChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
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
                                dot={{ r: 2, fill: "#69c0ff" }}
                                name="QPS (raw)"
                                animationDuration={900}
                                opacity={0.35}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="qps_smooth" 
                                stroke="#69c0ff" 
                                strokeWidth={2} 
                                dot={false} 
                                name="QPS (smooth)"
                                animationDuration={900}
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
                                dot={{ r: 2, fill: "#ffb347" }}
                                name="CPU (raw)"
                                animationDuration={900}
                                opacity={0.35}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="cpu_smooth" 
                                stroke="#ffb347"
                                strokeWidth={2}
                                dot={false}
                                name="CPU (smooth)"
                                animationDuration={900}
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
                            <Area type="monotone" dataKey="ram_mb" stroke="#ffd666" fill="#ffd666" fillOpacity={0.25} name="RAM (raw)" />
                            <Area type="monotone" dataKey="ram_smooth" stroke="#ffa940" fill="#ffa940" fillOpacity={0.35} name="RAM (smooth)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Cache Hit Ratio only for Scenario3 */}
            {activeScenario === "Scenario3" && (
                <div className="chart-card">
                    <h3 className="chart-title">Cache Hit Ratio</h3>
                    <p className="chart-subtitle">Доля запросов, обслуженных из Redis (Scenario 3).</p>
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
                                    paddingAngle={2}
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
                </div>
            )}

            <div className="section-title">Задержки</div>

            {/* LATENCY */}
            <div className="chart-card">
                <h3 className="chart-title">Задержка (Latency, ms)</h3>
                <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getChartData()}>
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
                        <BarChart data={getPercentileData()}>
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

            {comparisonData.length > 0 && (
                <>
                    <div className="section-title">Дополнительно: сравнение сценариев (по выбранным run_id)</div>
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
                                            <td>{row.avg_ram.toFixed(2)}</td>
                                            <td>{row.hit_ratio.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
