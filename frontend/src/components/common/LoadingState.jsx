import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingState({ message = 'Loading records...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.5rem 1.5rem',
        color: 'var(--text-secondary)',
        gap: '0.75rem',
      }}
    >
      <Loader2
        size={36}
        color="var(--accent-teal)"
        style={{ animation: 'spin 1s linear infinite' }}
      />
      <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>{message}</p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
