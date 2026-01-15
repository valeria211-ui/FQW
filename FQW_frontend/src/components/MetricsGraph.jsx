import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  ResponsiveContainer, Legend, LineChart, Line 
} from 'recharts';

export const MetricsGraph = ({ getChartData, getLineChartData, getBarChartData, getPercentileData }) => {
    // Цвета для темной темы
    const darkTheme = {
        grid: "#2d303a",
        text: "#888",
        tooltipBg: "#1a1c23",
        tooltipBorder: "#2d303a",
        title: "#fff"
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            {/* ГРАФИК 1: ЛИНЕЙНЫЙ (ДИНАМИКА QPS) */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>📈 Динамика пропускной способности (QPS)</h3>
                <p style={{ fontSize: "14px", color: darkTheme.text, marginBottom: "20px" }}>
                    Показывает "прогрев" системы. В Scenario 3 виден резкий взлет при попадании в кэш.
                </p>
                <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getLineChartData()}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkTheme.grid} />
                            <XAxis 
                                dataKey="name" 
                                stroke={darkTheme.text}
                                tick={{ fill: darkTheme.text }}
                                label={{ value: 'Запрос №', position: 'insideBottom', offset: -5, fill: darkTheme.text }} 
                            />
                            <YAxis stroke={darkTheme.text} tick={{ fill: darkTheme.text }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: darkTheme.tooltipBg, 
                                    border: `1px solid ${darkTheme.tooltipBorder}`,
                                    borderRadius: "8px",
                                    color: "#fff"
                                }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
                            <Line 
                                type="monotone" 
                                dataKey="qps" 
                                stroke="#646cff" 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: "#646cff" }} 
                                name="Запросов в сек."
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ГРАФИК 2: LATENCY */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "20px", color: darkTheme.title }}>⏱ Задержка (Latency, ms)</h3>
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
                            <Bar dataKey="Scenario1" fill="#ff7875" name="QPS: No Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario2" fill="#95de64" name="QPS: Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario3" fill="#69c0ff" name="QPS: Redis" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ГРАФИК 3: THROUGHPUT */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "20px", color: darkTheme.title }}>🚀 Сравнение пропускной способности (Max QPS)</h3>
                <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getBarChartData()}>
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
                            <Bar dataKey="Scenario1" fill="#ff7875" name="QPS: No Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario2" fill="#95de64" name="QPS: Index" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Scenario3" fill="#69c0ff" name="QPS: Redis" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* ГРАФИК 4: ПЕРЦЕНТИЛИ (p95 / p99) */}
            <div className="chart-card">
                <h3 style={{ marginBottom: "10px", color: darkTheme.title }}>🎯 Стабильность: Перцентили задержки</h3>
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
        </div>
    );
};