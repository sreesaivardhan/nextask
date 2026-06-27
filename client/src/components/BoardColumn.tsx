import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCard } from './SortableCard';
import type { Card } from '../stores/cardStore';

interface BoardColumnProps {
  columnId: string;
  columnName: string;
  cards: Card[];
  editingColumnId: string | null;
  editingColumnName: string;
  setEditingColumnName: (name: string) => void;
  handleRenameColumn: (columnId: string) => void;
  setEditingColumnId: (id: string | null) => void;
  handleMoveLeft?: () => void;
  handleMoveRight?: () => void;
  isFirst: boolean;
  isLast: boolean;
  handleDeleteColumn?: () => void;
  setSelectedCard: (card: Card) => void;
  typingUsers: Record<string, string>;
  boardMemberMap: Record<string, Array<{ userId: string; user: { displayName: string } }>>;
  boardId?: string;
  newCardTitle: string;
  handleCardInputChange: (columnId: string, value: string) => void;
  handleCreateCard?: (e: React.FormEvent, columnId: string) => void;
}

export function BoardColumn({
  columnId,
  columnName,
  cards,
  editingColumnId,
  editingColumnName,
  setEditingColumnName,
  handleRenameColumn,
  setEditingColumnId,
  handleMoveLeft,
  handleMoveRight,
  isFirst,
  isLast,
  handleDeleteColumn,
  setSelectedCard,
  typingUsers,
  boardMemberMap,
  boardId,
  newCardTitle,
  handleCardInputChange,
  handleCreateCard,
}: BoardColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
      type: 'Column',
      columnId,
    },
  });

  const ids = cards.map(c => c.id);
  if (new Set(ids).size !== ids.length) {
    console.error("Duplicate card detected in column " + columnName, ids);
  }

  return (
    <div
      ref={setNodeRef}
      className={`bg-gray-100 rounded w-80 flex-shrink-0 flex flex-col max-h-full ${isOver ? 'bg-blue-50/50 ring-2 ring-blue-500/20' : ''}`}
    >
      <div className="p-3 bg-gray-200 border-b border-gray-300 rounded-t flex justify-between items-center group">
        {editingColumnId === columnId ? (
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={editingColumnName}
              onChange={(e) => setEditingColumnName(e.target.value)}
              className="flex-1 border p-1 rounded text-sm min-w-0"
              autoFocus
              maxLength={100}
            />
            <button onClick={() => handleRenameColumn(columnId)} className="text-green-600 text-sm font-medium">
              Save
            </button>
            <button onClick={() => setEditingColumnId(null)} className="text-gray-500 text-sm font-medium">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-gray-700 truncate flex-1 mr-2" title={columnName}>
              {columnName}
            </h3>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={handleMoveLeft} disabled={isFirst} className="text-gray-500 hover:text-blue-600 disabled:opacity-30" title="Move Left">&larr;</button>
              <button onClick={handleMoveRight} disabled={isLast} className="text-gray-500 hover:text-blue-600 disabled:opacity-30" title="Move Right">&rarr;</button>
              <button onClick={() => { setEditingColumnId(columnId); setEditingColumnName(columnName); }} className="text-gray-500 hover:text-blue-600 text-sm" title="Rename">✎</button>
              <button onClick={handleDeleteColumn} className="text-red-400 hover:text-red-600 text-sm" title="Delete">✕</button>
            </div>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`p-3 flex-1 overflow-y-auto flex flex-col gap-2 transition-colors ${
          isOver ? 'bg-blue-50/50' : ''
        }`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => {
            const assigneeName = card.assigneeId && boardId
              ? boardMemberMap[boardId]?.find((m) => m.userId === card.assigneeId)?.user.displayName
              : undefined;

            return (
              <SortableCard
                key={card.id}
                card={card}
                typingUser={typingUsers[card.id]}
                assigneeName={assigneeName}
                onClick={() => setSelectedCard(card)}
              />
            );
          })}
        </SortableContext>

        {handleCreateCard && (
          <form onSubmit={(e) => handleCreateCard(e, columnId)} className="mt-2">
            <input
              type="text"
              placeholder="Add a card..."
              className="w-full border p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={newCardTitle || ''}
              onChange={(e) => handleCardInputChange(columnId, e.target.value)}
              maxLength={200}
            />
          </form>
        )}
      </div>
    </div>
  );
}
