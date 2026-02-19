import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export const SaturationCharts = ({ saturationSeries }) => {
  const theme = {
    grid: "var(--border)",
    text: "var(--text-muted)",
    tooltipBg: "var(--bg-card)",
    tooltipBorder: "var(--border)",
    title: "var(--text-strong)"
  };

  if (!Array.isArray(saturationSeries) || saturationSeries.length === 0) {
    return null;
  }

  const chartData = saturationSeries.map((s) => ({
    threads: s.threads,
    qps: s.qps,
    p95: s.p95_latency_ms,
    cpu_avg: s.avg_cpu_percent || 0,
    cpu_peak: s.peak_cpu_percent || 0
  }));
  const stopReason = saturationSeries[saturationSeries.length - 1]?.stop_reason;

  return (
    <div className="saturation-preview">
      <div className="chart-card">
        <h3 className="chart-title">Saturation: QPS vs Threads</h3>
        <div style={{ height: "260px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
              <XAxis dataKey="threads" stroke={theme.text} tick={{ fill: theme.text }} />
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
              <Line type="monotone" dataKey="qps" stroke="#69c0ff" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} name="QPS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Saturation: p95 vs Threads</h3>
        <div style={{ height: "260px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
              <XAxis dataKey="threads" stroke={theme.text} tick={{ fill: theme.text }} />
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
              <Line type="monotone" dataKey="p95" stroke="#ff7875" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} name="p95 (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {stopReason && (
          <div className="phase-row" style={{ marginTop: "8px" }}>
            Stop reason: <b>{stopReason}</b>
          </div>
        )}
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Saturation: CPU vs Threads</h3>
        <div style={{ height: "260px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
              <XAxis dataKey="threads" stroke={theme.text} tick={{ fill: theme.text }} />
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
              <Line type="monotone" dataKey="cpu_avg" stroke="#faad14" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} name="Avg CPU (%)" />
              <Line type="monotone" dataKey="cpu_peak" stroke="#ffc53d" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} name="Peak CPU (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
