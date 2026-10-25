import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        backgroundColor: 'var(--status-danger-bg)',
        border: '1px solid var(--status-danger-border)',
        borderRadius: 'var(--radius-lg)',
        margin: '1rem 0',
      }}
    >
      <AlertCircle size={40} color="var(--status-danger)" style={{ marginBottom: '0.75rem' }} />
      <h3 style={{ color: 'var(--status-danger)', marginBottom: '0.4rem', fontSize: '1.1rem' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', fontSize: '0.9rem', marginBottom: onRetry ? '1.25rem' : 0 }}>
        {message}
      </p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
