import React from 'react';
import { Search } from 'lucide-react';

export function SearchAndFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  extraActions,
}) {
  return (
    <div className="filter-bar">
      <div className="search-input-group">
        <Search size={16} />
        <input
          type="text"
          className="form-input"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-controls">
        {filters.map((f, idx) => (
          <select
            key={idx}
            className="form-select"
            style={{ width: 'auto', minWidth: '130px' }}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
          >
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
        {extraActions}
      </div>
    </div>
  );
}
