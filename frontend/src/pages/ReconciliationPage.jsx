import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function ReconciliationPage() {
  const [isReconciling, setIsReconciling] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.reconciliation.getHistory();
      setHistory(res.data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRunReconciliation = async () => {
    setIsReconciling(true);
    setError(null);
    try {
      const res = await api.reconciliation.trigger();
      setLatestResult(res.data);
      loadHistory();
    } catch (err) {
      setError(err.message || 'Reconciliation execution failed.');
    } finally {
      setIsReconciling(false);
    }
  };

  const historyColumns = [
    {
      header: 'Run Timestamp',
      key: 'timestamp',
      render: (h) => (
        <span style={{ fontSize: '0.85rem' }}>{formatDateTime(h.timestamp)}</span>
      ),
    },
    {
      header: 'Actor',
      key: 'actor',
      render: (h) => (
        <span className="font-mono" style={{ fontSize: '0.82rem' }}>
          {h.actor}
        </span>
      ),
    },
    {
      header: 'Orders Checked',
      key: 'details',
      render: (h) => h.details?.totalOrders ?? '—',
    },
    {
      header: 'Payments Checked',
      key: 'details',
      render: (h) => h.details?.totalPayments ?? '—',
    },
    {
      header: 'Matched',
      key: 'details',
      render: (h) => (
        <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>
          {h.details?.matchedCount ?? 0}
        </span>
      ),
    },
    {
      header: 'Discrepancies',
      key: 'details',
      render: (h) => (
        <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
          {h.details?.discrepanciesDetected ?? 0}
        </span>
      ),
    },
    {
      header: 'New Incidents',
      key: 'details',
      render: (h) => (
        <span style={{ color: 'var(--status-danger)', fontWeight: 600 }}>
          {h.details?.createdIncidentsCount ?? 0}
        </span>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <RefreshCw size={24} color="var(--accent-teal)" /> Reconciliation Engine Studio
          </h1>
          <p className="page-subtitle">
            Deterministic rule-based matching between order receivables and payment settlements
          </p>
        </div>
        <div>
          <button
            className="btn btn-primary"
            onClick={handleRunReconciliation}
            disabled={isReconciling}
          >
            {isReconciling ? (
              <>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Executing Engine Rules...
              </>
            ) : (
              <>
                <Play size={16} /> Run Full Reconciliation
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={handleRunReconciliation} />}

      {/* Engine Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)', fontWeight: 700, marginBottom: '0.4rem' }}>
            <ShieldCheck size={18} /> Deterministic Rules
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
            9 rules evaluated across integer minor currency units, duplicate transaction hashes, stale pending timestamps, and unlinked payment identifiers.
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', fontWeight: 700, marginBottom: '0.4rem' }}>
            <CheckCircle2 size={18} /> Idempotent Execution
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
            Running reconciliation repeatedly will never duplicate open investigation tickets. Existing incidents maintain active analyst notes and status.
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 700, marginBottom: '0.4rem' }}>
            <Info size={18} /> Non-Destructive
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
            The engine flags anomalies for human analyst verification. It never initiates automatic bank refunds or fabricates missing records.
          </p>
        </div>
      </div>

      {/* Latest Run Results Banner */}
      {latestResult && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            marginBottom: '2rem',
            borderLeft: '5px solid var(--accent-teal)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={20} color="var(--accent-teal)" /> Latest Run Results
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Completed at {formatDateTime(latestResult.timestamp)}
            </span>
          </div>

          <div className="grid-cols-4" style={{ marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ORDERS EVALUATED</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {latestResult.totalOrders}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PAYMENTS EVALUATED</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {latestResult.totalPayments}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>MATCHED RECORDS</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--status-success)' }}>
                {latestResult.matchedCount}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)' }}>DISCREPANCIES DETECTED</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--status-warning)' }}>
                {latestResult.discrepancyCount}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/incidents')}>
              Navigate to Investigation Queue <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Reconciliation Audit Log History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <History size={18} color="var(--accent-teal)" /> Reconciliation Run Audit Trail
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={loadHistory}>
            <RefreshCw size={13} /> Refresh Trail
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <DataTable
            columns={historyColumns}
            data={history}
            isLoading={isLoadingHistory}
            emptyTitle="No previous reconciliation runs recorded"
            emptyDescription="Click 'Run Full Reconciliation' above to start your first run."
          />
        </div>
      </div>
    </div>
  );
}
