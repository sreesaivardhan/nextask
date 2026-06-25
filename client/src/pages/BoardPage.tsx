import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useColumnStore } from '../stores/columnStore';
import { useBoardStore } from '../stores/boardStore';
import { useToastStore } from '../stores/toastStore';
import { io, Socket } from 'socket.io-client';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function BoardPage(): React.ReactElement {
  const { boardId } = useParams<{ boardId: string }>();
  const { columns, fetchColumns, createColumn, updateColumn, deleteColumn, reorderColumn, isLoading } = useColumnStore();
  const { boards, fetchBoards } = useBoardStore();
  const { addToast } = useToastStore();
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [columnToDelete, setColumnToDelete] = useState<{ id: string; name: string } | null>(null);
  
  const board = boards.find((b) => b.id === boardId);

  useEffect(() => {
    if (boards.length === 0) {
      fetchBoards();
    }
    if (boardId) {
      fetchColumns(boardId);
    }
  }, [boardId, boards.length, fetchBoards, fetchColumns]);

  // Socket.io board room join
  useEffect(() => {
    if (!boardId) return;
    
    // In Sprint 1, we just ensure connection and join room. No events handled.
    const socket: Socket = io({
      path: '/socket.io',
      withCredentials: true
    });
    
    socket.emit('board:join', { boardId });
    
    return () => {
      socket.emit('board:leave', { boardId });
      socket.disconnect();
    };
  }, [boardId]);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardId) return;
    if (!newColumnName.trim()) {
      addToast('Column name is required', 'error');
      return;
    }
    try {
      await createColumn(boardId, newColumnName);
      setNewColumnName('');
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleRenameColumn = async (columnId: string) => {
    if (!boardId) return;
    if (!editingColumnName.trim()) {
      addToast('Column name is required', 'error');
      return;
    }
    try {
      await updateColumn(boardId, columnId, editingColumnName);
      setEditingColumnId(null);
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleDeleteColumn = (columnId: string, name: string) => {
    setColumnToDelete({ id: columnId, name });
  };

  const confirmDeleteColumn = async () => {
    if (!boardId || !columnToDelete) return;
    try {
      await deleteColumn(boardId, columnToDelete.id);
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    } finally {
      setColumnToDelete(null);
    }
  };

  const handleMoveLeft = async (index: number) => {
    if (!boardId || index === 0) return;
    const current = columns[index];
    const left = columns[index - 1];
    const prevLeft = index > 1 ? columns[index - 2] : null;
    
    const newPosition = prevLeft ? (left.position + prevLeft.position) / 2 : left.position - 65535;
    
    try {
      await reorderColumn(boardId, current.id, newPosition);
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleMoveRight = async (index: number) => {
    if (!boardId || index === columns.length - 1) return;
    const current = columns[index];
    const right = columns[index + 1];
    const nextRight = index < columns.length - 2 ? columns[index + 2] : null;
    
    const newPosition = nextRight ? (right.position + nextRight.position) / 2 : right.position + 65535;
    
    try {
      await reorderColumn(boardId, current.id, newPosition);
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  if (!board && !isLoading) {
    return <div className="p-6">Loading board...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 break-words">{board?.name}</h1>
      </div>

      <div className="flex-1 overflow-x-auto p-6 flex gap-6 items-start bg-gray-50 min-h-0">
        {columns.map((column, index) => (
          <div key={column.id} className="bg-gray-100 rounded w-80 flex-shrink-0 flex flex-col max-h-full">
            <div className="p-3 bg-gray-200 border-b border-gray-300 rounded-t flex justify-between items-center group">
              {editingColumnId === column.id ? (
                <div className="flex gap-2 w-full">
                  <input
                    type="text"
                    value={editingColumnName}
                    onChange={(e) => setEditingColumnName(e.target.value)}
                    className="flex-1 border p-1 rounded text-sm min-w-0"
                    autoFocus
                    maxLength={100}
                  />
                  <button onClick={() => handleRenameColumn(column.id)} className="text-green-600 text-sm font-medium">
                    Save
                  </button>
                  <button onClick={() => setEditingColumnId(null)} className="text-gray-500 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-gray-700 truncate mr-2" title={column.name}>{column.name}</h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleMoveLeft(index)} disabled={index === 0} className="text-gray-500 hover:text-blue-600 disabled:opacity-30" title="Move Left">&larr;</button>
                    <button onClick={() => handleMoveRight(index)} disabled={index === columns.length - 1} className="text-gray-500 hover:text-blue-600 disabled:opacity-30" title="Move Right">&rarr;</button>
                    <button onClick={() => { setEditingColumnId(column.id); setEditingColumnName(column.name); }} className="text-gray-500 hover:text-blue-600 text-sm" title="Rename">✎</button>
                    <button onClick={() => handleDeleteColumn(column.id, column.name)} className="text-red-400 hover:text-red-600 text-sm" title="Delete">✕</button>
                  </div>
                </>
              )}
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              {/* Cards will go here later */}
              <div className="text-sm text-gray-400 italic text-center py-4">No cards yet</div>
            </div>
          </div>
        ))}

        <div className="bg-gray-100 rounded w-80 flex-shrink-0 p-3">
          <form onSubmit={handleCreateColumn} className="flex gap-2">
            <input
              type="text"
              placeholder="New column name..."
              className="flex-1 border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              maxLength={100}
            />
            <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded font-medium hover:bg-blue-700 text-sm">
              Add
            </button>
          </form>
        </div>
      </div>
      <ConfirmDialog
        isOpen={columnToDelete !== null}
        title="Delete Column"
        message={`Are you sure you want to delete the column "${columnToDelete?.name}"?`}
        onConfirm={confirmDeleteColumn}
        onCancel={() => setColumnToDelete(null)}
        confirmText="Delete"
      />
    </div>
  );
}
