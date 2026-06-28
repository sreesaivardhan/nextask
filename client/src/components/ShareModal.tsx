import { useState, useEffect } from 'react';
import { useBoardMemberStore } from '../stores/boardMemberStore';
import { useUserStore } from '../stores/userStore';
import { useSessionStore } from '../stores/sessionStore';
import { useToastStore } from '../stores/toastStore';

interface ShareModalProps {
  boardId: string;
  onClose: () => void;
  currentUserRole: string;
}

const ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];
const ROLE_WEIGHT = { OWNER: 1, ADMIN: 2, MEMBER: 3, VIEWER: 4 };

export function ShareModal({ boardId, onClose, currentUserRole }: ShareModalProps) {
  const { members, addMember, updateRole, removeMember } = useBoardMemberStore();
  const { searchResults, searchUsers, clearSearch, isSearching } = useUserStore();
  const { user } = useSessionStore();
  const { addToast } = useToastStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const boardMembers = members[boardId] || [];

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery) {
      searchUsers(debouncedQuery, boardId);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, boardId, searchUsers, clearSearch]);

  const sortedMembers = [...boardMembers].sort((a, b) => {
    const w1 = ROLE_WEIGHT[a.role as keyof typeof ROLE_WEIGHT] || 99;
    const w2 = ROLE_WEIGHT[b.role as keyof typeof ROLE_WEIGHT] || 99;
    return w1 - w2;
  });

  const canManageRole = (targetRole: string) => {
    if (currentUserRole === 'OWNER') return targetRole !== 'OWNER';
    if (currentUserRole === 'ADMIN') return ['MEMBER', 'VIEWER'].includes(targetRole);
    return false;
  };

  const handleInvite = async (userId: string, role: string = 'MEMBER') => {
    try {
      await addMember(boardId, userId, role);
      addToast('User invited', 'success');
      setSearchQuery('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      addToast(error.response?.data?.error || error.message, 'error');
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await updateRole(boardId, userId, role);
      addToast('Role updated', 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      addToast(error.response?.data?.error || error.message, 'error');
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMember(boardId, userId);
      addToast('Member removed', 'success');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      addToast(error.response?.data?.error || error.message, 'error');
    }
  };

  const canInvite = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-floating w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Share Board</h2>
          <button onClick={onClose} className="text-muted hover:text-secondary font-bold">&times;</button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {canInvite && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-secondary mb-1">Invite Members</label>
              <input
                type="text"
                className="w-full border rounded-xl p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              {searchQuery && (
                <div className="mt-2 bg-background border rounded-xl max-h-40 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-2 text-sm text-muted">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((su) => (
                      <div key={su.id} className="p-2 flex justify-between items-center border-b last:border-0 hover:bg-elevated">
                        <div>
                          <div className="text-sm font-medium">{su.displayName}</div>
                          <div className="text-xs text-muted">{su.email || ''}</div>
                        </div>
                        <button
                          onClick={() => handleInvite(su.id)}
                          className="text-primary-accent font-medium text-sm hover:underline"
                        >
                          Invite
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted">No users found.</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-secondary mb-2">Members ({boardMembers.length})</h3>
            <div className="space-y-3">
              {sortedMembers.map((m) => {
                const isMe = m.userId === user?.id;
                const manageable = !isMe && canManageRole(m.role);

                return (
                  <div key={m.userId} className="flex justify-between items-center bg-background p-2 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary-accent flex items-center justify-center font-bold text-sm">
                        {m.user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {m.user.displayName} {isMe && '(You)'}
                        </div>
                        <div className="text-xs text-muted">{m.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {manageable ? (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                            className="text-sm border rounded-xl p-1"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r} disabled={!canManageRole(r)}>{r}</option>
                            ))}
                          </select>
                          <button onClick={() => handleRemove(m.userId)} className="text-status-danger text-sm hover:underline">
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="text-xs bg-elevated px-2 py-1 rounded-xl text-secondary font-medium">{m.role}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end bg-background rounded-b-lg">
          <button
            onClick={onClose}
            className="bg-elevated text-primary px-4 py-2 rounded-xl font-medium hover:bg-elevated"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
