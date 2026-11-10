import React, { useState } from 'react';
import { Menu, Play, RefreshCw, CheckCircle2, Sun, Moon } from 'lucide-react';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export function Header({ onMenuClick, onReconciled }) {
  const [isReconciling, setIsReconciling] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

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

  const isStaff = user?.role === 'business_admin' || user?.role === 'admin' || user?.role === 'analyst';

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <div className="platform-tagline">
          <span className="business-name">Acme Cloud Services Ltd</span>
          <span className="platform-divider">/</span>
          <span className="workspace-label">
            {user?.role === 'business_admin' || user?.role === 'admin'
              ? 'Business Management'
              : 'Analyst Workspace'}
          </span>
        </div>
      </div>

      <div className="header-right">
        {successToast && (
          <div className="recon-toast">
            <CheckCircle2 size={16} color="var(--status-success)" />
            <span>{successToast}</span>
          </div>
        )}

        {isStaff && (
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
        )}

        {/* Light / Dark Mode Toggle Button */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun size={18} color="#f59e0b" />
          ) : (
            <Moon size={18} color="#6366f1" />
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

        .platform-tagline {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .business-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .platform-divider {
          color: var(--text-muted);
        }

        .workspace-label {
          color: var(--accent-teal);
          font-weight: 500;
        }

        .menu-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.4rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .theme-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background-color: var(--bg-surface-elevated);
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .theme-toggle-btn:hover {
          background-color: var(--bg-surface-hover);
          border-color: var(--border-focus);
          transform: translateY(-1px);
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
          .business-name {
            display: none;
          }
          .platform-divider {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
