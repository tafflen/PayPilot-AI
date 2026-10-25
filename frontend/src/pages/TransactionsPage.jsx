import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, Plus, RefreshCw, Eye } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchAndFilters } from '../components/common/SearchAndFilters';
import { PaymentModal } from '../components/payments/PaymentModal';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function TransactionsPage() {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;

      const res = await api.payments.list(params);
      setPayments(res.data.payments || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, status]);

  const columns = [
    {
      header: 'Transaction Ref',
      key: 'transactionRef',
      render: (p) => (
        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {p.transactionRef}
        </span>
      ),
    },
    {
      header: 'Linked Order',
      key: 'orderRef',
      render: (p) =>
        p.orderRef ? (
          <span className="font-mono text-teal">{p.orderRef}</span>
        ) : (
          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
            Unlinked
          </span>
        ),
    },
    {
      header: 'Amount',
      key: 'amount',
      render: (p) => (
        <span className="font-mono" style={{ fontWeight: 600 }}>
          {formatCurrency(p.amount, p.currency)}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      header: 'Provider',
      key: 'provider',
      render: (p) => (
        <span className="badge badge-demo">
          {p.provider} (Sample)
        </span>
      ),
    },
    {
      header: 'Recorded At',
      key: 'recordedAt',
      render: (p) => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {formatDateTime(p.recordedAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPayment(p);
          }}
        >
          <Eye size={13} /> View Raw
        </button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Receipt size={24} color="var(--accent-teal)" /> Payment Transactions Ledger
          </h1>
          <p className="page-subtitle">
            Ingested payment provider events, settlement records, and status reports (Demo Sandbox)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchPayments}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={14} /> Register Demo Payment
          </button>
        </div>
      </div>

      <SearchAndFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by transaction or order ref..."
        filters={[
          {
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'captured', label: 'Captured' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'refunded', label: 'Refunded' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        data={payments}
        isLoading={isLoading}
        emptyTitle="No payment records found"
        emptyDescription="Create a demo payment above to simulate incoming gateway webhooks."
      />

      {/* Raw Payload Modal */}
      {selectedPayment && (
        <div className="modal-backdrop" onClick={() => setSelectedPayment(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction Details: {selectedPayment.transactionRef}</h3>
              <button className="btn-ghost" onClick={() => setSelectedPayment(null)} style={{ border: 'none' }}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <StatusBadge status={selectedPayment.status} />
                <span className="badge badge-demo">Sample Data</span>
              </div>
              <pre className="font-mono" style={{ backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', overflowX: 'auto', fontSize: '0.85rem' }}>
                {JSON.stringify(selectedPayment, null, 2)}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedPayment(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo payment modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPayments}
      />
    </div>
  );
}
