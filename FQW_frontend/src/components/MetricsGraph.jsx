import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

export const MetricsGraph = ({ getChartData, getPercentileData, summary, qpsSeries, cpuSeries, ramSeries, cacheSummary, comparisonSummaries }) => {
    // Цвета для темной темы
    const darkTheme = {
        grid: "#2d303a",
        text: "#888",
        tooltipBg: "#1a1c23",
        tooltipBorder: "#2d303a",
        title: "#fff"
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

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            <div style={{ marginTop: "10px", color: darkTheme.title, fontWeight: 600, fontSize: "16px" }}>
                Ресурсы и производительность
            </div>

            {/* ГРАФИК 1: QPS (Time Series, Grafana-style) */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>QPS во времени (Grafana-style)</h3>
                <p style={{ fontSize: "14px", color: darkTheme.text, marginBottom: "20px" }}>
                    Реальное время на оси X и сглаженная линия, как в Grafana.
                </p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={qpsChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                            <XAxis 
                                dataKey="time" 
                                stroke={darkTheme.text}
                                tick={{ fill: darkTheme.text }}
                                label={{ value: 'Время', position: 'insideBottom', offset: -5, fill: darkTheme.text }} 
                            />
                            <YAxis stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
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

            {/* ГРАФИК 3: CPU Usage */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>CPU Usage (%)</h3>
                <p style={{ fontSize: "14px", color: darkTheme.text, marginBottom: "20px" }}>
                    Временной ряд загрузки CPU PostgreSQL во время теста.
                </p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cpuChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                            <XAxis 
                                dataKey="time" 
                                stroke={darkTheme.text}
                                tick={{ fill: darkTheme.text }}
                                label={{ value: 'Время', position: 'insideBottom', offset: -5, fill: darkTheme.text }} 
                            />
                            <YAxis 
                                stroke={darkTheme.text} 
                                tick={{ fill: darkTheme.text }} 
                                domain={[0, "dataMax"]}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
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

            {/* ГРАФИК 4: RAM Usage */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>RAM Usage (Redis, MB)</h3>
                <p style={{ fontSize: "14px", color: darkTheme.text, marginBottom: "20px" }}>
                    Показывает цену оптимизации: Redis потребляет память, но ускоряет ответы.
                </p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ramChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                            <XAxis 
                                dataKey="time" 
                                stroke={darkTheme.text}
                                tick={{ fill: darkTheme.text }}
                                label={{ value: 'Время', position: 'insideBottom', offset: -5, fill: darkTheme.text }} 
                            />
                            <YAxis stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="ram_mb" stroke="#ffd666" fill="#ffd666" fillOpacity={0.25} name="RAM (raw)" />
                            <Area type="monotone" dataKey="ram_smooth" stroke="#ffa940" fill="#ffa940" fillOpacity={0.35} name="RAM (smooth)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ГРАФИК 5: Cache Hit Ratio */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>Cache Hit Ratio</h3>
                <p style={{ fontSize: "14px", color: darkTheme.text, marginBottom: "20px" }}>
                    Доля запросов, обслуженных из Redis (Scenario 3).
                </p>
                <div style={{ height: "280px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
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
                <div style={{ marginTop: "8px", color: darkTheme.text, fontSize: "13px" }}>
                    Hit Ratio: {cacheSummary?.hit_ratio?.toFixed(2) || 0}%
                </div>
            </div>

            <div style={{ marginTop: "10px", color: darkTheme.title, fontWeight: 600, fontSize: "16px" }}>
                Задержки
            </div>

            {/* ГРАФИК 2: LATENCY */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "20px", color: darkTheme.title }}>Задержка (Latency, ms)</h3>
                <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getChartData()}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                            <XAxis dataKey="name" stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                            <YAxis stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
                            <Bar dataKey="Scenario1" fill="#ff7875" name="No Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario2" fill="#95de64" name="Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario3" fill="#69c0ff" name="Redis" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ГРАФИК 6: ПЕРЦЕНТИЛИ (p95 / p99) */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>Стабильность: Перцентили задержки</h3>
                <p style={{ fontSize: "14px", color: darkTheme.text, marginBottom: "20px" }}>
                    p99 показывает задержку для 1% самых "несчастливых" запросов. Чем ближе p99 к среднему, тем стабильнее система.
                </p>
                <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getPercentileData()}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                            <XAxis dataKey="name" stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                            <YAxis stroke={darkTheme.text} tick={{ fill: darkTheme.text }} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: darkTheme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
                            {/* p95 - основной показатель */}
                            <Bar dataKey="p95" fill="#8884d8" name="p95 (95% запросов быстрее этого)" radius={[4, 4, 0, 0]} />
                            {/* p99 - показатель "хвоста" */}
                            <Bar dataKey="p99" fill="#82ca9d" name="p99 (Пиковая задержка)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {comparisonData.length > 0 && (
                <>
                    <div style={{ marginTop: "10px", color: darkTheme.title, fontWeight: 600, fontSize: "16px" }}>
                        Дополнительно: сравнение сценариев (по выбранным run_id)
                    </div>
                    <div className="chart-card">
                        <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>QPS по сценариям</h3>
                        <div style={{ height: "300px", width: "100%" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                                    <XAxis dataKey="name" stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                                    <YAxis stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: darkTheme.tooltipBg, 
                                            border: `1px solid ${darkTheme.tooltipBorder}`,
                                            borderRadius: "8px"
                                        }}
                                        itemStyle={{ color: "#fff" }}
                                    />
                                    <Legend />
                                    <Bar dataKey="qps" fill="#69c0ff" name="QPS" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
