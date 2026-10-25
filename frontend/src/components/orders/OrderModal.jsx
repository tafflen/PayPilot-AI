import React, { useState, useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { FormField } from '../common/FormField';
import { api } from '../../services/api';

export function OrderModal({ isOpen, order, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    orderRef: '',
    customerName: '',
    customerEmail: '',
    description: '',
    expectedAmount: '',
    currency: 'USD',
    status: 'pending',
    invoiceRef: '',
    notes: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        orderRef: order.orderRef || '',
        customerName: order.customerName || '',
        customerEmail: order.customerEmail || '',
        description: order.description || '',
        expectedAmount: order.expectedAmount ? (order.expectedAmount / 100).toFixed(2) : '',
        currency: order.currency || 'USD',
        status: order.status || 'pending',
        invoiceRef: order.invoiceRef || '',
        notes: order.notes || '',
      });
    } else {
      // Auto-generate fresh order reference
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setFormData({
        orderRef: `ORD-2026-${randomSuffix}`,
        customerName: '',
        customerEmail: '',
        description: '',
        expectedAmount: '',
        currency: 'USD',
        status: 'pending',
        invoiceRef: `INV-2026-${randomSuffix}`,
        notes: '',
      });
    }
    setError(null);
  }, [order, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!order;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.customerName.trim()) {
      setError('Customer name is required.');
      return;
    }

    if (!formData.description.trim()) {
      setError('Order description is required.');
      return;
    }

    if (!formData.expectedAmount || isNaN(Number(formData.expectedAmount)) || Number(formData.expectedAmount) <= 0) {
      setError('A valid expected amount greater than 0 is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await api.orders.update(order._id, {
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          description: formData.description,
          notes: formData.notes,
          status: formData.status,
          invoiceRef: formData.invoiceRef,
        });
      } else {
        await api.orders.create({
          ...formData,
          expectedAmount: parseFloat(formData.expectedAmount),
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save order record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ShoppingCart size={20} color="var(--accent-teal)" />
            <h3>{isEditing ? `Edit Order ${order.orderRef}` : 'Create New Order Record'}</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ border: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
              <FormField label="Order Reference" required={true}>
                <input
                  type="text"
                  name="orderRef"
                  className="form-input font-mono"
                  value={formData.orderRef}
                  onChange={handleChange}
                  disabled={isEditing}
                  required
                />
              </FormField>

              <FormField label="Invoice Reference">
                <input
                  type="text"
                  name="invoiceRef"
                  className="form-input font-mono"
                  placeholder="e.g. INV-2026-001"
                  value={formData.invoiceRef}
                  onChange={handleChange}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Customer Name" required={true}>
                <input
                  type="text"
                  name="customerName"
                  className="form-input"
                  placeholder="e.g. Acme Corp"
                  value={formData.customerName}
                  onChange={handleChange}
                  required
                />
              </FormField>

              <FormField label="Customer Email">
                <input
                  type="email"
                  name="customerEmail"
                  className="form-input"
                  placeholder="e.g. billing@acme.example"
                  value={formData.customerEmail}
                  onChange={handleChange}
                />
              </FormField>
            </div>

            <FormField label="Order Description" required={true}>
              <input
                type="text"
                name="description"
                className="form-input"
                placeholder="e.g. 12-Month SaaS Subscription"
                value={formData.description}
                onChange={handleChange}
                required
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
              <FormField label="Expected Amount" required={true} helpText="Major currency units (e.g. 120.50)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="expectedAmount"
                  className="form-input font-mono"
                  placeholder="0.00"
                  value={formData.expectedAmount}
                  onChange={handleChange}
                  disabled={isEditing}
                  required
                />
              </FormField>

              <FormField label="Currency">
                <select
                  name="currency"
                  className="form-select font-mono"
                  value={formData.currency}
                  onChange={handleChange}
                  disabled={isEditing}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </FormField>

              <FormField label="Order Status">
                <select
                  name="status"
                  className="form-select font-mono"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </FormField>
            </div>

            <FormField label="Internal Notes">
              <textarea
                name="notes"
                className="form-textarea"
                rows={2}
                placeholder="Optional notes or contractual references"
                value={formData.notes}
                onChange={handleChange}
              />
            </FormField>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
