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
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EvidenceViewer } from '../components/incidents/EvidenceViewer';
import { ResolutionModal } from '../components/incidents/ResolutionModal';
import { formatDateTime } from '../utils/formatters';

export function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(20, 184, 166, 0.08)',
            borderBottom: '1px solid rgba(20, 184, 166, 0.2)',
            padding: '1rem 1.25rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Bot size={20} color="var(--accent-teal)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              Gemini AI Incident Investigation Copilot
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(20, 184, 166, 0.2)',
                color: 'var(--accent-teal)',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              AI Advisory
            </span>
          </div>

          {aiAnalyzedAt && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Last analyzed: {formatDateTime(aiAnalyzedAt)}
            </span>
          )}
        </div>

        <div className="card-body" style={{ padding: '1.25rem' }}>
          {/* Fact vs AI Suggestion Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              lineHeight: 1.45,
            }}
          >
            <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Fact & AI Distinction:</strong> The engine below presents verified, deterministic facts from your stored ledger. Gemini suggestions are advisory insights based strictly on these facts. Human review and approval are required before initiating financial corrections.
            </div>
          </div>

          {/* AI Loading State */}
          {isAiLoading && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <RefreshCw
                size={26}
                color="var(--accent-teal)"
                style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem auto' }}
              />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Analyzing Stored Incident Records with Gemini AI...
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Synthesizing order receivables, payment settlement events, and reconciliation rule logic.
              </div>
            </div>
          )}

          {/* AI Error State */}
          {aiError && !isAiLoading && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                <AlertTriangle size={16} />
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRunAiInvestigation}
              >
                <RefreshCw size={13} /> Retry AI Investigation
              </button>
            </div>
          )}

          {/* Empty state before running AI */}
          {!aiAnalysis && !isAiLoading && !aiError && (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1.5rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Sparkles
                size={32}
                color="var(--accent-teal)"
                style={{ margin: '0 auto 0.75rem auto', opacity: 0.8 }}
              />
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>
                Generate Instant AI Root Cause & Next Steps
              </div>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  maxWidth: '560px',
                  margin: '0 auto 1.25rem auto',
                  lineHeight: 1.5,
                }}
              >
                Click below to request an intelligent Gemini assessment of this discrepancy, detailing practical next steps tailored to your small business ledger.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRunAiInvestigation}
              >
                <Sparkles size={15} /> Run Gemini AI Investigation
              </button>
            </div>
          )}

          {/* Formatted AI Output */}
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
