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
      setIncident(res.data.incident);
      setLinkedOrder(res.data.linkedOrder);
      setLinkedPayment(res.data.linkedPayment);
    } catch (err) {
      setError(err.message || 'Failed to load incident record.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
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
            Detected by engine on {formatDateTime(incident.createdAt)} &bull; Triggered Rule: <strong className="font-mono">{incident.triggeredRule}</strong>
          </div>
        </div>

        {/* Status Transition Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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

      {/* Structured Evidence Answers (6 Core Product Questions) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} color="var(--accent-teal)" /> Investigation Evidence Dossier
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
                className="form-textarea"
                rows={2}
                placeholder="Log an observation, gateway cross-reference note, or audit inquiry..."
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No notes added yet.
              </p>
            ) : (
              [...(incident.investigationNotes || [])].reverse().map((item, idx) => (
                <div key={item._id || idx} className="note-item">
                  <div className="note-meta">
                    <span style={{ fontWeight: 600, color: 'var(--accent-teal)' }}>
                      {item.author}
                    </span>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="note-text">{item.note}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Resolution status modal */}
      {modalTargetStatus && (
        <ResolutionModal
          isOpen={true}
          incident={incident}
          currentStatus={incident.status}
          targetStatus={modalTargetStatus}
          onClose={() => setModalTargetStatus(null)}
          onSubmit={handleStatusTransition}
        />
      )}
    </div>
  );
}
