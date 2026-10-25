import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ChevronRight, Eye } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchAndFilters } from '../components/common/SearchAndFilters';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [severity, setSeverity] = useState(searchParams.get('severity') || '');
  const [incidentType, setIncidentType] = useState(searchParams.get('type') || '');

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (severity) params.severity = severity;
      if (incidentType) params.incidentType = incidentType;

      const res = await api.incidents.list(params);
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [search, status, severity, incidentType]);

  const columns = [
    {
      header: 'Incident Ref',
      key: 'incidentRef',
      render: (inc) => (
        <span className="font-mono text-teal" style={{ fontWeight: 700 }}>
          {inc.incidentRef}
        </span>
      ),
    },
    {
      header: 'Type & Explanation',
      key: 'incidentType',
      render: (inc) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {inc.incidentType.replace(/_/g, ' ')}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              maxWidth: '380px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {inc.evidence?.explanation || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Severity',
      key: 'severity',
      render: (inc) => <StatusBadge status={inc.severity} type="severity" />,
    },
    {
      header: 'Status',
      key: 'status',
      render: (inc) => <StatusBadge status={inc.status} />,
    },
    {
      header: 'Linked References',
      key: 'orderRef',
      render: (inc) => (
        <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {inc.orderRef && <div>Ord: {inc.orderRef}</div>}
          {inc.transactionRef && <div>Txn: {inc.transactionRef}</div>}
          {!inc.orderRef && !inc.transactionRef && <div>—</div>}
        </div>
      ),
    },
    {
      header: 'Expected / Recorded',
      key: 'expectedAmount',
      render: (inc) => (
        <div className="font-mono" style={{ fontSize: '0.82rem' }}>
          <div>Exp: {formatCurrency(inc.expectedAmount, inc.currency)}</div>
          <div style={{ color: 'var(--text-muted)' }}>
            Rec: {formatCurrency(inc.recordedAmount, inc.currency)}
          </div>
        </div>
      ),
    },
    {
      header: 'Created',
      key: 'createdAt',
      render: (inc) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {formatDateTime(inc.createdAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (inc) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/incidents/${inc.incidentRef || inc._id}`);
          }}
        >
          Investigate <ChevronRight size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <AlertTriangle size={24} color="var(--status-warning)" /> Incident Investigation Queue
          </h1>
          <p className="page-subtitle">
            Discrepancy triage, evidence examination, and root cause resolution workflow
          </p>
        </div>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={fetchIncidents}>
            <RefreshCw size={14} /> Refresh Queue
          </button>
        </div>
      </div>

      <SearchAndFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by incident ref, order ref, rule..."
        filters={[
          {
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'investigating', label: 'Investigating' },
              { value: 'resolved', label: 'Resolved' },
            ],
          },
          {
            value: severity,
            onChange: setSeverity,
            options: [
              { value: '', label: 'All Severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ],
          },
          {
            value: incidentType,
            onChange: setIncidentType,
            options: [
              { value: '', label: 'All Incident Types' },
              { value: 'AMOUNT_MISMATCH', label: 'Amount Mismatch' },
              { value: 'CURRENCY_MISMATCH', label: 'Currency Mismatch' },
              { value: 'UNPAID_ORDER', label: 'Unpaid Order' },
              { value: 'DUPLICATE_TRANSACTION', label: 'Duplicate Transaction' },
              { value: 'STALE_PENDING_PAYMENT', label: 'Stale Pending' },
              { value: 'FAILED_PAYMENT', label: 'Failed Payment' },
              { value: 'UNLINKED_PAYMENT', label: 'Unlinked Payment' },
              { value: 'MISSING_REFERENCES', label: 'Missing References' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        data={incidents}
        isLoading={isLoading}
        emptyTitle="No incidents found"
        emptyDescription="All accounts are currently in balance or no items match your active filters."
        onRowClick={(inc) => navigate(`/incidents/${inc.incidentRef || inc._id}`)}
      />
    </div>
  );
}
