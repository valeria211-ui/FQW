import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportSummaryCSV(summary, comparisonRows) {
  const rows = [];
  rows.push(["Avg Latency (ms)", summary?.avg_latency_ms ?? 0]);
  rows.push(["p95 (ms)", summary?.p95_latency_ms ?? 0]);
  rows.push(["p99 (ms)", summary?.p99_latency_ms ?? 0]);
  rows.push(["QPS", summary?.throughput_qps ?? 0]);
  rows.push(["Avg CPU %", summary?.avg_cpu_percent ?? 0]);
  rows.push(["Peak CPU %", summary?.peak_cpu_percent ?? 0]);
  rows.push(["Warm-up (s)", summary?.warmup_seconds ?? 0]);

  const compareHeader = [
    "Scenario",
    "Avg Latency (ms)",
    "p95 (ms)",
    "p99 (ms)",
    "QPS",
    "Avg CPU %",
    "Peak CPU %",
    "Avg RAM (MB)",
    "Hit Ratio %"
  ];

  const compareRows = (comparisonRows || []).map(r => [
    r.name,
    r.avg_latency_ms,
    r.p95_latency_ms,
    r.p99_latency_ms,
    r.qps,
    r.avg_cpu,
    r.peak_cpu,
    r.avg_ram,
    r.hit_ratio
  ]);

  let csv = "Metric,Value\n" + rows.map(r => `${r[0]},${r[1]}`).join("\n");
  if (compareRows.length > 0) {
    csv += "\n\nComparison\n" + compareHeader.join(",") + "\n";
    csv += compareRows.map(r => r.join(",")).join("\n");
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "benchmark_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSummaryPDF(summary, comparisonRows, title = "Benchmark Report") {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);

  doc.setFontSize(11);
  doc.text(`Avg Latency (ms): ${summary?.avg_latency_ms?.toFixed?.(2) ?? 0}`, 14, 26);
  doc.text(`p95 (ms): ${summary?.p95_latency_ms?.toFixed?.(2) ?? 0}`, 14, 32);
  doc.text(`p99 (ms): ${summary?.p99_latency_ms?.toFixed?.(2) ?? 0}`, 14, 38);
  doc.text(`QPS: ${summary?.throughput_qps?.toFixed?.(2) ?? 0}`, 14, 44);
  doc.text(`Avg CPU %: ${summary?.avg_cpu_percent?.toFixed?.(2) ?? 0}`, 14, 50);
  doc.text(`Peak CPU %: ${summary?.peak_cpu_percent?.toFixed?.(2) ?? 0}`, 14, 56);
  doc.text(`Warm-up (s): ${summary?.warmup_seconds ?? 0}`, 14, 62);

  if (comparisonRows && comparisonRows.length > 0) {
    doc.autoTable({
      startY: 72,
      head: [[
        "Scenario",
        "Avg Latency",
        "p95",
        "p99",
        "QPS",
        "Avg CPU",
        "Peak CPU",
        "Avg RAM",
        "Hit Ratio"
      ]],
      body: comparisonRows.map(r => [
        r.name,
        Number(r.avg_latency_ms).toFixed(2),
        Number(r.p95_latency_ms).toFixed(2),
        Number(r.p99_latency_ms).toFixed(2),
        Number(r.qps).toFixed(2),
        Number(r.avg_cpu).toFixed(2),
        Number(r.peak_cpu).toFixed(2),
        Number(r.avg_ram).toFixed(2),
        Number(r.hit_ratio).toFixed(2)
      ])
    });
  }

  doc.save("benchmark_report.pdf");
}
