import { useEffect, useState } from 'react';
import { useBoardStore } from '../stores/boardStore';
import { useToastStore } from '../stores/toastStore';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function DashboardPage(): React.ReactElement {
  const { boards, fetchBoards, createBoard, updateBoard, deleteBoard, isLoading } = useBoardStore();
  const { addToast } = useToastStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [boardToDelete, setBoardToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

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
      await createBoard(trimmedName);
      setNewBoardName('');
      setIsCreating(false);
      addToast('Board created', 'success');
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleRename = async (id: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      addToast('Board name is required', 'error');
      return;
    }
    if (trimmedName.length > 100) {
      addToast('Board name must be 100 characters or fewer', 'error');
      return;
    }
    try {
      await updateBoard(id, trimmedName);
      setEditingId(null);
      addToast('Board renamed', 'success');
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Your Boards</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition"
        >
          Create Board
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Board</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Board Name"
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                autoFocus
                maxLength={100}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">
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
        <div className="text-center py-12 text-gray-500">
          No boards yet. Create one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boards.map((board) => (
            <div key={board.id} className="bg-white p-6 rounded shadow border border-gray-200 flex flex-col">
              {editingId === board.id ? (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 border p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    maxLength={100}
                  />
                  <button onClick={() => handleRename(board.id)} className="text-green-600 font-medium hover:underline">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-gray-500 font-medium hover:underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-start mb-4 overflow-hidden">
                  <h2 className="text-xl font-bold text-gray-800 truncate pr-2" title={board.name}>
                    {board.name}
                  </h2>
                </div>
              )}

              <div className="text-sm text-gray-500 mb-6 flex-1">
                Created {new Date(board.createdAt).toLocaleDateString()}
              </div>

              <div className="flex justify-between items-center mt-auto border-t pt-4">
                <Link to={`/boards/${board.id}`} className="text-blue-600 font-medium hover:underline">
                  Open Board
                </Link>
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => {
                      setEditingId(board.id);
                      setEditingName(board.name);
                    }}
                    className="text-gray-500 hover:text-blue-600 font-medium"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(board.id, board.name)}
                    className="text-red-500 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
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
