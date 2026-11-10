import React, { useState, useEffect } from 'react';
import { RotateCcw, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTable } from '../../components/common/DataTable';

export function CustomerRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRefunds = async () => {
    setIsLoading(true);
    try {
      const res = await api.refunds.list();
      setRefunds(res.data?.refunds || []);
    } catch (err) {
      console.error('Failed to load refunds:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const columns = [
    {
      header: 'Refund Ref',
      key: 'refundRef',
      render: (r) => (
        <span className="font-mono text-teal" style={{ fontWeight: 600 }}>
          {r.refundRef}
        </span>
      ),
    },
    {
      header: 'Original Transaction',
      key: 'originalTransactionRef',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: '0.85rem' }}>
          {r.originalTransactionRef}
        </span>
      ),
    },
    {
      header: 'Associated Invoice',
      key: 'orderRef',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: '0.85rem' }}>
          {r.orderRef || '—'}
        </span>
      ),
    },
    {
      header: 'Refund Amount',
      key: 'amount',
      render: (r) => (
        <span className="font-mono" style={{ fontWeight: 700, color: 'var(--status-info)' }}>
          {formatCurrency(r.amount, r.currency)}
        </span>
      ),
    },
    {
      header: 'Reason / Notes',
      key: 'reason',
      render: (r) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {r.reason || 'Duplicate payment reimbursement'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Processed At',
      key: 'createdAt',
      render: (r) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="portal-refunds-page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-title-group">
          <h1>
            <RotateCcw size={24} color="var(--accent-teal)" /> My Refunds
          </h1>
          <p className="page-subtitle">
            Track authorized refund payments, reimbursement statuses, and original transaction references
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchRefunds}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <DataTable
        columns={columns}
        data={refunds}
        isLoading={isLoading}
        emptyTitle="No refunds recorded"
        emptyDescription="Any reimbursement or duplicate payment adjustments credited to your account will be displayed here."
      />
    </div>
  );
}
