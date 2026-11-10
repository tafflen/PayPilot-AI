import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FileText,
  CreditCard,
  RotateCcw,
  LifeBuoy,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export function CustomerPortalLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login?role=customer');
  };

  const navLinks = [
    { name: 'Overview', path: '/portal', icon: LayoutDashboard, end: true },
    { name: 'My Invoices', path: '/portal/invoices', icon: FileText },
    { name: 'My Transactions', path: '/portal/transactions', icon: CreditCard },
    { name: 'My Refunds', path: '/portal/refunds', icon: RotateCcw },
    { name: 'Support & Help', path: '/portal/support', icon: LifeBuoy },
  ];

  return (
    <div className="customer-portal-app">
      {/* Portal Top Header */}
      <header className="portal-header">
        <div className="portal-header-left">
          <div className="portal-brand">
            <div className="brand-logo-icon">
              <ShieldCheck size={20} color="var(--accent-teal)" />
            </div>
            <div className="portal-brand-text">
              <span className="brand-name">PayPilot<span className="brand-ai">AI</span></span>
              <span className="portal-badge">CLIENT PORTAL</span>
            </div>
          </div>
        </div>

        <div className="portal-header-right">
          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            className="portal-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} color="#6366f1" />}
          </button>

          {/* User profile capsule */}
          <div className="customer-user-capsule">
            <div className="user-avatar-sm">
              {(user?.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div className="user-meta">
              <div className="user-name-text">{user?.name || 'Customer'}</div>
              <div className="user-email-text">{user?.email}</div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            title="Sign out of Customer Portal"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      {/* Portal Navigation Bar */}
      <nav className="portal-nav-bar">
        <div className="portal-nav-inner">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.end}
                className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{link.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Main Content View */}
      <main className="portal-main-content">
        <Outlet />
      </main>

      <style>{`
        .customer-portal-app {
          min-height: 100vh;
          background-color: var(--bg-app);
          display: flex;
          flex-direction: column;
        }

        .portal-header {
          height: 64px;
          background-color: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .portal-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-logo-icon {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          background-color: var(--accent-teal-glow);
          border: 1px solid rgba(6, 182, 212, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .portal-brand-text {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .brand-name {
          font-weight: 700;
          font-size: 1.15rem;
          color: var(--text-primary);
        }

        .brand-ai {
          color: var(--accent-teal);
        }

        .portal-badge {
          font-size: 0.7rem;
          font-weight: 700;
          background-color: rgba(16, 185, 129, 0.15);
          color: var(--status-success);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          letter-spacing: 0.05em;
        }

        .portal-header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .portal-theme-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          background-color: var(--bg-surface-elevated);
          border: 1px solid var(--border-strong);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .portal-theme-btn:hover {
          background-color: var(--bg-surface-hover);
          border-color: var(--border-focus);
        }

        .customer-user-capsule {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.35rem 0.75rem;
          background-color: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
        }

        .user-avatar-sm {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-teal), #0284c7);
          color: #fff;
          font-weight: 700;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-name-text {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .user-email-text {
          font-size: 0.7rem;
          color: var(--text-muted);
          line-height: 1.2;
        }

        .portal-nav-bar {
          background-color: var(--bg-surface-elevated);
          border-bottom: 1px solid var(--border-subtle);
          padding: 0 2rem;
        }

        .portal-nav-inner {
          display: flex;
          gap: 0.5rem;
          max-width: 1300px;
          margin: 0 auto;
          overflow-x: auto;
        }

        .portal-nav-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem 1rem;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-secondary);
          border-bottom: 2px solid transparent;
          transition: all var(--transition-fast);
          text-decoration: none;
          white-space: nowrap;
        }

        .portal-nav-item:hover {
          color: var(--text-primary);
        }

        .portal-nav-item.active {
          color: var(--accent-teal);
          border-bottom-color: var(--accent-teal);
          background-color: var(--bg-surface-hover);
        }

        .portal-main-content {
          flex: 1;
          max-width: 1300px;
          margin: 0 auto;
          width: 100%;
          padding: 2rem;
        }

        @media (max-width: 768px) {
          .portal-header {
            padding: 0 1rem;
          }
          .portal-nav-bar {
            padding: 0 1rem;
          }
          .portal-main-content {
            padding: 1rem;
          }
          .user-meta {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
