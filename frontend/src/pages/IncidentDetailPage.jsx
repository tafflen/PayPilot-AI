import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Send,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Bot,
  RefreshCw,
  Copy,
  Check,
  Info,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EvidenceViewer } from '../components/incidents/EvidenceViewer';
import { ResolutionModal } from '../components/incidents/ResolutionModal';
import { formatDateTime } from '../utils/formatters';

export function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBusinessAdmin = user?.role === 'business_admin' || user?.role === 'admin';

  const [incident, setIncident] = useState(null);
  const [linkedOrder, setLinkedOrder] = useState(null);
  const [linkedPayment, setLinkedPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Gemini AI state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [adoptedNoteFeedback, setAdoptedNoteFeedback] = useState(false);

  // New note input
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Resolution modal
  const [modalTargetStatus, setModalTargetStatus] = useState(null);

  // Refund modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundTxnRef, setRefundTxnRef] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState(null);
  const [refundSuccessMessage, setRefundSuccessMessage] = useState(null);

  const fetchIncident = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.incidents.getById(id);
      const inc = res.data.incident;
      setIncident(inc);
      setLinkedOrder(res.data.linkedOrder);
      setLinkedPayment(res.data.linkedPayment);
      if (inc?.aiAnalysis) {
        setAiAnalysis(inc.aiAnalysis);
        setAiAnalyzedAt(inc.aiAnalyzedAt);
      }
    } catch (err) {
      setError(err.message || 'Failed to load incident record.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

  const handleRunAiInvestigation = async () => {
    if (!incident) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await api.incidents.investigateWithAi(incident.incidentRef || incident._id);
      setAiAnalysis(res.data.aiAnalysis);
      setAiAnalyzedAt(res.data.aiAnalyzedAt || new Date());
    } catch (err) {
      setAiError(
        err.message ||
          'AI investigation failed to complete. Please ensure GEMINI_API_KEY is configured in backend/.env'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAdoptAiRecommendation = () => {
    if (!aiAnalysis) return;
    const prefilledText = `[AI Recommendation Reviewed & Approved]\n${aiAnalysis.slice(0, 500)}${aiAnalysis.length > 500 ? '...' : ''}`;
    setNewNote(prefilledText);
    setAdoptedNoteFeedback(true);
    setTimeout(() => setAdoptedNoteFeedback(false), 2500);

    // Smooth scroll down to notes composer
    const noteArea = document.getElementById('investigation-notes-textarea');
    if (noteArea) {
      noteArea.focus();
      noteArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmittingNote(true);
    try {
      await api.incidents.addNote(incident._id, newNote.trim());
      setNewNote('');
      fetchIncident();
    } catch (err) {
      alert(`Failed to add note: ${err.message}`);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleStatusTransition = async (targetStatus, resolutionNote) => {
    await api.incidents.updateStatus(incident._id, targetStatus, resolutionNote);
    fetchIncident();
  };

  const handleOpenRefundModal = () => {
    const candidateTxn =
      linkedPayment?.transactionRef ||
      incident?.evidence?.duplicatePaymentRef ||
      incident?.evidence?.transactionRef ||
      incident?.evidence?.actualPayment?.transactionRef ||
      '';
    const candidateAmount = linkedPayment?.amount
      ? (linkedPayment.amount / 100).toFixed(2)
      : '';
    setRefundTxnRef(candidateTxn);
    setRefundAmount(candidateAmount);
    setRefundReason(`Approved duplicate/overcharge remediation for ${incident?.incidentRef}`);
    setRefundError(null);
    setIsRefundModalOpen(true);
  };

  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!refundTxnRef.trim()) {
      setRefundError('Transaction reference is required for refund.');
      return;
    }
    setIsRefunding(true);
    setRefundError(null);
    try {
      const minorAmount = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined;
      const res = await api.refunds.create({
        transactionRef: refundTxnRef.trim(),
        amount: minorAmount,
        reason: refundReason.trim(),
        incidentRef: incident?.incidentRef,
      });

      setRefundSuccessMessage(res.message || 'Refund successfully executed.');
      setIsRefundModalOpen(false);

      // Add investigation note for audit trail
      try {
        await api.incidents.addNote(
          incident._id,
          `[Human Action: Refund Processed] Initiated refund of ${minorAmount ? (minorAmount / 100).toFixed(2) : 'full amount'} for transaction ${refundTxnRef}. Reason: ${refundReason}`
        );
      } catch (noteErr) {
        console.warn('Note addition after refund had non-blocking issue:', noteErr);
      }

      fetchIncident();
    } catch (err) {
      setRefundError(err.message || 'Refund failed to execute.');
    } finally {
      setIsRefunding(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading incident investigation file..." />;
  if (error) return <ErrorState message={error} onRetry={fetchIncident} />;
  if (!incident) return <ErrorState message="Incident record not found." />;

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      {/* Back button and navigation */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link to="/incidents" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          <ArrowLeft size={16} /> Back to Incidents Queue
        </Link>
      </div>

      {/* Success banner if refund was just processed */}
      {refundSuccessMessage && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-border)',
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{refundSuccessMessage}</span>
          </div>
          <button
            className="btn-ghost"
            onClick={() => setRefundSuccessMessage(null)}
            style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Incident Dossier Header */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <span className="font-mono text-teal" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {incident.incidentRef}
            </span>
            <StatusBadge status={incident.status} />
            <StatusBadge status={incident.severity} type="severity" />
          </div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>
            {incident.incidentType.replace(/_/g, ' ')}
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Detected by engine on {formatDateTime(incident.createdAt)} &bull; Triggered Rule:{' '}
            <strong className="font-mono">{incident.triggeredRule}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* AI Investigate Action */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleRunAiInvestigation}
            disabled={isAiLoading}
            style={{
              backgroundColor: isAiLoading ? 'var(--bg-surface-elevated)' : '#0f766e',
              borderColor: 'var(--accent-teal)',
            }}
          >
            {isAiLoading ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Gemini Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={14} color="#5eead4" />
                {aiAnalysis ? 'Re-run AI Investigation' : 'AI Investigate'}
              </>
            )}
          </button>

          {/* Refund Action for Business Admin */}
          {isBusinessAdmin && (linkedPayment || incident.incidentType === 'DUPLICATE_TRANSACTION' || incident.evidence?.duplicatePaymentRef || incident.evidence?.transactionRef) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleOpenRefundModal}
              style={{
                borderColor: 'var(--status-danger)',
                color: 'var(--status-danger)',
              }}
            >
              <RotateCcw size={14} /> Initiate Refund
            </button>
          )}

          {/* Status Transitions */}
          {incident.status === 'open' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setModalTargetStatus('investigating')}
            >
              <Clock size={14} /> Begin Investigation
            </button>
          )}

          {incident.status === 'investigating' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setModalTargetStatus('resolved')}
            >
              <CheckCircle2 size={14} /> Mark as Resolved
            </button>
          )}

          {incident.status === 'resolved' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setModalTargetStatus('open')}
            >
              Reopen Incident
            </button>
          )}
        </div>
      </div>

      {/* Visible Gemini AI Investigation Section */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          border: '1px solid rgba(20, 184, 166, 0.35)',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          className="card-header"
          style={{
            backgroundColor: 'rgba(20, 184, 166, 0.08)',
            borderBottom: '1px solid rgba(20, 184, 166, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Bot size={20} color="var(--accent-teal)" />
            <h3 className="card-title" style={{ margin: 0 }}>
              Gemini AI Forensic Investigation Dossier
            </h3>
          </div>
          {aiAnalyzedAt && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Analyzed on {formatDateTime(aiAnalyzedAt)}
            </span>
          )}
        </div>

        <div className="card-body">
          {aiError && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-danger)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                marginBottom: '1rem',
                fontSize: '0.88rem',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Investigation Diagnostic:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{aiError}</p>
              </div>
            </div>
          )}

          {!aiAnalysis && !isAiLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                color: 'var(--text-secondary)',
              }}
            >
              <Sparkles size={32} color="var(--accent-teal)" style={{ marginBottom: '0.75rem', opacity: 0.8 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
                AI Forensic Analysis Available
              </p>
              <p
                style={{
                  fontSize: '0.84rem',
                  maxWidth: '520px',
                  margin: '0 auto 1.25rem auto',
                  color: 'var(--text-muted)',
                }}
              >
                Click "AI Investigate" above to generate a forensic breakdown: Root Cause hypothesis,
                Confidence score, Recommended resolution steps, and Pre-written customer explanation.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRunAiInvestigation}
              >
                <Sparkles size={14} /> Run Gemini Investigation
              </button>
            </div>
          )}

          {isAiLoading && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <RefreshCw
                size={28}
                color="var(--accent-teal)"
                style={{ animation: 'spin 1.2s linear infinite', marginBottom: '0.75rem' }}
              />
              <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--accent-teal)', margin: 0 }}>
                Synthesizing ledger evidence with Google Gemini AI...
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Evaluating order records, timestamps, amount deltas, and payment settlement states.
              </p>
            </div>
          )}

          {aiAnalysis && !isAiLoading && (
            <div>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  fontSize: '0.9rem',
                  lineHeight: '1.65',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '1.25rem',
                  fontFamily: 'inherit',
                }}
              >
                {aiAnalysis}
              </div>

              {/* Action Buttons to Promote to Note */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Satisfied with the AI insights? Transfer to your official notes history for human audit sign-off.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAdoptAiRecommendation}
                  >
                    {adoptedNoteFeedback ? (
                      <>
                        <Check size={14} color="var(--status-success)" /> Transferred to Composer
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Review & Use as Investigation Note
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleRunAiInvestigation}
                  >
                    <RefreshCw size={13} /> Re-analyze
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Structured Evidence Answers (6 Core Product Questions) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3
          style={{
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldAlert size={20} color="var(--accent-teal)" /> Verified Investigation Evidence Dossier
        </h3>
        <EvidenceViewer
          incident={incident}
          linkedOrder={linkedOrder}
          linkedPayment={linkedPayment}
        />
      </div>

      {/* Investigation Notes & Audit Trail */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <MessageSquare size={18} color="var(--accent-teal)" /> Investigation Notes & Log History
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {incident.investigationNotes?.length || 0} entries recorded
          </span>
        </div>

        <div className="card-body">
          {/* Add note form */}
          <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <textarea
                id="investigation-notes-textarea"
                className="form-textarea"
                rows={3}
                placeholder="Log an observation, cross-reference note, or verify AI recommendations..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={isSubmittingNote || !newNote.trim()}
                style={{ flexShrink: 0, height: '42px' }}
              >
                <Send size={15} /> Add Note
              </button>
            </div>
          </form>

          {/* Timeline of notes */}
          <div className="notes-timeline">
            {incident.investigationNotes?.length === 0 ? (
              <p className="empty-text">No investigation notes recorded yet.</p>
            ) : (
              incident.investigationNotes?.map((note, index) => (
                <div key={note._id || index} className="note-card">
                  <div className="note-header">
                    <span className="note-author">{note.author}</span>
                    <span className="note-date">{formatDateTime(note.createdAt)}</span>
                  </div>
                  <p className="note-content">{note.note}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Refund Initiation Modal */}
      {isRefundModalOpen && (
        <div className="modal-backdrop" onClick={() => !isRefunding && setIsRefundModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} color="var(--status-danger)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Initiate Customer Refund</h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => !isRefunding && setIsRefundModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleProcessRefund}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {refundError && (
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--status-danger-bg)',
                      color: 'var(--status-danger)',
                      border: '1px solid var(--status-danger-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {refundError}
                  </div>
                )}

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Authorizing this refund will call the PayPal Sandbox Refund API (if applicable) and record an irreversible settlement reversal in the ledger and customer portal.
                </p>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    Target Transaction Reference *
                  </label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. TXN-2026-004"
                    value={refundTxnRef}
                    onChange={(e) => setRefundTxnRef(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    Refund Amount (Decimal, e.g. 150.00 — leave blank for full captured amount)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input font-mono"
                    placeholder="Full Amount"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    Reason for Refund *
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Reason for approving refund (e.g. Duplicate PayPal capture confirmed)"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRefundModalOpen(false)}
                  disabled={isRefunding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isRefunding || !refundTxnRef.trim() || !refundReason.trim()}
                >
                  {isRefunding ? 'Processing Refund...' : 'Approve & Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolution status modal */}
      {modalTargetStatus && (
        <ResolutionModal
          isOpen={Boolean(modalTargetStatus)}
          targetStatus={modalTargetStatus}
          onClose={() => setModalTargetStatus(null)}
          onConfirm={handleStatusTransition}
        />
      )}
    </div>
  );
}

export default IncidentDetailPage;
