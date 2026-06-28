import { Edit2 , X } from 'lucide-react';
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
      className={`bg-elevated rounded-xl w-80 flex-shrink-0 flex flex-col max-h-full border border transition duration-150 ${isOver ? 'border-primary ring-1 ring-primary/20' : 'border-strong shadow-subtle'}`}
    >
      <div className="px-4 py-3 bg-elevated border-b border-strong rounded-t-xl flex justify-between items-center group">
        {editingColumnId === columnId ? (
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={editingColumnName}
              onChange={(e) => setEditingColumnName(e.target.value)}
              className="flex-1 bg-surface border border-primary px-2 py-1 rounded-md text-sm min-w-0 focus:outline-none"
              autoFocus
              maxLength={100}
            />
            <button onClick={() => handleRenameColumn(columnId)} className="text-status-success text-sm font-semibold hover:opacity-80">
              Save
            </button>
            <button onClick={() => setEditingColumnId(null)} className="text-muted text-sm font-semibold hover:text-secondary">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-primary truncate flex-1 mr-2 tracking-tight" title={columnName}>
              {columnName}
            </h3>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={handleMoveLeft} disabled={isFirst} className="p-1 text-muted hover:text-primary hover:bg-surface rounded disabled:opacity-30 transition duration-150" title="Move Left">&larr;</button>
              <button onClick={handleMoveRight} disabled={isLast} className="p-1 text-muted hover:text-primary hover:bg-surface rounded disabled:opacity-30 transition duration-150" title="Move Right">&rarr;</button>
              <button onClick={() => { setEditingColumnId(columnId); setEditingColumnName(columnName); }} className="p-1 text-muted hover:text-primary hover:bg-surface rounded transition duration-150" title="Rename"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={handleDeleteColumn} className="p-1 text-status-danger hover:bg-status-danger hover:bg-opacity-10 rounded transition duration-150" title="Delete"><X className="w-3.5 h-3.5" /></button>
            </div>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`p-3 flex-1 overflow-y-auto flex flex-col gap-3 transition-colors ${
          isOver ? 'bg-surface' : ''
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
          <form onSubmit={(e) => handleCreateCard(e, columnId)} className="mt-1 pb-1">
            <input
              type="text"
              placeholder="Add a card..."
              className="w-full border border-strong px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface placeholder-muted shadow-subtle transition duration-150"
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
