import React, { useState } from 'react';
import { X, CheckCircle, Clock } from 'lucide-react';
import { FormField } from '../common/FormField';

export function ResolutionModal({
  isOpen,
  incident,
  currentStatus,
  targetStatus,
  onClose,
  onSubmit,
}) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !incident) return null;

  const isResolving = targetStatus === 'resolved';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isResolving && (!resolutionNote || !resolutionNote.trim())) {
      setError('A resolution note is required to mark an incident as resolved.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(targetStatus, resolutionNote);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update incident status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {isResolving ? (
              <CheckCircle size={20} color="var(--status-success)" />
            ) : (
              <Clock size={20} color="var(--status-warning)" />
            )}
            <h3>
              {isResolving
                ? `Resolve Incident ${incident.incidentRef}`
                : `Move Incident to ${targetStatus}`}
            </h3>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ border: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Transitioning incident from{' '}
              <strong className="font-mono text-teal">{currentStatus}</strong> &rarr;{' '}
              <strong className="font-mono text-teal">{targetStatus}</strong>.
            </div>

            {isResolving ? (
              <FormField
                label="Resolution Summary & Root Cause"
                required={true}
                error={error}
                helpText="Explain how this discrepancy was verified, whether payment was recaptured, manual adjustment completed, or billing clarified."
              >
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g. Customer provided supplementary wire transfer proof; ledger balanced with credit memo."
                  value={resolutionNote}
                  onChange={(e) => {
                    setResolutionNote(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </FormField>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                This will move the incident into active investigation state so other analysts know you are reviewing it.
              </p>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${isResolving ? 'btn-primary' : 'btn-secondary'}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : isResolving ? 'Confirm Resolution' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
