import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#EC4899', '#6B7280'];

export default function Reports() {
  const [report, setReport] = useState(null);

  useEffect(() => { api.get('/api/reports/summary').then(setReport); }, []);

  if (!report) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>Reports & Analytics</h1><p>System performance and analytics overview</p></div></div>

      <div className="stats-grid">
        <div className="stat-card-simple"><h3>{report.total}</h3><p>Total Requests</p></div>
        <div className="stat-card-simple"><h3>{report.totalUsers}</h3><p>Total Users</p></div>
        <div className="stat-card-simple"><h3>{report.avgResolutionTime}</h3><p>Avg Resolution Time</p></div>
        <div className="stat-card-simple"><h3>{report.clientSatisfaction}</h3><p>Client Satisfaction</p></div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3>Requests by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Requests by Priority</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.byPriority}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Requests by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={report.byCategory.filter(c => c.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, count }) => `${name}: ${count}`}>
                {report.byCategory.filter(c => c.count > 0).map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
