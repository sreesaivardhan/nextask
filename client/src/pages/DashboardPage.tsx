import { useEffect, useState } from 'react';
import { useBoardStore } from '../stores/boardStore';
import { useToastStore } from '../stores/toastStore';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { socketService } from '../services/socketService';
import { useSessionStore } from '../stores/sessionStore';
import { LayoutTemplate, Rocket, Route, Bug, CalendarDays, CheckSquare } from 'lucide-react';

export function DashboardPage(): React.ReactElement {
  const { boards, fetchBoards, createBoard, updateBoard, deleteBoard, isLoading,
    socketAddBoard, socketUpdateBoard, socketRemoveBoard } = useBoardStore();
  const { addToast } = useToastStore();
  const { user } = useSessionStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Blank Board');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingSprintEndDate, setEditingSprintEndDate] = useState<string>('');
  const [editingComplexityMax, setEditingComplexityMax] = useState<number | ''>(5);
  const [boardToDelete, setBoardToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // ── Socket listeners for dashboard real-time sync ─────────────────────────
  // The server emits these to the user:${userId} room which the socket auto-joins
  // on connection (server reads userId from the session).
  useEffect(() => {
    if (!user) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const onBoardCreated = (board: Parameters<typeof socketAddBoard>[0]) => {
      socketAddBoard(board);
    };
    const onBoardUpdated = (board: Parameters<typeof socketUpdateBoard>[0]) => {
      socketUpdateBoard(board);
    };
    const onBoardDeleted = ({ boardId }: { boardId: string }) => {
      socketRemoveBoard(boardId);
    };
    const onMembershipChanged = () => {
      fetchBoards();
    };

    socket.on('board:created', onBoardCreated);
    socket.on('board:updated', onBoardUpdated);
    socket.on('board:deleted', onBoardDeleted);
    socket.on('board:membership_changed', onMembershipChanged);

    return () => {
      socket.off('board:created', onBoardCreated);
      socket.off('board:updated', onBoardUpdated);
      socket.off('board:deleted', onBoardDeleted);
      socket.off('board:membership_changed', onMembershipChanged);
    };
  }, [user, socketAddBoard, socketUpdateBoard, socketRemoveBoard, fetchBoards]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newBoardName.trim();
    if (!trimmedName) {
      addToast('Board name is required', 'error');
      return;
    }
    if (trimmedName.length > 100) {
      addToast('Board name must be 100 characters or fewer', 'error');
      return;
    }
    try {
      await createBoard(trimmedName, selectedTemplate);
      setNewBoardName('');
      setSelectedTemplate('Blank Board');
      setIsCreating(false);
      addToast('Board created', 'success');
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleUpdateBoard = async (id: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      addToast('Board name is required', 'error');
      return;
    }
    if (trimmedName.length > 100) {
      addToast('Board name must be 100 characters or fewer', 'error');
      return;
    }

    let sprintEndDateISO: string | null = null;
    if (editingSprintEndDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = editingSprintEndDate.split('-').map(Number);
      const localSelectedDate = new Date(y, m - 1, d);
      
      if (localSelectedDate < today) {
        addToast('Sprint end date cannot be in the past', 'error');
        return;
      }
      sprintEndDateISO = localSelectedDate.toISOString();
    }

    let parsedComplexity = 5;
    if (editingComplexityMax !== '') {
      parsedComplexity = Number(editingComplexityMax);
      if (!Number.isInteger(parsedComplexity) || parsedComplexity < 1 || parsedComplexity > 10) {
        addToast('Complexity threshold must be an integer between 1 and 10', 'error');
        return;
      }
    }

    try {
      await updateBoard(id, { 
        name: trimmedName,
        sprintEndDate: sprintEndDateISO,
        complexityMax: parsedComplexity
      });
      setEditingId(null);
      addToast('Board settings saved', 'success');
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleDelete = (id: string, name: string) => {
    setBoardToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!boardToDelete) return;
    try {
      await deleteBoard(boardToDelete.id);
      addToast('Board deleted', 'success');
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    } finally {
      setBoardToDelete(null);
    }
  };

  const ownedBoards = boards.filter(b => b.ownerId === user?.id);
  const sharedBoards = boards.filter(b => b.ownerId !== user?.id);

  const renderBoardCard = (board: import('../stores/boardStore').Board) => (
    <div key={board.id} className="bg-surface p-6 rounded-xl shadow border border flex flex-col">
      {editingId === board.id ? (
        <div className="flex flex-col gap-3 mb-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Board Name</label>
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="w-full border p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none text-sm"
              autoFocus
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Sprint End Date</label>
              <input
                type="date"
                value={editingSprintEndDate}
                onChange={(e) => setEditingSprintEndDate(e.target.value)}
                className="w-full border p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Max Complexity (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={editingComplexityMax}
                onChange={(e) => setEditingComplexityMax(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-secondary hover:text-primary font-medium text-sm">
              Cancel
            </button>
            <button onClick={() => handleUpdateBoard(board.id)} className="bg-primary text-inverse px-3 py-1.5 rounded-xl font-medium hover:bg-primary-hover transition-colors text-sm">
              Save Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start mb-4 overflow-hidden">
          <h2 className="text-xl font-bold text-primary truncate pr-2" title={board.name}>
            {board.name}
          </h2>
        </div>
      )}

      <div className="text-sm text-muted mb-6 flex-1">
        Created {new Date(board.createdAt).toLocaleDateString()}
      </div>

      <div className="flex justify-between items-center mt-auto border-t pt-4">
        <Link to={`/boards/${board.id}`} className="text-primary-accent font-medium hover:underline">
          Open Board
        </Link>
        <div className="flex gap-3 text-sm">
          {board.ownerId === user?.id && (
            <>
              <button
                onClick={() => {
                  setEditingId(board.id);
                  setEditingName(board.name);
                  setEditingSprintEndDate(board.sprintEndDate ? new Date(board.sprintEndDate).toISOString().split('T')[0] : '');
                  setEditingComplexityMax(board.complexityMax ?? 5);
                }}
                className="text-secondary hover:text-primary font-medium border border rounded-lg px-2.5 py-1 text-xs hover:bg-elevated transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => handleDelete(board.id, board.name)}
                className="text-status-danger hover:text-status-danger font-medium"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Your Boards</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-primary text-inverse px-4 py-2 rounded-xl font-medium hover:bg-primary-hover text-inverse transition"
        >
          Create Board
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-surface p-6 rounded-xl shadow-floating border border-strong w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4 shrink-0">Create Board</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-6 overflow-y-auto pl-2 -ml-2 pr-2 pb-2">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Board Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Roadmap"
                  className="w-full border p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  autoFocus
                  maxLength={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary mb-3">Choose Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: 'Blank Board', icon: LayoutTemplate, desc: 'Start from scratch with an empty board.' },
                    { name: 'Software Sprint', icon: Rocket, desc: 'Agile workflow with backlog, review and done columns.' },
                    { name: 'Product Roadmap', icon: Route, desc: 'High-level planning and tracking.' },
                    { name: 'Bug Tracker', icon: Bug, desc: 'Manage and squash issues.' },
                    { name: 'Content Calendar', icon: CalendarDays, desc: 'Schedule and organize posts.' },
                    { name: 'Personal Planner', icon: CheckSquare, desc: 'Track your daily personal tasks.' }
                  ].map(tpl => {
                    const isSelected = selectedTemplate === tpl.name;
                    return (
                      <div 
                        key={tpl.name}
                        onClick={() => setSelectedTemplate(tpl.name)}
                        className={`cursor-pointer border rounded-2xl p-4 flex gap-4 transition-all duration-200 ease-in-out h-full ${
                          isSelected 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm scale-[1.02]' 
                            : 'border-strong bg-surface hover:border-primary/40 hover:bg-elevated hover:shadow-sm'
                        }`}
                      >
                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-colors duration-200 ${
                          isSelected ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-secondary'
                        }`}>
                          <tpl.icon size={20} strokeWidth={2} />
                        </div>
                        <div className="flex flex-col justify-center">
                          <div className="font-bold text-sm text-primary">
                            {tpl.name}
                          </div>
                          <div className="text-[13px] text-muted mt-1 leading-snug">
                            {tpl.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-secondary hover:text-primary font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-primary text-inverse px-5 py-2 rounded-xl font-medium hover:bg-primary-hover text-inverse">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div>Loading boards...</div>
      ) : boards.length === 0 ? (
        <div className="text-center py-12 text-muted">
          No boards yet. Create one to get started!
        </div>
      ) : (
        <div className="space-y-8">
          {ownedBoards.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-secondary mb-4 border-b pb-2">Owned Boards</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownedBoards.map(renderBoardCard)}
              </div>
            </div>
          )}
          {sharedBoards.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-secondary mb-4 border-b pb-2">Shared Boards</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sharedBoards.map(renderBoardCard)}
              </div>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        isOpen={boardToDelete !== null}
        title="Delete Board"
        message={`Are you sure you want to delete the board "${boardToDelete?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setBoardToDelete(null)}
        confirmText="Delete"
      />
    </div>
  );
}
