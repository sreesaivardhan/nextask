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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Share Board</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold">&times;</button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {canInvite && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Invite Members</label>
              <input
                type="text"
                className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              {searchQuery && (
                <div className="mt-2 bg-gray-50 border rounded max-h-40 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-2 text-sm text-gray-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((su) => (
                      <div key={su.id} className="p-2 flex justify-between items-center border-b last:border-0 hover:bg-gray-100">
                        <div>
                          <div className="text-sm font-medium">{su.displayName}</div>
                          <div className="text-xs text-gray-500">{su.email || ''}</div>
                        </div>
                        <button
                          onClick={() => handleInvite(su.id)}
                          className="text-blue-600 font-medium text-sm hover:underline"
                        >
                          Invite
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-gray-500">No users found.</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Members ({boardMembers.length})</h3>
            <div className="space-y-3">
              {sortedMembers.map((m) => {
                const isMe = m.userId === user?.id;
                const manageable = !isMe && canManageRole(m.role);

                return (
                  <div key={m.userId} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {m.user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {m.user.displayName} {isMe && '(You)'}
                        </div>
                        <div className="text-xs text-gray-500">{m.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {manageable ? (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                            className="text-sm border rounded p-1"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r} disabled={!canManageRole(r)}>{r}</option>
                            ))}
                          </select>
                          <button onClick={() => handleRemove(m.userId)} className="text-red-500 text-sm hover:underline">
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium">{m.role}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-medium hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
