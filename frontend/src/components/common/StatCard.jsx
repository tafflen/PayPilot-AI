import React from 'react';

export function StatCard({ label, value, subtext, icon: Icon, color = 'teal', onClick, className = '' }) {
  return (
    <div
      className={`stat-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {Icon && (
        <div className={`stat-icon ${color}`}>
          <Icon size={24} />
        </div>
      )}
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {subtext && <div className="stat-sub">{subtext}</div>}
      </div>
    </div>
  );
}
