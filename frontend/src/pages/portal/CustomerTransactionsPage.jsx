import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Receipt,
  Eye,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Building2,
  Printer,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTable } from '../../components/common/DataTable';

export function CustomerTransactionsPage() {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const res = await api.payments.list();
      setPayments(res.data?.payments || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const columns = [
    {
      header: 'Transaction Ref',
      key: 'transactionRef',
      render: (p) => (
        <span className="font-mono text-teal" style={{ fontWeight: 600 }}>
          {p.transactionRef}
        </span>
      ),
    },
    {
      header: 'Associated Invoice',
      key: 'orderRef',
      render: (p) => (
        <span className="font-mono" style={{ fontSize: '0.85rem' }}>
          {p.orderRef || '—'}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      key: 'amount',
      render: (p) => (
        <span className="font-mono" style={{ fontWeight: 700 }}>
          {formatCurrency(p.amount, p.currency)}
        </span>
      ),
    },
    {
      header: 'Method / Gateway',
      key: 'provider',
      render: (p) => (
        <span className="badge badge-imported" style={{ fontSize: '0.72rem' }}>
          {p.provider || 'PAYPAL'}
        </span>
      ),
    },
    {
      header: 'Payment Date',
      key: 'recordedAt',
      render: (p) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {formatDateTime(p.recordedAt)}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      header: 'Receipt',
      align: 'right',
      render: (p) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setSelectedReceipt(p)}
          title="View Official Payment Receipt"
        >
          <Receipt size={13} /> View Receipt
        </button>
      ),
    },
  ];

  return (
    <div className="portal-transactions-page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-title-group">
          <h1>
            <CreditCard size={24} color="var(--accent-teal)" /> My Transactions & Receipts
          </h1>
          <p className="page-subtitle">
            Complete settlement ledger and official transaction receipts for your account
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchPayments}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <DataTable
        columns={columns}
        data={payments}
        isLoading={isLoading}
        emptyTitle="No payment transactions found"
        emptyDescription="Completed payments made toward your invoices will appear here."
      />

      {/* Official Payment Receipt Modal */}
      {selectedReceipt && (
        <div className="modal-backdrop" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} color="var(--status-success)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Payment Receipt</h3>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedReceipt(null)} style={{ border: 'none', fontSize: '1.2rem' }}>
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount Paid</div>
                <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--status-success)', margin: '0.25rem 0' }}>
                  {formatCurrency(selectedReceipt.amount, selectedReceipt.currency)}
                </div>
                <StatusBadge status={selectedReceipt.status} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Merchant</span>
                  <strong>Acme Cloud Services Ltd</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Transaction Reference</span>
                  <span className="font-mono">{selectedReceipt.transactionRef}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Associated Invoice</span>
                  <span className="font-mono text-teal">{selectedReceipt.orderRef || 'Unlinked'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment Provider</span>
                  <span>{selectedReceipt.provider || 'PAYPAL'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment Date & Time</span>
                  <span>{formatDateTime(selectedReceipt.recordedAt)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                <Printer size={14} /> Print Receipt
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedReceipt(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
