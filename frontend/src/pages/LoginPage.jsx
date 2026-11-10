import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  KeyRound,
  Building2,
  BarChart3,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FormField } from '../components/common/FormField';

const ROLE_CONFIGS = {
  business_admin: {
    key: 'business_admin',
    label: 'Business Admin',
    icon: Building2,
    badgeColor: 'var(--accent-teal)',
    description: 'Executive management, customers, invoice billing, refunds & full audit trail.',
    demoEmail: 'admin@paypilot.test',
    demoPass: 'AdminPass123!',
    redirectPath: '/dashboard',
    emailPlaceholder: 'admin@paypilot.test',
  },
  analyst: {
    key: 'analyst',
    label: 'Reconciliation Analyst',
    icon: BarChart3,
    badgeColor: '#38bdf8',
    description: 'Operational matching, discrepancy investigation & incident resolution queue.',
    demoEmail: 'analyst@paypilot.test',
    demoPass: 'AnalystPass123!',
    redirectPath: '/reconciliation',
    emailPlaceholder: 'analyst@paypilot.test',
  },
  customer: {
    key: 'customer',
    label: 'Customer Portal',
    icon: User,
    badgeColor: '#10b981',
    description: 'Dedicated client portal: view invoices, receipts, and pay via PayPal Sandbox.',
    demoEmail: 'customer@paypilot.test',
    demoPass: 'CustomerPass123!',
    redirectPath: '/portal',
    emailPlaceholder: 'customer@paypilot.test',
  },
};

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role');
  const validInitialRole = ROLE_CONFIGS[initialRole] ? initialRole : 'business_admin';

  const [selectedRole, setSelectedRole] = useState(validInitialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const currentRoleConfig = ROLE_CONFIGS[selectedRole];

  useEffect(() => {
    if (searchParams.get('role') && ROLE_CONFIGS[searchParams.get('role')]) {
      setSelectedRole(searchParams.get('role'));
    }
  }, [searchParams]);

  const handleFillDemo = () => {
    setEmail(currentRoleConfig.demoEmail);
    setPassword(currentRoleConfig.demoPass);
    setFormError(null);
  };

  const handleRoleTabClick = (roleKey) => {
    setSelectedRole(roleKey);
    setFormError(null);
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const loggedInUser = await login(email, password, selectedRole);

      // Redirect strictly based on assigned role
      const userRole = loggedInUser.role === 'admin' ? 'business_admin' : loggedInUser.role;
      if (userRole === 'customer') {
        navigate('/portal');
      } else if (userRole === 'analyst') {
        navigate('/reconciliation');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Top bar with Theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <button
            type="button"
            className="btn-theme-login"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} color="#6366f1" />}
          </button>
        </div>

        <div className="auth-header">
          <div className="auth-logo">
            <ShieldCheck size={28} color="var(--accent-teal)" />
          </div>
          <h1>
            PayPilot<span className="text-teal">AI</span>
          </h1>
          <p className="auth-sub">Role-Based Payment Reconciliation Platform</p>
        </div>

        {/* 3-Role Separate Entry Tabs */}
        <div className="role-selector-tabs">
          {Object.values(ROLE_CONFIGS).map((cfg) => {
            const Icon = cfg.icon;
            const isSelected = selectedRole === cfg.key;
            return (
              <button
                key={cfg.key}
                type="button"
                className={`role-tab ${isSelected ? 'active' : ''}`}
                onClick={() => handleRoleTabClick(cfg.key)}
              >
                <Icon size={16} />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        <div className="role-description-banner">
          <span style={{ fontWeight: 600, color: currentRoleConfig.badgeColor }}>
            {currentRoleConfig.label}:
          </span>{' '}
          {currentRoleConfig.description}
        </div>

        {formError && <div className="auth-error-alert">{formError}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <FormField label={`${currentRoleConfig.label} Email`} required={true}>
            <input
              type="email"
              className="form-input"
              placeholder={currentRoleConfig.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Password" required={true}>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormField>

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? (
              'Authenticating...'
            ) : (
              <>
                Sign In as {currentRoleConfig.label} <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Dedicated Quick Demo Helper */}
        <div className="demo-helper-box">
          <div className="demo-helper-title">
            <KeyRound size={15} color="var(--accent-teal)" />
            <span>Preloaded {currentRoleConfig.label} Account</span>
          </div>
          <p className="demo-helper-text">
            Log in directly as <strong>{currentRoleConfig.demoEmail}</strong> to test this role:
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            onClick={handleFillDemo}
          >
            Auto-fill {currentRoleConfig.label} Credentials
          </button>
        </div>

        <div className="auth-footer">
          {selectedRole === 'customer' ? (
            <span>
              New client? <Link to="/register">Register customer portal account</Link>
            </span>
          ) : (
            <span>
              Customer paying an invoice?{' '}
              <button
                type="button"
                className="btn-link"
                onClick={() => handleRoleTabClick('customer')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Go to Customer Portal Login
              </button>
            </span>
          )}
        </div>
      </div>

      <style>{`
        .auth-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-app);
          padding: 1.5rem;
        }

        .auth-card {
          width: 100%;
          max-width: 490px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 2.25rem 2rem;
          box-shadow: var(--shadow-lg);
        }

        .btn-theme-login {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background-color: var(--bg-surface-elevated);
          border: 1px solid var(--border-strong);
          cursor: pointer;
        }

        .btn-theme-login:hover {
          background-color: var(--bg-surface-hover);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .auth-logo {
          width: 50px;
          height: 50px;
          border-radius: var(--radius-md);
          background: var(--accent-teal-glow);
          border: 1px solid rgba(6, 182, 212, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.75rem;
        }

        .auth-header h1 {
          font-size: 1.65rem;
          margin-bottom: 0.25rem;
        }

        .auth-sub {
          color: var(--text-secondary);
          font-size: 0.88rem;
        }

        .role-selector-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.4rem;
          background-color: var(--bg-input);
          padding: 0.3rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          margin-bottom: 1rem;
        }

        .role-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.55rem 0.3rem;
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .role-tab:hover {
          color: var(--text-primary);
        }

        .role-tab.active {
          background-color: var(--bg-surface-elevated);
          color: var(--accent-teal);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-strong);
        }

        .role-description-banner {
          font-size: 0.78rem;
          color: var(--text-secondary);
          background-color: var(--bg-surface-elevated);
          border-left: 3px solid var(--accent-teal);
          padding: 0.6rem 0.85rem;
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          margin-bottom: 1.25rem;
          line-height: 1.4;
        }

        .auth-error-alert {
          background-color: var(--status-danger-bg);
          border: 1px solid var(--status-danger-border);
          color: var(--status-danger);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .auth-form {
          margin-bottom: 1.5rem;
        }

        .btn-block {
          width: 100%;
        }

        .demo-helper-box {
          background-color: var(--bg-surface-elevated);
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-md);
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .demo-helper-title {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--accent-teal);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.35rem;
        }

        .demo-helper-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .auth-footer {
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-secondary);
          padding-top: 1rem;
          border-top: 1px solid var(--border-subtle);
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 1.5rem 1.25rem;
          }
          .role-tab span {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}
