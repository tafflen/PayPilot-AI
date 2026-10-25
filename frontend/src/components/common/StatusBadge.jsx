import React from 'react';
import { getStatusBadgeVariant, getSeverityBadgeVariant } from '../../utils/formatters';

export function StatusBadge({ status, type = 'status', className = '' }) {
  if (!status) return null;

  const variant = type === 'severity'
    ? getSeverityBadgeVariant(status)
    : getStatusBadgeVariant(status);

  const displayLabel = status.replace(/_/g, ' ');

  return (
    <span className={`badge badge-${variant} ${className}`}>
      <span className="badge-dot" />
      {displayLabel}
    </span>
  );
}
