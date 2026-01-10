

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';


export const MetricsGraph = ({ getChartData }) => {
    return <>
<div style={{ backgroundColor: "#fff", padding: "25px", borderRadius: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginBottom: "20px" }}>Latency (ms)</h3>
            <div style={{ height: "350px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Scenario1" fill="#ff4d4f" name="Без индексов" />
                  <Bar dataKey="Scenario2" fill="#52c41a" name="С индексами" />
                  <Bar dataKey="Scenario3" fill="#1890ff" name="Redis" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
    </>
}