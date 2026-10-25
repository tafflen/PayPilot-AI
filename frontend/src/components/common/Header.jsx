import React, { useState } from 'react';
import { Menu, Play, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

export function Header({ onMenuClick, onReconciled }) {
  const [isReconciling, setIsReconciling] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  const handleRunReconciliation = async () => {
    setIsReconciling(true);
    try {
      const res = await api.reconciliation.trigger();
      setSuccessToast(`Reconciliation complete: ${res.data.matchedCount} matched, ${res.data.discrepancyCount} discrepancies.`);
      if (onReconciled) onReconciled(res.data);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      alert(`Reconciliation failed: ${err.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="menu-btn" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div className="env-pill">
          <span className="env-dot" />
          <span>Local Investigation Sandbox &bull; Demo Engine</span>
        </div>
      </div>

      <div className="header-right">
        {successToast && (
          <div className="recon-toast">
            <CheckCircle2 size={16} color="var(--status-success)" />
            <span>{successToast}</span>
          </div>
        )}

        <button
          className="btn btn-primary btn-sm"
          onClick={handleRunReconciliation}
          disabled={isReconciling}
        >
          {isReconciling ? (
            <>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Reconciling...
            </>
          ) : (
            <>
              <Play size={14} /> Run Reconciliation
            </>
          )}
        </button>
      </div>

      <style>{`
        .app-header {
          height: var(--header-height);
          background-color: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .menu-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.4rem;
        }

        .env-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: var(--bg-surface-elevated);
          border: 1px solid var(--border-strong);
          padding: 0.3rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .env-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: var(--accent-teal);
          box-shadow: 0 0 6px var(--accent-teal);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .recon-toast {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: var(--status-success-bg);
          border: 1px solid var(--status-success-border);
          color: var(--status-success);
          padding: 0.35rem 0.8rem;
          border-radius: var(--radius-md);
          font-size: 0.82rem;
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .app-header {
            padding: 0 1rem;
          }
          .menu-btn {
            display: block;
          }
          .env-pill {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
