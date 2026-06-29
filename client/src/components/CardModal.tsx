import { Sparkles , AlertTriangle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { type Card, useCardStore } from '../stores/cardStore';
import { useCommentStore } from '../stores/commentStore';
import { useActivityStore } from '../stores/activityStore';
import { useToastStore } from '../stores/toastStore';
import { ConfirmDialog } from './ConfirmDialog';
import { useBoardMemberStore } from '../stores/boardMemberStore';
import { socketService } from '../services/socketService';
import { useSessionStore } from '../stores/sessionStore';

interface CardModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  boardId?: string;
  boardComplexityMax?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  canComment?: boolean;
}

export function CardModal({ card, isOpen, onClose, boardId, boardComplexityMax = 5, canEdit = false, canDelete = false, canComment = false }: CardModalProps): React.ReactElement | null {
  const { updateCard, deleteCard } = useCardStore();
  const { comments, fetchComments, createComment, deleteComment } = useCommentStore();
  const { activities, fetchActivity } = useActivityStore();
  const { addToast } = useToastStore();
  const { members, fetchMembers } = useBoardMemberStore();
  const { user } = useSessionStore();

  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const boardMembers = card ? (members[card.boardId] || []) : [];
  const currentUserRole = boardMembers.find(m => m.userId === user?.id)?.role;

  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editComplexity, setEditComplexity] = useState<number | ''>('');
  const [editAssignee, setEditAssignee] = useState('');

  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conflictError, setConflictError] = useState<{ message: string; latestCard: Card | null } | null>(null);

  const [showOverrideDropdown, setShowOverrideDropdown] = useState(false);
  
  const [snapshotCard, setSnapshotCard] = useState<Card | null>(null);

  useEffect(() => {
    if (isOpen && card) {
      fetchComments(card.id, card.boardId);
      fetchActivity(card.id, card.boardId);
      fetchMembers(card.boardId);
      /* eslint-disable react-hooks/set-state-in-effect */
      setSnapshotCard(card);
      setEditTitle(card.title);
      setEditDesc(card.description || '');
      setEditComplexity(card.complexity || '');
      setEditAssignee(card.assigneeId || '');
      setIsEditing(false);
      setActiveTab('details');
      setNewComment('');
      setShowDeleteConfirm(false);
      setConflictError(null);
      setShowOverrideDropdown(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card?.id]);

  // Synchronize AI fields when the store receives a newer version from sockets
  const latestCardFromStore = useCardStore(state => {
    if (!card) return null;
    for (const col of Object.values(state.cards)) {
      const found = col.find(c => c.id === card.id);
      if (found) return found;
    }
    return null;
  });

  useEffect(() => {
    if (isOpen && latestCardFromStore) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshotCard(prev => {
        if (!prev || prev.id !== latestCardFromStore.id) return prev;
        
        // If the incoming card has a higher version...
        if (latestCardFromStore.version > prev.version) {
          
          // Determine if this update was purely from the AI.
          // The AI only updates suggestedSp, spConfidence, spReasons, complexityStatus, and bumps version.
          // It does NOT touch title, description, complexity, or assigneeId.
          const isAIUpdate = 
            latestCardFromStore.title === prev.title && 
            latestCardFromStore.description === prev.description && 
            latestCardFromStore.complexity === prev.complexity && 
            latestCardFromStore.assigneeId === prev.assigneeId;

          if (isAIUpdate) {
            // It's safe to silently absorb the new version because no user edits were made.
            // This prevents a 409 Conflict when we save our own ongoing description edits.
            return latestCardFromStore;
          }
          
          // If a USER made the update (e.g. title changed), we DO NOT update snapshotCard.
          // This guarantees that when WE click Save, we send our old version, correctly 
          // triggering an OCC 409 conflict so we don't accidentally overwrite their work!
        }
        return prev;
      });
    }
  }, [latestCardFromStore, isOpen]);

  if (!isOpen || !snapshotCard || !card) return null;

  const cardComments = comments[snapshotCard.id] || [];
  const cardHistory = activities[snapshotCard.id] || [];

  const handleSave = async () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      addToast('Title is required', 'error');
      return;
    }
    if (trimmedTitle.length > 200) {
      addToast('Title must be 200 characters or fewer', 'error');
      return;
    }
    const trimmedDesc = editDesc ? editDesc.trim() : '';
    if (trimmedDesc && trimmedDesc.length > 5000) {
      addToast('Description must be 5000 characters or fewer', 'error');
      return;
    }
    
    const complexityVal = editComplexity === '' ? null : Number(editComplexity);
    
    try {
      const updated = await updateCard(snapshotCard.id, snapshotCard.columnId, snapshotCard.version, {
        title: trimmedTitle,
        description: trimmedDesc || null,
        complexity: complexityVal,
        assigneeId: editAssignee || null,
      });
      setSnapshotCard(updated);
      setIsEditing(false);
      addToast('Card updated', 'success');
      fetchActivity(snapshotCard.id, snapshotCard.boardId);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number, data?: { error?: string } }; message: string };
      const errorMessage = error.response?.data?.error || error.message;
      if (error.response?.status === 409 || errorMessage.includes('Version conflict')) {
        const allCards = useCardStore.getState().cards;
        let latestCard: Card | null = null;
        for (const col of Object.values(allCards)) {
          const found = col.find(c => c.id === snapshotCard.id);
          if (found) { latestCard = found; break; }
        }
        setConflictError({
          message: "This card was updated by another user while you were editing.",
          latestCard
        });
      } else {
        addToast(errorMessage, 'error');
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCard(snapshotCard.id, snapshotCard.columnId);
      addToast('Card deleted', 'success');
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      addToast(error.response?.data?.error || error.message, 'error');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedComment = newComment.trim();
    if (!trimmedComment) return;
    if (trimmedComment.length > 1000) {
      addToast('Comment must be 1000 characters or fewer', 'error');
      return;
    }
    try {
      await createComment(snapshotCard.id, snapshotCard.boardId, trimmedComment);
      setNewComment('');
      fetchActivity(snapshotCard.id, snapshotCard.boardId);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      addToast(error.response?.data?.error || error.message, 'error');
    }
  };

  const handleAcceptAI = async () => {
    if (!card.suggestedSp) return;
    try {
      const updated = await updateCard(snapshotCard.id, snapshotCard.columnId, snapshotCard.version, {
        complexity: card.suggestedSp,
        complexityStatus: 'ACCEPTED',
      });
      setSnapshotCard(updated);
      setEditComplexity(updated.complexity || '');
      addToast('AI suggestion accepted', 'success');
      fetchActivity(snapshotCard.id, snapshotCard.boardId);
    } catch {
      addToast('Failed to accept AI suggestion', 'error');
    }
  };

  const handleOverrideAI = async (sp: number) => {
    try {
      const updated = await updateCard(snapshotCard.id, snapshotCard.columnId, snapshotCard.version, {
        complexity: sp,
        complexityStatus: 'OVERRIDDEN',
      });
      setSnapshotCard(updated);
      setEditComplexity(updated.complexity || '');
      setShowOverrideDropdown(false);
      addToast(`Complexity overridden to ${sp} SP`, 'success');
      fetchActivity(snapshotCard.id, snapshotCard.boardId);
    } catch {
      addToast('Failed to override complexity', 'error');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
        <div className="bg-surface rounded-xl shadow-floating w-full max-w-2xl max-h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b flex justify-between items-start bg-background">
            <div className="flex-1 min-w-0 pr-4">
              {!isEditing ? (
                <h2 className="text-xl font-bold text-primary break-words whitespace-normal">{snapshotCard.title}</h2>
              ) : (
                <input
                  type="text"
                  className="w-full border p-2 rounded-xl text-xl font-bold"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    // Debounced typing indicator
                    if (boardId && snapshotCard && user) {
                      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
                      typingDebounceRef.current = setTimeout(() => {
                        socketService.emitTyping(boardId, snapshotCard.id, user.displayName);
                      }, 200);
                    }
                  }}
                  maxLength={200}
                />
              )}
              <div className="text-xs text-muted mt-2">v{snapshotCard.version} • Created {new Date(snapshotCard.createdAt).toLocaleString()}</div>
            </div>
            <button onClick={onClose} className="text-muted hover:text-primary text-2xl leading-none shrink-0">&times;</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6 bg-surface">
            <button
              className={`py-3 px-4 font-medium border-b-2 ${activeTab === 'details' ? 'border-primary text-primary-accent' : 'border-transparent text-muted hover:text-secondary'}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              className={`py-3 px-4 font-medium border-b-2 flex items-center gap-2 ${activeTab === 'comments' ? 'border-primary text-primary-accent' : 'border-transparent text-muted hover:text-secondary'}`}
              onClick={() => setActiveTab('comments')}
            >
              Comments <span className="bg-elevated text-secondary text-xs py-0.5 px-2 rounded-full">{cardComments.length}</span>
            </button>
            <button
              className={`py-3 px-4 font-medium border-b-2 ${activeTab === 'history' ? 'border-primary text-primary-accent' : 'border-transparent text-muted hover:text-secondary'}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-surface min-h-[300px]">
            {activeTab === 'details' && (
              <div className="flex flex-col gap-4">
                {!isEditing ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4 bg-background p-4 rounded-xl border">
                      <div>
                        <span className="text-muted block mb-1">Assignee</span>
                        <span className="font-medium text-primary">
                          {snapshotCard.assigneeId
                            ? (boardMembers.find((m) => m.userId === snapshotCard.assigneeId)?.user.displayName ?? snapshotCard.assigneeId)
                            : 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block mb-1">Complexity</span>
                        <span className="font-medium text-primary">{snapshotCard.complexity || 'Unestimated'}</span>
                      </div>
                    </div>
                    
                    {/* AI Complexity Section */}
                    {card.suggestedSp !== null && (
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-primary rounded-2xl p-4 mb-4 shadow-subtle">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-primary-accent font-bold"><Sparkles className="w-4 h-4 inline-block mr-1 text-primary-accent" /> AI Complexity Inference</span>
                            {card.complexityStatus === 'ACCEPTED' && (
                              <span className="bg-status-success/5 text-status-success border border-status-success/10 text-xs font-bold px-2 py-0.5 rounded-full border border-status-success">
                                ACCEPTED
                              </span>
                            )}
                            {card.complexityStatus === 'OVERRIDDEN' && (
                              <span className="bg-elevated text-primary border border text-xs font-bold px-2 py-0.5 rounded-full border border-primary/30">
                                OVERRIDDEN
                              </span>
                            )}
                            {card.complexityStatus === 'PENDING' && (
                              <span className="bg-status-warning/5 text-status-warning border border-status-warning/10 text-xs font-bold px-2 py-0.5 rounded-full border border-status-warning">
                                PENDING
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-2 relative">
                              {card.complexityStatus !== 'ACCEPTED' && (
                                <button onClick={handleAcceptAI} className="bg-primary text-inverse text-xs font-medium px-3 py-1.5 rounded-xl shadow hover:bg-primary transition-colors">
                                  Accept {card.suggestedSp} SP
                                </button>
                              )}
                              <button 
                                onClick={() => setShowOverrideDropdown(!showOverrideDropdown)}
                                className="bg-surface text-primary-accent border border-primary text-xs font-medium px-3 py-1.5 rounded-xl shadow hover:bg-surface transition-colors"
                              >
                                Override
                              </button>
                              {showOverrideDropdown && (
                                <div className="absolute top-full right-0 mt-1 bg-surface border rounded-xl shadow-floating border border-strong z-10 min-w-[120px] py-1">
                                  {[1, 2, 3, 5, 8, 13].map((sp) => (
                                    <button 
                                      key={sp}
                                      onClick={() => handleOverrideAI(sp)}
                                      className="block w-full text-left px-4 py-2 text-sm text-secondary hover:bg-surface hover:text-primary-accent"
                                    >
                                      {sp} SP
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="bg-surface/60 p-3 rounded-xl border border-primary flex items-center justify-between">
                            <span className="text-secondary text-sm">Suggested</span>
                            <span className="text-xl font-bold text-primary-accent">{card.suggestedSp} <span className="text-sm font-normal text-primary-accent">SP</span></span>
                          </div>
                          <div className="bg-surface/60 p-3 rounded-xl border border-primary flex items-center justify-between">
                            <span className="text-secondary text-sm">Confidence</span>
                            <span className="text-xl font-bold text-primary-accent">{card.spConfidence}%</span>
                          </div>
                        </div>
                        <div className="bg-surface/60 p-3 rounded-xl border border-primary">
                          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Reasoning</span>
                          <ul className="list-disc pl-4 space-y-1">
                            {(card.spReasons || []).map((reason, idx) => (
                              <li key={idx} className="text-sm text-secondary">{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="font-bold text-secondary mb-2">Description</h3>
                      {snapshotCard.description ? (
                        <p className="whitespace-pre-wrap text-secondary text-sm">{snapshotCard.description}</p>
                      ) : (
                        <p className="text-muted italic text-sm">No description provided.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-secondary mb-1">Assignee</label>
                        <select
                          className="w-full border p-2 rounded-xl bg-surface"
                          value={editAssignee}
                          onChange={(e) => setEditAssignee(e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {boardMembers.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.user.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-secondary mb-1">Complexity (1-{boardComplexityMax})</label>
                        <input
                          type="number"
                          className="w-full border p-2 rounded"
                          value={editComplexity}
                          onChange={(e) => setEditComplexity(e.target.value === '' ? '' : Number(e.target.value))}
                          min={1}
                          max={boardComplexityMax}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">Description</label>
                      <textarea
                        className="w-full border p-2 rounded-xl min-h-[150px]"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Add a more detailed description..."
                        maxLength={5000}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {cardComments.length === 0 ? (
                    <div className="text-muted text-center py-8 italic text-sm">No comments yet.</div>
                  ) : (
                    cardComments.map(comment => (
                      <div key={comment.id} className="bg-background p-3 rounded-xl border">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm text-primary">{comment.user.displayName}</span>
                          <span className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-secondary whitespace-pre-wrap">{comment.body}</p>
                        {(comment.userId === user?.id || currentUserRole === 'OWNER') && (
                          <button 
                            onClick={() => deleteComment(comment.id, snapshotCard.id, snapshotCard.boardId)}
                            className="text-xs text-status-danger hover:text-status-danger mt-2"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {canComment && (
                  <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t">
                    <input
                      type="text"
                      className="flex-1 border p-2 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none outline-none"
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      maxLength={1000}
                    />
                    <button type="submit" disabled={!newComment.trim()} className="bg-primary text-inverse px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                      Send
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex flex-col pt-2 pb-4">
                {cardHistory.length === 0 ? (
                  <div className="text-muted text-center py-8 italic text-sm">No activity recorded.</div>
                ) : (
                  cardHistory.map(log => {
                    const actor = log.user?.displayName || 'System';
                    const m = log.metadata || {};
                    let description: React.ReactNode = null;

                    switch (log.type) {
                      case 'CARD_CREATED':
                        if (m.githubRepo && m.githubIssue && m.githubUrl) {
                          description = (
                            <div className="flex flex-col gap-1.5 mt-2 p-3 bg-background border border rounded-2xl text-sm text-secondary w-full max-w-sm shadow-subtle">
                              <span className="font-semibold text-primary flex items-center gap-2">
                                <svg className="w-4 h-4 text-secondary" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                Imported from GitHub
                              </span>
                              <div className="flex flex-col gap-1 mt-1 text-xs">
                                <span><span className="font-medium text-muted w-20 inline-block">Repository:</span> <span className="font-mono text-primary">{String(m.githubRepo)}</span></span>
                                <span><span className="font-medium text-muted w-20 inline-block">Issue:</span> <span className="font-mono text-primary">#{String(m.githubIssue)}</span></span>
                                <span><span className="font-medium text-muted w-20 inline-block">Original URL:</span> <a href={String(m.githubUrl)} target="_blank" rel="noreferrer" className="text-primary-accent hover:underline inline-flex items-center gap-1">{String(m.githubUrl)} <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a></span>
                              </div>
                            </div>
                          );
                        } else if (m.creationSource === 'Chrome Extension') {
                          description = (
                            <div className="flex flex-col gap-1.5 mt-2 p-3 bg-background border border rounded-2xl text-sm text-secondary w-full max-w-sm shadow-subtle">
                              <span className="font-semibold text-primary flex items-center gap-2">
                                <svg className="w-4 h-4 text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                Created from Chrome Extension
                              </span>
                              {m.referenceUrl && (
                                <div className="flex flex-col gap-1 mt-1 text-xs">
                                  <span className="flex items-start gap-1"><span className="font-medium text-muted shrink-0">Source:</span> <a href={String(m.referenceUrl)} target="_blank" rel="noreferrer" className="text-primary-accent hover:underline break-all">{String(m.referenceUrl)}</a></span>
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          description = 'created this card';
                        }
                        break;
                      case 'CARD_UPDATED':
                        description = 'updated the card';
                        break;
                      case 'CARD_RENAMED':
                        description = (
                          <span>
                            renamed card from{' '}
                            <em className="text-secondary">
                              "{String(m.from)}"
                            </em>{' '}
                            to{' '}
                            <em className="text-primary">
                              "{String(m.to)}"
                            </em>
                          </span>
                        );
                        break;
                      case 'CARD_DESCRIPTION_UPDATED':
                        description = 'updated the description';
                        break;
                      case 'CARD_MOVED':
                        description = 'moved the card to another column';
                        break;
                      case 'CARD_DELETED':
                        description = 'deleted the card';
                        break;
                      case 'COMMENT_ADDED':
                        description = 'added a comment';
                        break;
                      case 'COMPLEXITY_CHANGED':
                        description = <span>changed complexity from <strong className="text-primary">{String(m.from ?? 'Unset')}</strong> to <strong className="text-primary">{String(m.to ?? 'Unset')}</strong></span>;
                        break;
                      case 'ASSIGNMENT_CHANGED':
                        description = <span>changed assignee from <strong className="text-primary">{String(m.from ?? 'Unassigned')}</strong> to <strong className="text-primary">{String(m.to ?? 'Unassigned')}</strong></span>;
                        break;
                      case 'AI_COMPLEXITY_ACCEPTED':
                        description = m.title ? String(m.title) : 'accepted AI complexity suggestion';
                        break;
                      case 'AI_COMPLEXITY_OVERRIDDEN':
                        description = m.title ? String(m.title) : 'overrode AI complexity suggestion';
                        break;
                      default:
                        description = log.type.replace(/_/g, ' ').toLowerCase();
                    }

                    return (
                      <div key={log.id} className="flex flex-col py-4 border-b border last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-elevated text-primary border border font-bold text-xs shrink-0">
                            {actor.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-sm text-primary">{actor}</span>
                        </div>
                        <div className="text-sm text-secondary ml-8 mb-2 whitespace-normal break-words">
                          {description}
                        </div>
                        <div className="text-xs text-muted ml-8">
                          {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-background flex justify-between items-center">
            {activeTab === 'details' ? (
              <>
                <div>
                  {canDelete && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-status-danger hover:text-status-danger font-medium text-sm"
                    >
                      Delete Card
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isEditing ? (
                    canEdit && (
                      <button onClick={() => setIsEditing(true)} className="bg-elevated text-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-elevated">
                        Edit
                      </button>
                    )
                  ) : (
                    <>
                      <button onClick={() => {
                        setIsEditing(false);
                        setEditTitle(snapshotCard.title);
                        setEditDesc(snapshotCard.description || '');
                        setEditComplexity(snapshotCard.complexity || '');
                        setEditAssignee(snapshotCard.assigneeId || '');
                      }} className="text-secondary hover:text-primary px-4 py-2 text-sm font-medium">
                        Cancel
                      </button>
                      <button onClick={handleSave} className="bg-primary text-inverse px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-hover text-inverse">
                        Save
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <button onClick={onClose} className="bg-elevated text-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-elevated">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {conflictError && (
        <div className="fixed inset-0 bg-surface/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-surface border shadow-2xl rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-status-danger mb-2 flex items-center gap-2">
              <span><AlertTriangle className="w-4 h-4 inline-block mr-1 text-status-warning" /></span> Version Conflict
            </h3>
            <p className="text-secondary mb-4">{conflictError.message}</p>
            
            <div className="bg-background border rounded-xl p-3 mb-4 text-sm font-mono space-y-2">
              <div>Your version: v{snapshotCard.version}</div>
              <div>Latest version: v{conflictError.latestCard?.version || '?'}</div>
              {snapshotCard.updatedAt && <div>Your timestamp: {new Date(snapshotCard.updatedAt).toLocaleString()}</div>}
              {conflictError.latestCard?.updatedAt && <div>Latest timestamp: {new Date(conflictError.latestCard.updatedAt).toLocaleString()}</div>}
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  if (conflictError.latestCard) {
                    setSnapshotCard(conflictError.latestCard);
                    setEditTitle(conflictError.latestCard.title);
                    setEditDesc(conflictError.latestCard.description || '');
                    setEditComplexity(conflictError.latestCard.complexity || '');
                    setEditAssignee(conflictError.latestCard.assigneeId || '');
                  }
                  setConflictError(null);
                }}
                className="bg-primary text-inverse py-2 rounded-xl font-medium hover:bg-primary-hover text-inverse w-full"
              >
                Reload Latest Version
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Title: ${editTitle}\n\nDescription:\n${editDesc}`
                  );
                  addToast("Copied unsaved changes to clipboard", "success");
                }}
                className="bg-elevated text-primary py-2 rounded-xl font-medium hover:bg-elevated border w-full"
              >
                Copy My Unsaved Changes
              </button>
              <button 
                onClick={() => setConflictError(null)}
                className="text-muted hover:text-secondary py-2 text-sm font-medium w-full mt-2"
              >
                Continue Editing (Discard Warning)
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Card"
        message={`Are you sure you want to delete the card "${snapshotCard.title}"?`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Delete"
      />
    </>
  );
}
