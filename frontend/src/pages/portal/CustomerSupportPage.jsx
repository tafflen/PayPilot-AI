import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  FileText,
  CreditCard,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

const ISSUE_TYPE_OPTIONS = [
  { value: 'DUPLICATE_CHARGE', label: 'Duplicate Charge / Double Payment' },
  { value: 'PAYMENT_NOT_REFLECTED', label: 'Paid but Invoice Still Shows Pending' },
  { value: 'INCORRECT_AMOUNT', label: 'Charged Amount Discrepancy' },
  { value: 'REFUND_INQUIRY', label: 'Refund Status Inquiry' },
  { value: 'OTHER', label: 'Other Billing or Payment Inquiry' },
];

export function CustomerSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Ticket creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const [formData, setFormData] = useState({
    subject: '',
    issueType: 'DUPLICATE_CHARGE',
    orderRef: '',
    transactionRef: '',
    message: '',
  });

  const fetchTickets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.support.listTickets(params);
      setTickets(res.data?.tickets || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve support tickets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const handleOpenModal = () => {
    setFormData({
      subject: '',
      issueType: 'DUPLICATE_CHARGE',
      orderRef: '',
      transactionRef: '',
      message: '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
      setFormError('Please provide both a subject and detailed description.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.support.createTicket({
        subject: formData.subject.trim(),
        issueType: formData.issueType,
        orderRef: formData.orderRef.trim(),
        transactionRef: formData.transactionRef.trim(),
        message: formData.message.trim(),
      });

      setFormSuccess('Your ticket has been submitted. The business administration team will review it.');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
        fetchTickets();
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to submit support request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--status-success)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            Resolved
          </span>
        );
      case 'in_review':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            In Review
          </span>
        );
      case 'open':
      default:
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--status-warning)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            Open
          </span>
        );
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.3rem 0' }}>
            Support & Billing Help
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
            Submit payment inquiries, report duplicate charges, or check resolution notes
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchTickets}
            title="Refresh tickets list"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenModal}
          >
            <Plus size={15} /> Report an Issue
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
        }}
      >
        {[
          { id: '', label: 'All Inquiries' },
          { id: 'open', label: 'Open' },
          { id: 'in_review', label: 'In Review' },
          { id: 'resolved', label: 'Resolved' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              fontWeight: 500,
              background: statusFilter === tab.id ? 'var(--bg-surface-elevated)' : 'transparent',
              color: statusFilter === tab.id ? 'var(--accent-teal)' : 'var(--text-secondary)',
              border: statusFilter === tab.id ? '1px solid var(--accent-teal)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <Clock size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
          <div>Loading support inquiries...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--status-danger-bg)',
            color: 'var(--status-danger)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3.5rem 1rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <LifeBuoy size={42} color="var(--accent-teal)" style={{ opacity: 0.7, marginBottom: '0.75rem' }} />
          <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>No Support Inquiries</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            Have a question about a payment or think you were charged twice? Submit a support request and our team will investigate promptly.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            <Plus size={15} /> Create Support Ticket
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tickets.map((t) => (
            <div
              key={t._id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <span className="font-mono text-teal" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {t.ticketRef}
                    </span>
                    {getStatusBadge(t.status)}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--bg-input)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {t.issueType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{t.subject}</h4>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Submitted {formatDateTime(t.createdAt)}
                </div>
              </div>

              {/* Order & Transaction tags if specified */}
              {(t.orderRef || t.transactionRef) && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {t.orderRef && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FileText size={13} /> Order Ref: <strong className="font-mono">{t.orderRef}</strong>
                    </span>
                  )}
                  {t.transactionRef && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CreditCard size={13} /> Transaction Ref: <strong className="font-mono">{t.transactionRef}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Message text */}
              <div
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-primary)',
                  lineHeight: '1.5',
                  backgroundColor: 'var(--bg-input)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {t.message}
              </div>

              {/* Admin response if available */}
              {t.adminNotes && (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.85rem',
                    backgroundColor: 'rgba(20, 184, 166, 0.08)',
                    borderLeft: '3px solid var(--accent-teal)',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--accent-teal)',
                      marginBottom: '0.3rem',
                    }}
                  >
                    <MessageSquare size={13} />
                    <span>Business Response</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {t.adminNotes}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ticket Submission Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LifeBuoy size={20} color="var(--accent-teal)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Report Payment Issue / Inquiry</h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                style={{ border: 'none', fontSize: '1.2rem', cursor: 'pointer', background: 'none' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {formError && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--status-danger-bg)',
                      color: 'var(--status-danger)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--status-success-bg)',
                      color: 'var(--status-success)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <CheckCircle2 size={16} /> {formSuccess}
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    Issue Category *
                  </label>
                  <select
                    className="form-select"
                    value={formData.issueType}
                    onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                    required
                  >
                    {ISSUE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    Subject *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Double charged for Order ORD-2026-004"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                      Order Ref (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="e.g. ORD-2026-001"
                      value={formData.orderRef}
                      onChange={(e) => setFormData({ ...formData, orderRef: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                      Transaction Ref (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="e.g. TXN-2026-001"
                      value={formData.transactionRef}
                      onChange={(e) => setFormData({ ...formData, transactionRef: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    Description & Details *
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Please describe what happened, transaction times, or any PayPal Sandbox confirmation numbers..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !formData.subject.trim() || !formData.message.trim()}
                >
                  {isSubmitting ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Send size={14} /> Submit Inquiry
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerSupportPage;
