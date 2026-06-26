import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CardItem } from './CardItem';
import type { Card } from '../stores/cardStore';

interface SortableCardProps {
  card: Card;
  typingUser?: string;
  assigneeName?: string;
  onClick: () => void;
}

export function SortableCard({ card, typingUser, assigneeName, onClick }: SortableCardProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'Card',
      card,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <CardItem
      ref={setNodeRef}
      style={style}
      card={card}
      typingUser={typingUser}
      assigneeName={assigneeName}
      onClick={onClick}
      {...attributes}
      {...listeners}
    />
  );
}
