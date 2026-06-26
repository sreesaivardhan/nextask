import React, { forwardRef } from 'react';
import type { Card } from '../stores/cardStore';

export interface CardItemProps extends React.HTMLAttributes<HTMLDivElement> {
  card: Card;
  typingUser?: string;
  assigneeName?: string;
  isOverlay?: boolean;
}

export const CardItem = forwardRef<HTMLDivElement, CardItemProps>(
  ({ card, typingUser, assigneeName, isOverlay, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        style={style}
        {...props}
        className={`bg-white p-3 rounded shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing transition-all ${
          isOverlay ? 'scale-105 shadow-xl rotate-2 cursor-grabbing z-50' : 'hover:border-blue-300 hover:shadow'
        }`}
      >
        <div className="flex justify-between items-start mb-2 overflow-hidden">
          <h4 className="font-semibold text-gray-800 text-sm truncate flex-1 mr-2" title={card.title}>
            {card.title}
          </h4>
          {card.complexity && (
            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0">
              {card.complexity}
            </span>
          )}
        </div>

        {card.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{card.description}</p>
        )}

        {typingUser && (
          <p className="text-xs text-blue-500 italic mb-1">{typingUser} is typing...</p>
        )}

        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {assigneeName ?? 'Unassigned'}
          </span>
          <span className="text-xs text-gray-400">v{card.version}</span>
        </div>
      </div>
    );
  }
);
CardItem.displayName = 'CardItem';
