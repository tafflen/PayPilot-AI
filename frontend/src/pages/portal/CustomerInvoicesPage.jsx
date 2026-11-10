import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTable } from '../../components/common/DataTable';

export function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // PayPal checkout state
  const [initiatingOrderId, setInitiatingOrderId] = useState(null);
  const [paypalFeedback, setPaypalFeedback] = useState(null);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.orders.list(params);
      setInvoices(res.data?.orders || []);
    } catch (err) {
      console.error('Failed to fetch customer invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  // Handle return redirect from PayPal Sandbox
  useEffect(() => {
    const isSuccess = searchParams.get('paypal_success') === 'true';
    const isCancelled = searchParams.get('paypal_cancelled') === 'true';
    const token = searchParams.get('token');
    const orderRef = searchParams.get('orderRef');

    if (isSuccess && token) {
      setPaypalFeedback({
        type: 'processing',
        message: `Finalizing PayPal Sandbox payment for invoice ${orderRef || token}... Capturing transaction.`,
      });

      setSearchParams({}, { replace: true });

      api.paypal
        .captureOrder({ paypalOrderId: token, orderRef })
        .then((res) => {
          const capRef = res.data?.payment?.transactionRef || token;
          setPaypalFeedback({
            type: 'success',
            message: `PayPal Sandbox payment of ${formatCurrency(res.data.payment.amount, res.data.payment.currency)} captured successfully! Transaction ref: ${capRef}`,
          });
          fetchInvoices();
        })
        .catch((err) => {
          setPaypalFeedback({
            type: 'error',
            message: `PayPal payment capture failed: ${err.message}`,
          });
        });
    } else if (isCancelled) {
      setPaypalFeedback({
        type: 'warning',
        message: `Payment checkout was cancelled in PayPal Sandbox for ${orderRef || 'this invoice'}.`,
      });
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handlePayNow = async (invoice) => {
    if (!invoice) return;
    setInitiatingOrderId(invoice._id);
    setPaypalFeedback(null);

    try {
      const res = await api.paypal.createOrder({
        orderId: invoice._id,
        orderRef: invoice.orderRef,
      });

      if (res.data?.approvalUrl) {
        window.location.href = res.data.approvalUrl;
      } else {
        throw new Error('PayPal did not provide an approval checkout URL.');
      }
    } catch (err) {
      setPaypalFeedback({
        type: 'error',
        message: `Could not initiate PayPal Sandbox payment: ${err.message}`,
      });
      setInitiatingOrderId(null);
    }
  };

  const columns = [
    {
      header: 'Invoice #',
      key: 'invoiceRef',
      render: (inv) => (
        <span className="font-mono text-teal" style={{ fontWeight: 600 }}>
          {inv.invoiceRef || inv.orderRef}
        </span>
      ),
    },
    {
      header: 'Billed By',
      key: 'billedBy',
      render: () => (
        <div>
          <div style={{ fontWeight: 500 }}>Acme Cloud Services Ltd</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PayPilot Merchant</div>
        </div>
      ),
    },
    {
      header: 'Description',
      key: 'description',
      render: (inv) => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {inv.description}
        </span>
      ),
    },
    {
      header: 'Amount Due',
      key: 'expectedAmount',
      render: (inv) => (
        <span className="font-mono" style={{ fontWeight: 700 }}>
          {formatCurrency(inv.expectedAmount, inv.currency)}
        </span>
      ),
    },
    {
      header: 'Due Date',
      key: 'dueDate',
      render: (inv) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {inv.dueDate ? formatDateTime(inv.dueDate).split(' ')[0] : 'Upon Receipt'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      render: (inv) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedInvoice(inv)}
            title="View Invoice Details"
          >
            <Eye size={13} /> View
          </button>
          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <button
              className="btn btn-primary btn-sm"
              disabled={initiatingOrderId === inv._id}
              onClick={() => handlePayNow(inv)}
              title="Pay Now via PayPal Sandbox"
            >
              {initiatingOrderId === inv._id ? (
                <>
                  <Loader2 size={13} className="spin" /> Opening PayPal...
                </>
              ) : (
                <>
                  <CreditCard size={13} /> Pay Now
                </>
              )}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="portal-invoices-page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-title-group">
          <h1>
            <FileText size={24} color="var(--accent-teal)" /> My Invoices
          </h1>
          <p className="page-subtitle">
            View billed statements, check settlement statuses, and complete payments via PayPal Sandbox
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchInvoices}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* PayPal Feedback Banner */}
      {paypalFeedback && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            backgroundColor:
              paypalFeedback.type === 'success'
                ? 'var(--status-success-bg)'
                : paypalFeedback.type === 'warning'
                ? 'var(--status-warning-bg)'
                : paypalFeedback.type === 'error'
                ? 'var(--status-danger-bg)'
                : 'rgba(6, 182, 212, 0.15)',
            border: `1px solid ${
              paypalFeedback.type === 'success'
                ? 'var(--status-success-border)'
                : paypalFeedback.type === 'warning'
                ? 'var(--status-warning-border)'
                : paypalFeedback.type === 'error'
                ? 'var(--status-danger-border)'
                : 'var(--border-focus)'
            }`,
            color:
              paypalFeedback.type === 'success'
                ? 'var(--status-success)'
                : paypalFeedback.type === 'warning'
                ? 'var(--status-warning)'
                : paypalFeedback.type === 'error'
                ? 'var(--status-danger)'
                : 'var(--accent-teal)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {paypalFeedback.type === 'processing' && <Loader2 size={18} className="spin" />}
            {paypalFeedback.type === 'success' && <CheckCircle2 size={18} />}
            {paypalFeedback.type === 'warning' && <AlertTriangle size={18} />}
            {paypalFeedback.type === 'error' && <XCircle size={18} />}
            <span>{paypalFeedback.message}</span>
          </div>
          <button
            className="btn-ghost"
            style={{ border: 'none', color: 'inherit', padding: '0.2rem', cursor: 'pointer', fontSize: '1.2rem', background: 'none' }}
            onClick={() => setPaypalFeedback(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          className={`btn btn-sm ${statusFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('')}
        >
          All Invoices
        </button>
        <button
          className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('pending')}
        >
          Outstanding / Unpaid
        </button>
        <button
          className={`btn btn-sm ${statusFilter === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('paid')}
        >
          Paid Invoices
        </button>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        emptyTitle="No invoices found"
        emptyDescription="There are no billing records matching your filter."
      />

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="font-mono text-teal">Invoice {selectedInvoice.invoiceRef || selectedInvoice.orderRef}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Acme Cloud Services Ltd &bull; Issued to {selectedInvoice.customerName}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedInvoice(null)} style={{ border: 'none', fontSize: '1.2rem' }}>
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL AMOUNT</div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-teal)' }}>
                    {formatCurrency(selectedInvoice.expectedAmount, selectedInvoice.currency)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STATUS</div>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DUE DATE</div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {selectedInvoice.dueDate ? formatDateTime(selectedInvoice.dueDate).split(' ')[0] : 'Due Upon Receipt'}
                  </div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Line Items
                </h4>
                {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedInvoice.items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span>{it.description}</span>
                        <span className="font-mono" style={{ fontWeight: 600 }}>
                          {formatCurrency(it.amount || it.unitPrice, selectedInvoice.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {selectedInvoice.description}
                  </div>
                )}
              </div>

              {/* PayPal Sandbox Payment Action */}
              {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-focus)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>PayPal Sandbox Checkout</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Log in with your Sandbox Personal Account to approve payment.
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={initiatingOrderId === selectedInvoice._id}
                    onClick={() => handlePayNow(selectedInvoice)}
                  >
                    {initiatingOrderId === selectedInvoice._id ? (
                      <>
                        <Loader2 size={14} className="spin" /> Opening PayPal...
                      </>
                    ) : (
                      <>
                        <ExternalLink size={14} /> Pay with PayPal
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={18} />
                  <span>This invoice has been settled in full. Thank you for your payment!</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
