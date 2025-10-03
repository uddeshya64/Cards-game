import { Card } from '../types/game';
import { getSuitSymbol, getSuitColor } from '../utils/cardUtils';

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  playable?: boolean;
}

export default function PlayingCard({
  card,
  onClick,
  className = '',
  size = 'md',
  faceDown = false,
  playable = false
}: PlayingCardProps) {
  const sizeClasses = {
    sm: 'w-12 h-16 text-xs',
    md: 'w-16 h-24 text-sm',
    lg: 'w-20 h-30 text-base'
  };

  if (faceDown) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-900 shadow-lg relative overflow-hidden`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full p-1">
            <div className="w-full h-full border-2 border-blue-400/30 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const suitColor = getSuitColor(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${sizeClasses[size]}
        ${className}
        bg-white rounded-lg border-2 border-slate-300 shadow-lg
        relative overflow-hidden
        transition-all duration-200
        ${playable ? 'hover:scale-110 hover:shadow-2xl hover:border-cyan-400 cursor-pointer hover:-translate-y-4' : ''}
        ${!playable && onClick ? 'opacity-50 cursor-not-allowed' : ''}
        ${!onClick ? 'cursor-default' : ''}
      `}
    >
      <div className="absolute top-1 left-1 flex flex-col items-center" style={{ color: suitColor }}>
        <span className="font-bold leading-none">{card.rank}</span>
        <span className="text-lg leading-none">{suitSymbol}</span>
      </div>
      <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180" style={{ color: suitColor }}>
        <span className="font-bold leading-none">{card.rank}</span>
        <span className="text-lg leading-none">{suitSymbol}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl opacity-20" style={{ color: suitColor }}>{suitSymbol}</span>
      </div>
    </button>
  );
}
