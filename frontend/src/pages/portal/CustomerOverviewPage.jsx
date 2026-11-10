import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  LifeBuoy,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';

export function CustomerOverviewPage() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCustomerData() {
      setIsLoading(true);
      try {
        const [ordersRes, paymentsRes, refundsRes, ticketsRes] = await Promise.all([
          api.orders.list({ limit: 10 }),
          api.payments.list({ limit: 5 }),
          api.refunds.list({ limit: 5 }),
          api.support.listTickets({ limit: 5 }),
        ]);

        setInvoices(ordersRes.data?.orders || []);
        setPayments(paymentsRes.data?.payments || []);
        setRefunds(refundsRes.data?.refunds || []);
        setTickets(ticketsRes.data?.tickets || []);
      } catch (err) {
        console.error('Failed to load customer dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomerData();
  }, []);

  // Compute summary stats
  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + (i.expectedAmount || 0), 0);

  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const totalPaid = paidInvoices.reduce((sum, i) => sum + (i.expectedAmount || 0), 0);

  const pendingPayments = payments.filter((p) => p.status === 'pending');

  return (
    <div className="portal-overview-container">
      {/* Welcome Banner */}
      <div className="portal-welcome-banner">
        <div>
          <h2>Account & Invoices Overview</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.2rem' }}>
            Review outstanding billing invoices, check payment records, and pay securely via PayPal Sandbox.
          </p>
        </div>
        {unpaidInvoices.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/portal/invoices?status=pending')}
          >
            Pay Outstanding Invoices ({unpaidInvoices.length}) <ArrowRight size={15} />
          </button>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">TOTAL OUTSTANDING</span>
            <AlertCircle size={18} color="var(--status-warning)" />
          </div>
          <div className="metric-value font-mono" style={{ color: 'var(--status-warning)' }}>
            {formatCurrency(totalOutstanding, 'USD')}
          </div>
          <div className="metric-sub">
            {unpaidInvoices.length} unpaid {unpaidInvoices.length === 1 ? 'invoice' : 'invoices'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">TOTAL PAID</span>
            <CheckCircle2 size={18} color="var(--status-success)" />
          </div>
          <div className="metric-value font-mono" style={{ color: 'var(--status-success)' }}>
            {formatCurrency(totalPaid, 'USD')}
          </div>
          <div className="metric-sub">
            {paidInvoices.length} settled {paidInvoices.length === 1 ? 'invoice' : 'invoices'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">PAYMENTS RECORDED</span>
            <CreditCard size={18} color="var(--accent-teal)" />
          </div>
          <div className="metric-value font-mono">
            {payments.length}
          </div>
          <div className="metric-sub">
            {pendingPayments.length} pending clearance
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">REFUNDS & ISSUES</span>
            <RotateCcw size={18} color="#38bdf8" />
          </div>
          <div className="metric-value font-mono">
            {refunds.length}
          </div>
          <div className="metric-sub">
            {tickets.filter((t) => t.status !== 'resolved').length} open support inquiries
          </div>
        </div>
      </div>

      {/* Main Grid: Invoices & Recent Activity */}
      <div className="grid-cols-2">
        {/* Outstanding & Recent Invoices */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <FileText size={18} color="var(--accent-teal)" /> Recent Invoices
            </h3>
            <Link to="/portal/invoices" className="btn-link" style={{ fontSize: '0.85rem' }}>
              View All Invoices &rarr;
            </Link>
          </div>

          {isLoading ? (
            <p style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No invoices billed to your account yet.
            </div>
          ) : (
            <div className="portal-invoices-list">
              {invoices.slice(0, 4).map((inv) => (
                <div key={inv._id} className="portal-invoice-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                      <span className="font-mono text-teal">{inv.invoiceRef || inv.orderRef}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {inv.description}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 700 }}>
                      {formatCurrency(inv.expectedAmount, inv.currency)}
                    </div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payment & Refund Activity */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <CreditCard size={18} color="var(--status-success)" /> Recent Payment Activity
            </h3>
            <Link to="/portal/transactions" className="btn-link" style={{ fontSize: '0.85rem' }}>
              View History &rarr;
            </Link>
          </div>

          {isLoading ? (
            <p style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Loading payments...</p>
          ) : payments.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Zero transactions completed yet.
            </div>
          ) : (
            <div className="portal-invoices-list">
              {payments.slice(0, 4).map((p) => (
                <div key={p._id} className="portal-invoice-row">
                  <div>
                    <div className="font-mono" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {p.transactionRef}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(p.recordedAt)} &bull; {p.provider}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                      {formatCurrency(p.amount, p.currency)}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .portal-welcome-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.5rem 2rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .portal-invoices-list {
          display: flex;
          flex-direction: column;
        }

        .portal-invoice-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          transition: background-color var(--transition-fast);
        }

        .portal-invoice-row:last-child {
          border-bottom: none;
        }

        .portal-invoice-row:hover {
          background-color: var(--bg-surface-hover);
        }
      `}</style>
    </div>
  );
}
