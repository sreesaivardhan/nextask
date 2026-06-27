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
}

export function CardModal({ card, isOpen, onClose, boardId, boardComplexityMax = 5 }: CardModalProps): React.ReactElement | null {
  const { updateCard, deleteCard } = useCardStore();
  const { comments, fetchComments, createComment, deleteComment } = useCommentStore();
  const { activities, fetchActivity } = useActivityStore();
  const { addToast } = useToastStore();
  const { members, fetchMembers } = useBoardMemberStore();
  const { user } = useSessionStore();

  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const boardMembers = card ? (members[card.boardId] || []) : [];

  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editComplexity, setEditComplexity] = useState<number | ''>('');
  const [editAssignee, setEditAssignee] = useState('');

  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conflictError, setConflictError] = useState<{ message: string; latestCard: Card | null } | null>(null);

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
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card?.id]);

  if (!isOpen || !snapshotCard) return null;

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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b flex justify-between items-start bg-gray-50">
            <div className="flex-1 min-w-0 pr-4">
              {!isEditing ? (
                <h2 className="text-xl font-bold text-gray-800 break-words whitespace-normal">{snapshotCard.title}</h2>
              ) : (
                <input
                  type="text"
                  className="w-full border p-2 rounded text-xl font-bold"
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
              <div className="text-xs text-gray-400 mt-2">v{snapshotCard.version} • Created {new Date(snapshotCard.createdAt).toLocaleString()}</div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none shrink-0">&times;</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6 bg-white">
            <button
              className={`py-3 px-4 font-medium border-b-2 ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              className={`py-3 px-4 font-medium border-b-2 flex items-center gap-2 ${activeTab === 'comments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('comments')}
            >
              Comments <span className="bg-gray-200 text-gray-600 text-xs py-0.5 px-2 rounded-full">{cardComments.length}</span>
            </button>
            <button
              className={`py-3 px-4 font-medium border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white min-h-[300px]">
            {activeTab === 'details' && (
              <div className="flex flex-col gap-4">
                {!isEditing ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4 bg-gray-50 p-4 rounded border">
                      <div>
                        <span className="text-gray-500 block mb-1">Assignee</span>
                        <span className="font-medium text-gray-800">
                          {snapshotCard.assigneeId
                            ? (boardMembers.find((m) => m.userId === snapshotCard.assigneeId)?.user.displayName ?? snapshotCard.assigneeId)
                            : 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">Complexity</span>
                        <span className="font-medium text-gray-800">{snapshotCard.complexity || 'Unestimated'}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-700 mb-2">Description</h3>
                      {snapshotCard.description ? (
                        <p className="whitespace-pre-wrap text-gray-600 text-sm">{snapshotCard.description}</p>
                      ) : (
                        <p className="text-gray-400 italic text-sm">No description provided.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Assignee</label>
                        <select
                          className="w-full border p-2 rounded bg-white"
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
                        <label className="block text-sm font-bold text-gray-700 mb-1">Complexity (1-{boardComplexityMax})</label>
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
                      <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                      <textarea
                        className="w-full border p-2 rounded min-h-[150px]"
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
                    <div className="text-gray-500 text-center py-8 italic text-sm">No comments yet.</div>
                  ) : (
                    cardComments.map(comment => (
                      <div key={comment.id} className="bg-gray-50 p-3 rounded border">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm text-gray-800">{comment.user.displayName}</span>
                          <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>
                        <button 
                          onClick={() => deleteComment(comment.id, snapshotCard.id, snapshotCard.boardId)}
                          className="text-xs text-red-500 hover:text-red-700 mt-2"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t">
                  <input
                    type="text"
                    className="flex-1 border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    maxLength={1000}
                  />
                  <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
                    Send
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex flex-col space-y-3">
                {cardHistory.length === 0 ? (
                  <div className="text-gray-500 text-center py-8 italic text-sm">No activity recorded.</div>
                ) : (
                  cardHistory.map(log => {
                    const actor = log.user?.displayName || 'System';
                    const m = log.metadata || {};
                    let description: React.ReactNode = null;

                    switch (log.type) {
                      case 'CARD_CREATED':
                        description = 'created this card';
                        break;
                      case 'CARD_UPDATED':
                        description = 'updated the card';
                        break;
                      case 'CARD_RENAMED':
                        description = (
                          <span>
                            renamed card from{' '}
                            <em className="inline-block max-w-[120px] truncate align-bottom" title={String(m.from)}>
                              "{String(m.from)}"
                            </em>{' '}
                            to{' '}
                            <em className="inline-block max-w-[120px] truncate align-bottom" title={String(m.to)}>
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
                        description = <span>changed complexity from <strong>{String(m.from ?? 'Unset')}</strong> to <strong>{String(m.to ?? 'Unset')}</strong></span>;
                        break;
                      case 'ASSIGNMENT_CHANGED':
                        description = <span>changed assignee from <strong>{String(m.from ?? 'Unassigned')}</strong> to <strong>{String(m.to ?? 'Unassigned')}</strong></span>;
                        break;
                      default:
                        description = log.type.replace(/_/g, ' ').toLowerCase();
                    }

                    return (
                      <div key={log.id} className="flex gap-3 text-sm py-2 border-b last:border-0">
                        <div className="shrink-0 text-gray-400 text-xs whitespace-nowrap pt-0.5 w-28">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                        <div className="flex-1 text-gray-700">
                          <span className="font-semibold text-gray-800">{actor}</span>{' '}
                          {description}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
            {activeTab === 'details' ? (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-700 font-medium text-sm"
                >
                  Delete Card
                </button>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">
                      Edit
                    </button>
                  ) : (
                    <>
                      <button onClick={() => {
                        setIsEditing(false);
                        setEditTitle(snapshotCard.title);
                        setEditDesc(snapshotCard.description || '');
                        setEditComplexity(snapshotCard.complexity || '');
                        setEditAssignee(snapshotCard.assigneeId || '');
                      }} className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium">
                        Cancel
                      </button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                        Save
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {conflictError && (
        <div className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white border shadow-2xl rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
              <span>⚠️</span> Version Conflict
            </h3>
            <p className="text-gray-700 mb-4">{conflictError.message}</p>
            
            <div className="bg-gray-50 border rounded p-3 mb-4 text-sm font-mono space-y-2">
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
                className="bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 w-full"
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
                className="bg-gray-100 text-gray-800 py-2 rounded font-medium hover:bg-gray-200 border w-full"
              >
                Copy My Unsaved Changes
              </button>
              <button 
                onClick={() => setConflictError(null)}
                className="text-gray-500 hover:text-gray-700 py-2 text-sm font-medium w-full mt-2"
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
