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
        className={`bg-surface p-4 rounded-xl shadow-subtle border border cursor-grab active:cursor-grabbing transition duration-150 ease-out-soft ${
          isOverlay ? 'scale-105 shadow-floating rotate-2 cursor-grabbing z-50' : 'hover:border-primary hover:shadow-elevated'
        }`}
      >
        <div className="flex justify-between items-start mb-2.5 overflow-hidden gap-3">
          <h4 className="font-semibold text-primary text-sm leading-snug line-clamp-2 flex-1" title={card.title}>
            {card.title}
          </h4>
          {card.complexity && (
            <span className="bg-elevated text-secondary border border-strong text-[11px] px-2 py-0.5 rounded-md font-medium shrink-0 shadow-sm">
              {card.complexity}
            </span>
          )}
        </div>

        {card.description && (
          <p className="text-[13px] text-secondary line-clamp-2 mb-3 leading-relaxed">{card.description}</p>
        )}

        {typingUser && (
          <p className="text-xs text-primary italic mb-2 opacity-80">{typingUser} is typing...</p>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-strong">
          <span className="text-[11px] font-medium text-secondary bg-elevated px-2 py-1 rounded-md border">
            {assigneeName ?? 'Unassigned'}
          </span>
          <span className="text-[11px] text-muted font-medium tracking-wide">v{card.version}</span>
        </div>
      </div>
    );
  }
);
CardItem.displayName = 'CardItem';
