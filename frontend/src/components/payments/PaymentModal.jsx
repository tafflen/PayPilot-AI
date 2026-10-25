import React, { useState, useEffect } from 'react';
import { X, Receipt, Info } from 'lucide-react';
import { FormField } from '../common/FormField';
import { api } from '../../services/api';

export function PaymentModal({ isOpen, onClose, onSuccess, initialOrderRef = '' }) {
  const [formData, setFormData] = useState({
    transactionRef: '',
    orderRef: '',
    amount: '',
    currency: 'USD',
    status: 'captured',
    isBackdatedPending: false,
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setFormData({
        transactionRef: `TXN-DEMO-${randomSuffix}`,
        orderRef: initialOrderRef || '',
        amount: '',
        currency: 'USD',
        status: 'captured',
        isBackdatedPending: false,
      });
      setError(null);
    }
  }, [isOpen, initialOrderRef]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setError('A valid payment amount greater than 0 is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // If user checked backdated pending, backdate recordedAt by 36 hours to trigger stale rule
      const recordedAt = formData.isBackdatedPending && formData.status === 'pending'
        ? new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString();

      await api.payments.createDemo({
        transactionRef: formData.transactionRef,
        orderRef: formData.orderRef,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        status: formData.status,
        recordedAt,
        metadata: {
          note: 'Created manually in PayPilot AI Demo Studio',
          testBackdated: formData.isBackdatedPending,
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to register demo payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Receipt size={20} color="var(--accent-teal)" />
            <h3>Demo Payment Record Studio</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ border: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Demo provider notice */}
            <div
              style={{
                display: 'flex',
                gap: '0.65rem',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                color: '#38bdf8',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                lineHeight: '1.4',
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Sandbox / Sample Data Studio:</strong> Registering payments here simulates incoming gateway records (DEMO provider) to evaluate reconciliation rules.
              </div>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  color: 'var(--status-danger)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Transaction Reference" required={true}>
                <input
                  type="text"
                  name="transactionRef"
                  className="form-input font-mono"
                  value={formData.transactionRef}
                  onChange={handleChange}
                  required
                />
              </FormField>

              <FormField
                label="Target Order Reference"
                helpText="Leave empty to test Unlinked Payment rule"
              >
                <input
                  type="text"
                  name="orderRef"
                  className="form-input font-mono"
                  placeholder="e.g. ORD-DEMO-001"
                  value={formData.orderRef}
                  onChange={handleChange}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
              <FormField label="Amount" required={true}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="amount"
                  className="form-input font-mono"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                />
              </FormField>

              <FormField label="Currency">
                <select
                  name="currency"
                  className="form-select font-mono"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  name="status"
                  className="form-select font-mono"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="captured">Captured</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </FormField>
            </div>

            {formData.status === 'pending' && (
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    name="isBackdatedPending"
                    checked={formData.isBackdatedPending}
                    onChange={handleChange}
                  />
                  <span>Backdate timestamp by 36 hours (Test Stale Pending Payment rule)</span>
                </label>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Demo Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
