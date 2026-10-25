import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertOctagon,
  AlertTriangle,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { api } from '../services/api';
import { StatCard } from '../components/common/StatCard';
import { IncidentCard } from '../components/incidents/IncidentCard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { formatCurrency } from '../utils/formatters';

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.dashboard.getStats();
      setStats(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading) return <LoadingState message="Aggregating live ledger metrics..." />;
  if (error) return <ErrorState message={error} onRetry={fetchStats} />;

  const { kpis, totalsByCurrency, recentIncidents, paymentStatusDistribution } = stats;

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Reconciliation Command Center
          </h1>
          <p className="page-subtitle">
            Continuous payment audit trail, anomaly detection, and investigation queue
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchStats}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/incidents')}>
            Open Incidents Queue ({kpis.openIncidentsCount})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-cols-4">
        <StatCard
          label="Total Recorded Payments"
          value={kpis.totalPaymentsCount}
          subtext="Processed in ledger"
          icon={CreditCard}
          color="teal"
          onClick={() => navigate('/transactions')}
        />
        <StatCard
          label="Captured / Settled"
          value={kpis.capturedCount}
          subtext="Verified successful"
          icon={CheckCircle2}
          color="emerald"
          onClick={() => navigate('/transactions?status=captured')}
        />
        <StatCard
          label="Pending Clearance"
          value={kpis.pendingCount}
          subtext="Awaiting settlement"
          icon={Clock}
          color="amber"
          onClick={() => navigate('/transactions?status=pending')}
        />
        <StatCard
          label="Failed Payments"
          value={kpis.failedCount}
          subtext="Gateway declined"
          icon={AlertOctagon}
          color="rose"
          onClick={() => navigate('/transactions?status=failed')}
        />
      </div>

      <div className="grid-cols-4">
        <StatCard
          label="Open Incidents"
          value={kpis.openIncidentsCount}
          subtext="Requires investigation"
          icon={AlertTriangle}
          color="rose"
          onClick={() => navigate('/incidents?status=open')}
        />
        <StatCard
          label="Under Investigation"
          value={kpis.investigatingIncidentsCount}
          subtext="Active analyst review"
          icon={Clock}
          color="amber"
          onClick={() => navigate('/incidents?status=investigating')}
        />
        <StatCard
          label="Resolved Incidents"
          value={kpis.resolvedIncidentsCount}
          subtext="Audited & closed"
          icon={FileCheck2}
          color="emerald"
          onClick={() => navigate('/incidents?status=resolved')}
        />
        <StatCard
          label="Total Orders Monitored"
          value={kpis.totalOrdersCount}
          subtext={`${kpis.paidOrdersCount} Paid &bull; ${kpis.pendingOrdersCount} Unpaid`}
          icon={TrendingUp}
          color="teal"
          onClick={() => navigate('/orders')}
        />
      </div>

      {/* Middle Row: Currency Totals & Distribution Chart */}
      <div className="grid-cols-2">
        {/* Currency Volumes (Never combined!) */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <CreditCard size={18} color="var(--accent-teal)" /> Payment Volumes by Currency
            </h3>
            <span className="badge badge-neutral">Segregated FX</span>
          </div>
          <div className="card-body">
            {Object.keys(totalsByCurrency || {}).length === 0 ? (
              <p className="text-muted">No currency volumes recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(totalsByCurrency).map(([curr, item]) => (
                  <div
                    key={curr}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      padding: '1rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="font-mono" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-teal)' }}>
                        {curr}
                      </span>
                      <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {formatCurrency(item.totalMinor, curr)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>
                        Captured: <strong style={{ color: 'var(--status-success)' }}>{formatCurrency(item.capturedMinor, curr)}</strong>
                      </div>
                      <div>
                        Pending: <strong style={{ color: 'var(--status-warning)' }}>{formatCurrency(item.pendingMinor, curr)}</strong>
                      </div>
                      <div>
                        Failed: <strong style={{ color: 'var(--status-danger)' }}>{formatCurrency(item.failedMinor, curr)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Status Distribution Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} color="var(--accent-teal)" /> Payment Settlement Distribution
            </h3>
            <span className="badge badge-demo">DEMO PROVIDER</span>
          </div>
          <div className="card-body" style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentStatusDistribution} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {paymentStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Incidents Queue */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <AlertTriangle size={18} color="var(--status-warning)" /> Active Investigation Queue
            </h3>
            <span className="page-subtitle" style={{ fontSize: '0.82rem' }}>
              Incidents automatically flagged by the rule evaluation engine
            </span>
          </div>
          <Link to="/incidents" className="btn btn-secondary btn-sm">
            View All Incidents <ArrowRight size={14} />
          </Link>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {recentIncidents?.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No incidents reported. All orders and payments are currently balanced.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem', padding: '1.25rem' }}>
              {recentIncidents.map((incident) => (
                <IncidentCard key={incident._id} incident={incident} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
