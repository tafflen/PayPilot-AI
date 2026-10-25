import React from 'react';
import {
  HelpCircle,
  AlertTriangle,
  FileText,
  Search,
  CheckCircle2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export function EvidenceViewer({ incident, linkedOrder, linkedPayment }) {
  if (!incident) return null;

  const { evidence, triggeredRule, incidentType, status, resolutionNote, resolvedBy, resolvedAt } = incident;

  return (
    <div className="investigation-evidence-deck">
      {/* Question 1: What was expected for this order? */}
      <div className="evidence-section-card">
        <div className="section-title">
          <DollarSign size={18} color="var(--accent-teal)" />
          <h4>1. What was expected for this order?</h4>
        </div>
        <div className="section-body">
          {linkedOrder ? (
            <div className="key-val-grid">
              <div>
                <span className="label">Order Reference:</span>
                <span className="value font-mono">{linkedOrder.orderRef}</span>
              </div>
              <div>
                <span className="label">Customer:</span>
                <span className="value">{linkedOrder.customerName}</span>
              </div>
              <div>
                <span className="label">Expected Amount:</span>
                <span className="value font-mono" style={{ color: 'var(--accent-teal)' }}>
                  {formatCurrency(linkedOrder.expectedAmount, linkedOrder.currency)}
                </span>
              </div>
              <div>
                <span className="label">Order Status:</span>
                <span className="value font-mono">{linkedOrder.status}</span>
              </div>
            </div>
          ) : incident.expectedAmount !== null && incident.expectedAmount !== undefined ? (
            <p className="fallback-text">
              Expected <strong className="font-mono">{formatCurrency(incident.expectedAmount, incident.currency)}</strong> based on recorded invoice reference.
            </p>
          ) : (
            <p className="empty-text">No order reference was supplied in payment records (Unlinked payment).</p>
          )}
        </div>
      </div>

      {/* Question 2: What does the stored payment record say? */}
      <div className="evidence-section-card">
        <div className="section-title">
          <FileText size={18} color="var(--accent-teal)" />
          <h4>2. What does the stored payment record say?</h4>
        </div>
        <div className="section-body">
          {linkedPayment ? (
            <div className="key-val-grid">
              <div>
                <span className="label">Transaction Reference:</span>
                <span className="value font-mono">{linkedPayment.transactionRef}</span>
              </div>
              <div>
                <span className="label">Captured Amount:</span>
                <span className="value font-mono" style={{ color: linkedPayment.status === 'captured' ? 'var(--status-success)' : 'var(--status-warning)' }}>
                  {formatCurrency(linkedPayment.amount, linkedPayment.currency)}
                </span>
              </div>
              <div>
                <span className="label">Payment Status:</span>
                <span className="value font-mono">{linkedPayment.status}</span>
              </div>
              <div>
                <span className="label">Provider / Gateway:</span>
                <span className="value font-mono">
                  {linkedPayment.provider} {linkedPayment.isDemo && '(Sample Data)'}
                </span>
              </div>
              <div>
                <span className="label">Timestamp Recorded:</span>
                <span className="value">{formatDateTime(linkedPayment.recordedAt)}</span>
              </div>
            </div>
          ) : incident.recordedAmount !== null && incident.recordedAmount !== undefined ? (
            <p className="fallback-text">
              Transaction logged captured amount of <strong className="font-mono">{formatCurrency(incident.recordedAmount, incident.currency)}</strong>.
            </p>
          ) : (
            <p className="empty-text">Zero payments have been recorded for this order (Unpaid order).</p>
          )}
        </div>
      </div>

      {/* Question 3: What discrepancy was detected? */}
      <div className="evidence-section-card warning-border">
        <div className="section-title">
          <AlertTriangle size={18} color="var(--status-warning)" />
          <h4>3. What discrepancy was detected?</h4>
        </div>
        <div className="section-body">
          <div className="discrepancy-banner">
            <span className="discrepancy-type">{incidentType.replace(/_/g, ' ')}</span>
            <span className="rule-tag font-mono">Rule: {triggeredRule}</span>
          </div>
          <p className="explanation-paragraph">{evidence?.explanation || 'No detailed explanation provided.'}</p>
        </div>
      </div>

      {/* Question 4: What evidence is available? */}
      <div className="evidence-section-card">
        <div className="section-title">
          <Search size={18} color="var(--accent-teal)" />
          <h4>4. What evidence is available?</h4>
        </div>
        <div className="section-body">
          <div className="evidence-details-box">
            <pre className="font-mono json-snippet">
              {JSON.stringify(evidence?.details || evidence || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Question 5: What should the user investigate next? */}
      <div className="evidence-section-card">
        <div className="section-title">
          <HelpCircle size={18} color="var(--accent-teal)" />
          <h4>5. What should the user investigate next?</h4>
        </div>
        <div className="section-body">
          <div className="suggested-action-box">
            <div className="action-step">
              <ArrowRight size={16} color="var(--accent-teal)" />
              <span>{evidence?.suggestedAction || 'Review gateway ledger and compare with order billing details.'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question 6: Has the incident been resolved, and what action resolved it? */}
      <div className={`evidence-section-card ${status === 'resolved' ? 'success-border' : ''}`}>
        <div className="section-title">
          <CheckCircle2 size={18} color={status === 'resolved' ? 'var(--status-success)' : 'var(--text-muted)'} />
          <h4>6. Has the incident been resolved, and what action resolved it?</h4>
        </div>
        <div className="section-body">
          {status === 'resolved' ? (
            <div className="resolution-box">
              <div className="res-meta">
                <span>Resolved by <strong>{resolvedBy || 'Analyst'}</strong> on {formatDateTime(resolvedAt)}</span>
              </div>
              <p className="res-text">&ldquo;{resolutionNote}&rdquo;</p>
            </div>
          ) : (
            <p className="empty-text">
              Status is currently <strong className="font-mono" style={{ textTransform: 'uppercase' }}>{status}</strong>. This incident has not yet been resolved.
            </p>
          )}
        </div>
      </div>

      <style>{`
        .investigation-evidence-deck {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .evidence-section-card {
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.5rem;
        }

        .evidence-section-card.warning-border {
          border-left: 4px solid var(--status-warning);
        }

        .evidence-section-card.success-border {
          border-left: 4px solid var(--status-success);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-bottom: 0.85rem;
        }

        .section-title h4 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .key-val-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .key-val-grid .label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.2rem;
        }

        .key-val-grid .value {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .discrepancy-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .discrepancy-type {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--status-warning);
          background-color: var(--status-warning-bg);
          padding: 0.25rem 0.65rem;
          border-radius: var(--radius-sm);
        }

        .rule-tag {
          font-size: 0.78rem;
          color: var(--text-muted);
          background-color: var(--bg-surface-elevated);
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-strong);
        }

        .explanation-paragraph {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .json-snippet {
          background-color: var(--bg-input);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          font-size: 0.82rem;
          color: var(--text-primary);
          overflow-x: auto;
          max-height: 220px;
        }

        .suggested-action-box {
          background-color: var(--bg-surface-elevated);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-md);
          padding: 1rem;
        }

        .action-step {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.92rem;
          color: var(--text-primary);
          line-height: 1.45;
        }

        .resolution-box {
          background-color: var(--status-success-bg);
          border: 1px solid var(--status-success-border);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
        }

        .res-meta {
          font-size: 0.8rem;
          color: var(--status-success);
          margin-bottom: 0.5rem;
        }

        .res-text {
          font-size: 0.95rem;
          color: var(--text-primary);
          font-style: italic;
          line-height: 1.45;
        }

        .fallback-text, .empty-text {
          font-size: 0.9rem;
          color: var(--text-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
