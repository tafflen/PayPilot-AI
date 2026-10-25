import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormField } from '../components/common/FormField';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleFillDemo = () => {
    setEmail('demo@paypilot.local');
    setPassword('Password123!');
    setFormError(null);
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
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <ShieldCheck size={28} color="var(--accent-teal)" />
          </div>
          <h1>PayPilot<span className="text-teal">AI</span></h1>
          <p className="auth-sub">Payment Incident Investigation & Reconciliation</p>
        </div>

        {formError && (
          <div className="auth-error-alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <FormField label="Work Email" required={true}>
            <input
              type="email"
              className="form-input"
              placeholder="analyst@organization.com"
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

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Authenticating...' : (
              <>
                Sign In to Platform <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="demo-helper-box">
          <div className="demo-helper-title">
            <KeyRound size={15} color="var(--accent-teal)" />
            <span>Local Evaluation Sandbox</span>
          </div>
          <p className="demo-helper-text">
            Explore with preloaded orders, payments, and investigation incidents:
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            onClick={handleFillDemo}
          >
            Auto-fill Demo Credentials (demo@paypilot.local)
          </button>
        </div>

        <div className="auth-footer">
          <span>Need an analyst account? </span>
          <Link to="/register">Register new account</Link>
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
          max-width: 440px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 2.25rem 2rem;
          box-shadow: var(--shadow-lg);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
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
          margin: 0 auto 1rem;
        }

        .auth-header h1 {
          font-size: 1.65rem;
          margin-bottom: 0.35rem;
        }

        .auth-sub {
          color: var(--text-secondary);
          font-size: 0.88rem;
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
          font-size: 0.82rem;
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
      `}</style>
    </div>
  );
}
