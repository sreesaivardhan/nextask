import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useColumnStore } from '../stores/columnStore';
import { useBoardStore } from '../stores/boardStore';
import { useToastStore } from '../stores/toastStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCardStore, type Card } from '../stores/cardStore';
import { useCommentStore } from '../stores/commentStore';
import { useActivityStore } from '../stores/activityStore';
import { CardModal } from '../components/CardModal';
import { useBoardMemberStore } from '../stores/boardMemberStore';
import { socketService } from '../services/socketService';
import { useSessionStore } from '../stores/sessionStore';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { BoardColumn } from '../components/BoardColumn';
import { CardItem } from '../components/CardItem';

export function BoardPage(): React.ReactElement {
  const { boardId } = useParams<{ boardId: string }>();
  const { columns, fetchColumns, createColumn, updateColumn, deleteColumn, reorderColumn, isLoading,
    socketAddColumn, socketUpdateColumn, socketRemoveColumn, socketMoveColumn } = useColumnStore();
  const { boards, fetchBoards, socketUpdateBoard } = useBoardStore();
  const { addToast } = useToastStore();
  const { cards, fetchCards, createCard,
    socketAddCard, socketUpdateCard, socketRemoveCard, socketMoveCard } = useCardStore();
  const { socketAddComment, socketRemoveComment } = useCommentStore();
  const { socketAddActivity } = useActivityStore();
  const { members: boardMemberMap, fetchMembers } = useBoardMemberStore();
  const { user } = useSessionStore();

  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [columnToDelete, setColumnToDelete] = useState<{ id: string; name: string } | null>(null);

  const [newCardTitle, setNewCardTitle] = useState<{ [columnId: string]: string }>({});
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Drag and drop state
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  // Typing indicators: map of cardId → displayName
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const board = boards.find((b) => b.id === boardId);

  // ── Data fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (boards.length === 0) {
      fetchBoards();
    }
    if (boardId) {
      fetchColumns(boardId);
      fetchCards(boardId);
      fetchMembers(boardId);
    }
  }, [boardId, boards.length, fetchBoards, fetchColumns, fetchCards, fetchMembers]);

  // ── Socket.io room + event listeners ─────────────────────────────────────────
  // Track whether we've already done the initial connect to distinguish it from
  // a genuine reconnect (which needs a full REST refetch for missed events).
  const hasConnectedOnce = useRef(false);

  const handleReconnect = useCallback(() => {
    if (!boardId) return;
    // Rejoin board room (socketService handles idempotency per-connection).
    socketService.joinBoard(boardId);
    // Refetch full REST snapshot to catch any events we missed while offline.
    fetchColumns(boardId);
    fetchCards(boardId);
    fetchMembers(boardId);
  }, [boardId, fetchColumns, fetchCards, fetchMembers]);

  useEffect(() => {
    if (!boardId) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socketService.joinBoard(boardId);

    // connect fires on initial connect AND every reconnect.
    // Only do the full REST refetch on reconnect (we already fetched on mount).
    const onConnect = () => {
      if (!hasConnectedOnce.current) {
        // Initial connection: just join the room (joinBoard handles this via connect event in socketService).
        hasConnectedOnce.current = true;
      } else {
        // True reconnect: re-join + refetch.
        handleReconnect();
      }
    };

    // ── Board events ────────────────────────────────────────────────────────
    const onBoardUpdated = (board: Parameters<typeof socketUpdateBoard>[0]) => {
      socketUpdateBoard(board);
    };

    // ── Column events ───────────────────────────────────────────────────────
    const onColumnCreated = (col: Parameters<typeof socketAddColumn>[0]) => {
      socketAddColumn(col);
    };
    const onColumnUpdated = (col: Parameters<typeof socketUpdateColumn>[0]) => {
      socketUpdateColumn(col);
    };
    const onColumnDeleted = ({ columnId }: { columnId: string }) => {
      socketRemoveColumn(columnId);
    };
    const onColumnMoved = (col: Parameters<typeof socketMoveColumn>[0]) => {
      socketMoveColumn(col);
    };

    // ── Card events ─────────────────────────────────────────────────────────
    const onCardCreated = (card: Card) => {
      socketAddCard(card);
    };
    const onCardUpdated = (card: Card) => {
      socketUpdateCard(card);
    };
    const onCardDeleted = ({ cardId, columnId }: { cardId: string; columnId: string }) => {
      socketRemoveCard(cardId, columnId);
      setSelectedCard((prev) => (prev && prev.id === cardId ? null : prev));
    };
    const onCardMoved = (card: Card) => {
      socketMoveCard(card);
    };

    // ── Comment events ──────────────────────────────────────────────────────
    const onCommentCreated = (comment: Parameters<typeof socketAddComment>[0]) => {
      socketAddComment(comment);
    };
    const onCommentDeleted = ({ commentId, cardId }: { commentId: string; cardId: string }) => {
      socketRemoveComment(commentId, cardId);
    };

    // ── Activity events ─────────────────────────────────────────────────────
    const onActivityCreated = (log: Parameters<typeof socketAddActivity>[0]) => {
      socketAddActivity(log);
    };

    // ── Typing events ───────────────────────────────────────────────────────
    const onCardTyping = ({ cardId, displayName }: { cardId: string; displayName: string }) => {
      setTypingUsers((prev) => ({ ...prev, [cardId]: displayName }));
      // Clear existing timer for this card
      if (typingTimers.current[cardId]) clearTimeout(typingTimers.current[cardId]);
      // Auto-remove after 2s of inactivity
      typingTimers.current[cardId] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[cardId];
          return next;
        });
        delete typingTimers.current[cardId];
      }, 2000);
    };

    socket.on('connect', onConnect);
    socket.on('board:updated', onBoardUpdated);
    socket.on('column:created', onColumnCreated);
    socket.on('column:updated', onColumnUpdated);
    socket.on('column:deleted', onColumnDeleted);
    socket.on('column:moved', onColumnMoved);
    socket.on('card:created', onCardCreated);
    socket.on('card:updated', onCardUpdated);
    socket.on('card:deleted', onCardDeleted);
    socket.on('card:moved', onCardMoved);
    socket.on('comment:created', onCommentCreated);
    socket.on('comment:deleted', onCommentDeleted);
    socket.on('activity:created', onActivityCreated);
    socket.on('card:typing', onCardTyping);

    // Capture ref value for cleanup (ESLint react-hooks/exhaustive-deps)
    const timers = typingTimers.current;

    return () => {
      socketService.leaveBoard(boardId);
      socket.off('connect', onConnect);
      socket.off('board:updated', onBoardUpdated);
      socket.off('column:created', onColumnCreated);
      socket.off('column:updated', onColumnUpdated);
      socket.off('column:deleted', onColumnDeleted);
      socket.off('column:moved', onColumnMoved);
      socket.off('card:created', onCardCreated);
      socket.off('card:updated', onCardUpdated);
      socket.off('card:deleted', onCardDeleted);
      socket.off('card:moved', onCardMoved);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:deleted', onCommentDeleted);
      socket.off('activity:created', onActivityCreated);
      socket.off('card:typing', onCardTyping);
      // Clear all typing timers
      Object.values(timers).forEach(clearTimeout);
    };
  }, [boardId, handleReconnect, socketUpdateBoard,
    socketAddColumn, socketUpdateColumn, socketRemoveColumn, socketMoveColumn,
    socketAddCard, socketUpdateCard, socketRemoveCard, socketMoveCard,
    socketAddComment, socketRemoveComment, socketAddActivity]);

  // ── Column handlers ───────────────────────────────────────────────────────
  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardId) return;
    const trimmedName = newColumnName.trim();
    if (!trimmedName) {
      addToast('Column name is required', 'error');
      return;
    }
    if (trimmedName.length > 100) {
      addToast('Column name must be 100 characters or fewer', 'error');
      return;
    }
    try {
      await createColumn(boardId, trimmedName);
      setNewColumnName('');
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  const handleRenameColumn = async (columnId: string) => {
    if (!boardId) return;
    const trimmedName = editingColumnName.trim();
    if (!trimmedName) {
      addToast('Column name is required', 'error');
      return;
    }
    if (trimmedName.length > 100) {
      addToast('Column name must be 100 characters or fewer', 'error');
      return;
    }
    try {
      await updateColumn(boardId, columnId, trimmedName);
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

  // ── Card handlers ─────────────────────────────────────────────────────────
  const handleCreateCard = async (e: React.FormEvent, columnId: string) => {
    e.preventDefault();
    if (!boardId) return;
    const title = newCardTitle[columnId] || '';
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    if (trimmedTitle.length > 200) {
      addToast('Card title must be 200 characters or fewer', 'error');
      return;
    }
    try {
      await createCard(boardId, columnId, trimmedTitle);
      setNewCardTitle((prev) => ({ ...prev, [columnId]: '' }));
    } catch (err) {
      if (err instanceof Error) addToast(err.message, 'error');
    }
  };

  // Typing debounce: emit card:typing at most once per 200ms
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCardInputChange = (columnId: string, value: string, cardId?: string) => {
    setNewCardTitle((prev) => ({ ...prev, [columnId]: value }));
    if (!boardId || !cardId || !user) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socketService.emitTyping(boardId, cardId, user.displayName);
    }, 200);
  };

  // ── Drag and Drop handlers ────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { data } = active;
    if (data.current?.type === 'Card') {
      setActiveCard(data.current.card as Card);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveCard = active.data.current?.type === 'Card';
    const isOverCard = over.data.current?.type === 'Card';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveCard) return;

    const currentCards = useCardStore.getState().cards;
    let activeColumnId: string | null = null;
    for (const [colId, colCards] of Object.entries(currentCards)) {
      if (colCards.some(c => c.id === activeId)) {
        activeColumnId = colId;
        break;
      }
    }

    const overColumnId = isOverCard ? over.data.current?.card.columnId : isOverColumn ? overId : null;

    if (!activeColumnId || !overColumnId) {
      return;
    }

    // Optimistically move card to new column during drag
    useCardStore.setState((state) => {
      // Find the card inside the latest state to be absolutely safe
      let currentActiveColId: string | null = null;
      let activeIndex = -1;
      let movedCard: Card | null = null;
      
      for (const [colId, colCards] of Object.entries(state.cards)) {
        const idx = colCards.findIndex(c => c.id === activeId);
        if (idx !== -1) {
          currentActiveColId = colId;
          activeIndex = idx;
          movedCard = colCards[idx];
          break;
        }
      }

      if (!currentActiveColId || !movedCard || activeIndex === -1) {
        return state;
      }

      const overItems = state.cards[overColumnId] || [];
      const overIndex = isOverCard ? overItems.findIndex((c) => c.id === overId) : overItems.length;

      const nextCards = { ...state.cards };
      
      // Remove from all columns to be absolutely safe against duplicates
      for (const colId of Object.keys(nextCards)) {
        nextCards[colId] = nextCards[colId].filter(c => c.id !== activeId);
      }

      const cardToInsert = { ...movedCard, columnId: overColumnId };
      const nextOverItems = [...(nextCards[overColumnId] || [])];
      
      nextOverItems.splice(overIndex >= 0 ? overIndex : nextOverItems.length, 0, cardToInsert);
      nextCards[overColumnId] = nextOverItems;

      return { cards: nextCards };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !boardId) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const isOverColumn = over.data.current?.type === 'Column';
    
    // Original card details from the drag start
    const originalCard = active.data.current?.card as Card;
    if (!originalCard) return;

    const activeColumnId = originalCard.columnId;
    const overColumnId = isOverColumn ? overId : (over.data.current?.card as Card).columnId;

    if (!activeColumnId || !overColumnId) return;

    const currentCards = useCardStore.getState().cards;
    const targetColumnCards = currentCards[overColumnId] || [];
    
    const currentIndex = targetColumnCards.findIndex(c => c.id === activeId);
    if (currentIndex === -1) return; 

    // If dropped at exact original position, do nothing
    if (activeColumnId === overColumnId && currentIndex === targetColumnCards.findIndex(c => c.id === originalCard.id) && originalCard.position !== 65535) {
       // Actually originalCard is the exact card, we can just check if position changed. 
       // We'll calculate it first and skip API if it matches.
    }

    const itemAbove = currentIndex > 0 ? targetColumnCards[currentIndex - 1] : null;
    const itemBelow = currentIndex < targetColumnCards.length - 1 ? targetColumnCards[currentIndex + 1] : null;

    let newPosition = 65535;
    if (!itemAbove && itemBelow) {
      newPosition = itemBelow.position - 65535;
    } else if (itemAbove && !itemBelow) {
      newPosition = itemAbove.position + 65535;
    } else if (itemAbove && itemBelow) {
      newPosition = (itemAbove.position + itemBelow.position) / 2;
    } else {
      newPosition = 65535;
    }

    if (newPosition === originalCard.position && activeColumnId === overColumnId) {
      return; // Truly no movement occurred
    }

    try {
      const { moveCard } = useCardStore.getState();
      await moveCard(originalCard.id, originalCard.version, activeColumnId, overColumnId, newPosition);
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
        <h1 className="text-2xl font-bold text-gray-800 truncate flex-1" title={board?.name}>{board?.name}</h1>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-6 flex gap-6 items-start bg-gray-50 min-h-0">
          {columns.map((column, index) => (
            <BoardColumn
              key={column.id}
              columnId={column.id}
              columnName={column.name}
              cards={cards[column.id] || []}
              editingColumnId={editingColumnId}
              editingColumnName={editingColumnName}
              setEditingColumnName={setEditingColumnName}
              handleRenameColumn={handleRenameColumn}
              setEditingColumnId={setEditingColumnId}
              handleMoveLeft={() => handleMoveLeft(index)}
              handleMoveRight={() => handleMoveRight(index)}
              isFirst={index === 0}
              isLast={index === columns.length - 1}
              handleDeleteColumn={() => handleDeleteColumn(column.id, column.name)}
              setSelectedCard={setSelectedCard}
              typingUsers={typingUsers}
              boardMemberMap={boardMemberMap}
              boardId={boardId}
              newCardTitle={newCardTitle[column.id]}
              handleCardInputChange={handleCardInputChange}
              handleCreateCard={handleCreateCard}
            />
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
        
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeCard ? (
            <CardItem
              card={activeCard}
              isOverlay
              assigneeName={
                activeCard.assigneeId && boardId
                  ? boardMemberMap[boardId]?.find((m) => m.userId === activeCard.assigneeId)?.user.displayName
                  : undefined
              }
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <ConfirmDialog
        isOpen={columnToDelete !== null}
        title="Delete Column"
        message={`Are you sure you want to delete the column "${columnToDelete?.name}"?`}
        onConfirm={confirmDeleteColumn}
        onCancel={() => setColumnToDelete(null)}
        confirmText="Delete"
      />
      <CardModal
        card={selectedCard}
        isOpen={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        boardId={boardId}
        boardComplexityMax={board && 'complexityMax' in board ? (board as { complexityMax?: number }).complexityMax : 5}
      />
    </div>
  );
}
