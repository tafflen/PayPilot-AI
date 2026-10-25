import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  RefreshCw,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  BarChart3,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Sidebar({ isOpen, onClose, openIncidentsCount = 0 }) {
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Reconciliation', path: '/reconciliation', icon: RefreshCw },
    {
      name: 'Incidents',
      path: '/incidents',
      icon: AlertTriangle,
      badge: openIncidentsCount > 0 ? openIncidentsCount : null,
    },
    { name: 'Orders & Invoices', path: '/orders', icon: ShoppingCart },
    { name: 'Transactions', path: '/transactions', icon: Receipt },
    { name: 'Reports & Audit', path: '/reports', icon: BarChart3 },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 90 }}
          onClick={onClose}
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-icon">
            <ShieldCheck size={22} color="var(--accent-teal)" />
          </div>
          <div className="brand-text">
            <span className="brand-name">PayPilot<span className="brand-ai">AI</span></span>
            <span className="brand-tag">RECONCILIATION PLATFORM</span>
          </div>
          {onClose && (
            <button className="mobile-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">MAIN NAVIGATION</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <Icon size={18} />
                <span className="nav-label">{item.name}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User and Footer info */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'Analyst'}</div>
              <div className="user-role">{user?.role || 'analyst'}</div>
            </div>
            <button
              className="btn-logout"
              title="Logout"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        .app-sidebar {
          width: var(--sidebar-width);
          background-color: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: transform var(--transition-normal);
        }

        .sidebar-brand {
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .brand-logo-icon {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          background: var(--accent-teal-glow);
          border: 1px solid rgba(6, 182, 212, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .brand-ai {
          color: var(--accent-teal);
          margin-left: 2px;
        }

        .brand-tag {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
        }

        .mobile-close-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          margin-left: auto;
        }

        .sidebar-nav {
          padding: 1.25rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
          overflow-y: auto;
        }

        .nav-section-title {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          padding: 0.5rem 0.75rem 0.25rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .nav-item:hover {
          color: var(--text-primary);
          background-color: var(--bg-surface-elevated);
        }

        .nav-item.active {
          color: #fff;
          background: linear-gradient(90deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 100%);
          border-left: 3px solid var(--accent-teal);
          font-weight: 600;
        }

        .nav-badge {
          margin-left: auto;
          background-color: var(--status-danger);
          color: #fff;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-full);
        }

        .sidebar-footer {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-subtle);
          background-color: var(--bg-surface);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--accent-teal) 0%, #0891b2 100%);
          color: var(--text-inverse);
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
        }

        .user-info {
          flex: 1;
          overflow: hidden;
        }

        .user-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-transform: capitalize;
        }

        .btn-logout {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.4rem;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background-color var(--transition-fast);
        }

        .btn-logout:hover {
          color: var(--status-danger);
          background-color: var(--status-danger-bg);
        }

        @media (max-width: 900px) {
          .app-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
          }
          .app-sidebar.open {
            transform: translateX(0);
          }
          .mobile-close-btn {
            display: block;
          }
        }
      `}</style>
    </>
  );
}
