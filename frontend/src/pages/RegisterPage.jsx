import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormField } from '../components/common/FormField';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'analyst',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setFormError('Please fill out all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Registration failed.');
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
          <h1>Create Account</h1>
          <p className="auth-sub">Register as an investigator on PayPilot AI</p>
        </div>

        {formError && (
          <div className="auth-error-alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <FormField label="Full Name" required={true}>
            <input
              type="text"
              name="name"
              className="form-input"
              placeholder="e.g. Jane Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </FormField>

          <FormField label="Work Email" required={true}>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="jane@organization.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </FormField>

          <FormField label="Password" required={true} helpText="Minimum 6 characters">
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="••••••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </FormField>

          <FormField label="Role / Permissions">
            <select
              name="role"
              className="form-select"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="analyst">Analyst (Investigate & resolve incidents)</option>
              <option value="manager">Manager (Approve & review audit trails)</option>
              <option value="admin">Administrator (Full ledger control)</option>
            </select>
          </FormField>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting}
            style={{ marginTop: '1rem' }}
          >
            {isSubmitting ? 'Creating account...' : (
              <>
                Register Account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already registered? </span>
          <Link to="/login">Sign in here</Link>
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
