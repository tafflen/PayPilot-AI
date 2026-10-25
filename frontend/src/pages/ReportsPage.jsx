import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  RefreshCw,
  PieChart,
  ShieldAlert,
  CreditCard,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const SEVERITY_COLORS = {
  critical: '#f43f5e',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#06b6d4',
};

export function ReportsPage() {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.reports.getReports();
      setReportData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (isLoading) return <LoadingState message="Generating ledger analytics..." />;
  if (error) return <ErrorState message={error} onRetry={fetchReports} />;

  const {
    incidentBreakdown = {},
    incidentsBySeverity = [],
    paymentsByCurrencyAndStatus = [],
    recentAuditLogs = [],
  } = reportData;

  const severityChartData = incidentsBySeverity.map((item) => ({
    name: item._id ? item._id.toUpperCase() : 'UNKNOWN',
    value: item.count,
    color: SEVERITY_COLORS[item._id] || '#64748b',
  }));

  const auditLogColumns = [
    {
      header: 'Timestamp',
      key: 'timestamp',
      render: (log) => (
        <span style={{ fontSize: '0.82rem' }}>{formatDateTime(log.timestamp)}</span>
      ),
    },
    {
      header: 'Actor',
      key: 'actor',
      render: (log) => (
        <span className="font-mono text-teal" style={{ fontSize: '0.82rem' }}>
          {log.actor}
        </span>
      ),
    },
    {
      header: 'Action',
      key: 'action',
      render: (log) => (
        <span className="font-mono" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
          {log.action}
        </span>
      ),
    },
    {
      header: 'Target Resource',
      key: 'resourceType',
      render: (log) => (
        <span style={{ fontSize: '0.85rem' }}>
          {log.resourceType} {log.resourceId ? `(${log.resourceId.slice(-6)})` : ''}
        </span>
      ),
    },
    {
      header: 'Summary',
      key: 'details',
      render: (log) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {typeof log.details === 'object'
            ? Object.entries(log.details)
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')
            : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <BarChart3 size={24} color="var(--accent-teal)" /> Ledger Reports & Audit Trail
          </h1>
          <p className="page-subtitle">
            Discrepancy distributions, FX currency volume segregation, and compliance audit logs
          </p>
        </div>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={fetchReports}>
            <RefreshCw size={14} /> Refresh Reports
          </button>
        </div>
      </div>

      {/* Top Row: Incident Types and Severity Breakdown */}
      <div className="grid-cols-2">
        {/* Incident Severity Pie Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <ShieldAlert size={18} color="var(--accent-teal)" /> Incidents by Severity
            </h3>
          </div>
          <div className="card-body" style={{ height: '260px' }}>
            {severityChartData.length === 0 ? (
              <p className="text-muted">No incidents recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Currency-Segregated Totals */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <CreditCard size={18} color="var(--accent-teal)" /> Payment Totals Grouped by Status & Currency
            </h3>
            <span className="badge badge-neutral">No FX Blending</span>
          </div>
          <div className="card-body" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {paymentsByCurrencyAndStatus.length === 0 ? (
              <p className="text-muted">No payments recorded.</p>
            ) : (
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsByCurrencyAndStatus.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-teal" style={{ fontWeight: 700 }}>
                        {item._id.currency}
                      </td>
                      <td>
                        <StatusBadge status={item._id.status} />
                      </td>
                      <td>{item.count}</td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(item.totalMinor, item._id.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Incident Status by Type Breakdown */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FileText size={18} color="var(--accent-teal)" /> Incident Inventory by Anomaly Rule
          </h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="data-table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Anomaly Type</th>
                  <th>Open</th>
                  <th>Investigating</th>
                  <th>Resolved</th>
                  <th>Total Detected</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(incidentBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No incidents logged yet.
                    </td>
                  </tr>
                ) : (
                  Object.entries(incidentBreakdown).map(([type, counts]) => (
                    <tr key={type}>
                      <td style={{ fontWeight: 600 }}>{type.replace(/_/g, ' ')}</td>
                      <td>
                        <span style={{ color: counts.open > 0 ? 'var(--status-danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {counts.open}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: counts.investigating > 0 ? 'var(--status-warning)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {counts.investigating}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: counts.resolved > 0 ? 'var(--status-success)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {counts.resolved}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontWeight: 700 }}>
                        {counts.total}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Platform Audit Trail */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FileText size={18} color="var(--accent-teal)" /> Security & Ledger Change Audit Trail
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tamper-evident logs of reconciliation runs and incident updates
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <DataTable
            columns={auditLogColumns}
            data={recentAuditLogs}
            emptyTitle="No audit logs recorded"
            emptyDescription="Platform operations and changes will appear here."
          />
        </div>
      </div>
    </div>
  );
}
