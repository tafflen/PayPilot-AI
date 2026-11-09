import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

const SAMPLE_TEMPLATES = {
  orders: `orderRef,customerName,customerEmail,description,expectedAmount,currency,status,invoiceRef
ORD-2026-001,Acme Corp,billing@acmecorp.example,Cloud Hosting Monthly,120.00,USD,pending,INV-001
ORD-2026-002,Apex Freight,finance@apexfreight.example,Logistics Routing Engine,450.00,USD,pending,INV-002
ORD-2026-003,Starlight Design,hello@starlight.example,UI Design System Retainer,800.00,USD,pending,INV-003`,
  payments: `transactionRef,orderRef,amount,currency,status,provider,recordedAt
TXN-2026-001,ORD-2026-001,120.00,USD,captured,STRIPE,2026-10-25T14:30:00Z
TXN-2026-002,ORD-2026-002,450.00,USD,captured,SQUARE,2026-10-25T15:00:00Z
TXN-2026-003,ORD-2026-003,800.00,USD,captured,PAYPAL,2026-10-25T16:15:00Z`,
};

export function CsvImportModal({ isOpen, onClose, type = 'orders', onSuccess }) {
  if (!isOpen) return null;

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('valid'); // 'valid' | 'duplicates' | 'invalid'
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const isOrderType = type === 'orders';
  const title = isOrderType ? 'Import Orders & Invoices CSV' : 'Import Payment Records CSV';

  const handleDownloadTemplate = () => {
    const template = SAMPLE_TEMPLATES[type];
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `paypilot_${type}_sample_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Please select a valid .csv file.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoadingPreview(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      setCsvText(text);

      try {
        const client = isOrderType ? api.orders : api.payments;
        const res = await client.import({ csvText: text, preview: true });
        setPreviewData(res.data);
        if (res.data.validRows.length > 0) {
          setActiveTab('valid');
        } else if (res.data.invalidRows.length > 0) {
          setActiveTab('invalid');
        } else {
          setActiveTab('duplicates');
        }
      } catch (err) {
        setErrorMessage(err.message || 'Failed to preview CSV file.');
      } finally {
        setIsLoadingPreview(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read local file.');
      setIsLoadingPreview(false);
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleExecuteImport = async () => {
    if (!previewData || previewData.validRows.length === 0) return;

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const client = isOrderType ? api.orders : api.payments;
      const res = await client.import({
        rows: previewData.validRows,
        preview: false,
      });

      setSuccessMessage(res.message || `Successfully imported ${res.data.importedCount} records.`);
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to complete import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setCsvText('');
    setPreviewData(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-container"
        style={{
          maxWidth: '920px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <UploadCloud size={20} color="var(--accent-teal)" />
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                padding: '0.85rem 1.15rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid var(--status-success)',
                color: 'var(--status-success)',
                padding: '0.85rem 1.15rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Upload Area / Dropzone */}
          {!previewData && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-fast)',
                  marginBottom: '1.25rem',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  style={{ display: 'none' }}
                />
                <UploadCloud
                  size={42}
                  color="var(--accent-teal)"
                  style={{ margin: '0 auto 0.75rem auto' }}
                />
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>
                  Click to select or drag and drop your {isOrderType ? 'Orders' : 'Payments'} CSV
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Standard CSV format with headers. Max 10,000 rows. Existing records are never overwritten.
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <FileText size={18} color="var(--accent-teal)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Need the format template?</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Download our pre-formatted sample CSV with required columns.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDownloadTemplate}
                >
                  <Download size={14} /> Download Sample Template
                </button>
              </div>
            </div>
          )}

          {/* Loading Preview Indicator */}
          {isLoadingPreview && (
            <div style={{ textAlign: 'center', padding: '2.5rem' }}>
              <RefreshCw
                size={28}
                color="var(--accent-teal)"
                style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem auto' }}
              />
              <div style={{ fontWeight: 500 }}>Validating rows and checking database duplicates...</div>
            </div>
          )}

          {/* Preview Deck */}
          {previewData && !isLoadingPreview && (
            <div>
              {/* Summary Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL ROWS</div>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                    {previewData.summary.totalRows}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>READY TO IMPORT</div>
                  <div
                    className="font-mono"
                    style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-success)' }}
                  >
                    {previewData.summary.validCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)' }}>
                    DUPLICATES SKIPPED
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-warning)' }}
                  >
                    {previewData.summary.duplicateCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>INVALID ROWS</div>
                  <div
                    className="font-mono"
                    style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-danger)' }}
                  >
                    {previewData.summary.invalidCount}
                  </div>
                </div>
              </div>

              {/* Safety notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                }}
              >
                <Info size={16} color="#38bdf8" />
                <span>
                  <strong>Non-destructive Guarantee:</strong> Only valid non-duplicate rows will be imported. Existing records in MongoDB are never modified or overwritten.
                </span>
              </div>

              {/* Tabs for preview data */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'valid' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('valid')}
                >
                  Ready ({previewData.validRows.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'duplicates' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('duplicates')}
                >
                  Duplicates ({previewData.duplicateRows.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'invalid' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('invalid')}
                >
                  Errors ({previewData.invalidRows.length})
                </button>
              </div>

              {/* Tab Content Table */}
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {activeTab === 'valid' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Reference</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>{isOrderType ? 'Customer' : 'Linked Order'}</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Amount</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Currency</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.validRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No valid records to display.
                          </td>
                        </tr>
                      ) : (
                        previewData.validRows.slice(0, 50).map((row, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.55rem 0.85rem' }} className="font-mono text-teal">
                              {isOrderType ? row.orderRef : row.transactionRef}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem' }}>
                              {isOrderType ? row.customerName : (row.orderRef || '—')}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem' }} className="font-mono">
                              {formatCurrency(isOrderType ? row.expectedAmount : row.amount, row.currency)}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem' }}>{row.currency}</td>
                            <td style={{ padding: '0.55rem 0.85rem' }}>
                              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                Valid
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'duplicates' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Row</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Reference</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.duplicateRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Zero duplicates detected.
                          </td>
                        </tr>
                      ) : (
                        previewData.duplicateRows.map((row, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-muted)' }}>#{row.rowNumber}</td>
                            <td style={{ padding: '0.55rem 0.85rem' }} className="font-mono text-warning">
                              {isOrderType ? row.orderRef : row.transactionRef}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', color: 'var(--status-warning)' }}>
                              {row.reason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'invalid' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Row</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Reference</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.invalidRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Zero validation errors!
                          </td>
                        </tr>
                      ) : (
                        previewData.invalidRows.map((row, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-muted)' }}>#{row.rowNumber}</td>
                            <td style={{ padding: '0.55rem 0.85rem' }} className="font-mono text-danger">
                              {isOrderType ? row.orderRef : row.transactionRef}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', color: 'var(--status-danger)' }}>
                              {row.errors.join('; ')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {previewData && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReset}
                disabled={isImporting}
              >
                Choose Another File
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancel
            </button>
            {previewData && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteImport}
                disabled={isImporting || previewData.validRows.length === 0}
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Importing Records...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Import {previewData.validRows.length} Valid Records
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
