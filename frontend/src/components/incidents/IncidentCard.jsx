import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export function IncidentCard({ incident }) {
  if (!incident) return null;

  return (
    <div className={`incident-card-item severity-${incident.severity}`}>
      <div className="incident-card-top">
        <div className="ref-and-status">
          <span className="incident-ref font-mono">{incident.incidentRef}</span>
          <StatusBadge status={incident.status} />
          <StatusBadge status={incident.severity} type="severity" />
        </div>
        <span className="incident-time">
          <Clock size={12} /> {formatDateTime(incident.createdAt)}
        </span>
      </div>

      <div className="incident-type-header">
        <AlertCircle size={15} color="var(--status-warning)" />
        <span className="type-label">{incident.incidentType.replace(/_/g, ' ')}</span>
      </div>

      <p className="incident-explanation">
        {incident.evidence?.explanation || 'Discrepancy flagged by reconciliation engine.'}
      </p>

      <div className="incident-card-bottom">
        <div className="linked-references font-mono">
          {incident.orderRef && <span>Ord: {incident.orderRef}</span>}
          {incident.transactionRef && <span>Txn: {incident.transactionRef}</span>}
          {incident.expectedAmount !== null && (
            <span>Exp: {formatCurrency(incident.expectedAmount, incident.currency)}</span>
          )}
        </div>

        <Link to={`/incidents/${incident.incidentRef || incident._id}`} className="view-detail-link">
          Investigate <ChevronRight size={14} />
        </Link>
      </div>

      <style>{`
        .incident-card-item {
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1.15rem 1.35rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          transition: transform var(--transition-fast), border-color var(--transition-fast);
          position: relative;
          overflow: hidden;
        }

        .incident-card-item:hover {
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }

        .incident-card-item.severity-critical {
          border-left: 4px solid var(--status-danger);
        }

        .incident-card-item.severity-high {
          border-left: 4px solid #f97316;
        }

        .incident-card-item.severity-medium {
          border-left: 4px solid var(--status-warning);
        }

        .incident-card-item.severity-low {
          border-left: 4px solid var(--status-info);
        }

        .incident-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .ref-and-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .incident-ref {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 0.95rem;
        }

        .incident-time {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .incident-type-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .type-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .incident-explanation {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .incident-card-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 0.65rem;
          border-top: 1px solid var(--border-subtle);
          margin-top: 0.25rem;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .linked-references {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          flex-wrap: wrap;
        }

        .view-detail-link {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--accent-teal);
        }
      `}</style>
    </div>
  );
}
