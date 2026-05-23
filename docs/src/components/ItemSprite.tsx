import type React from 'react';

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

interface ItemSpriteProps {
  item: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ItemSprite({ item, size = 24, className, style }: ItemSpriteProps) {
  return (
    <img
      src={`https://img.pokemondb.net/sprites/items/${toSlug(item)}.png`}
      alt={item}
      width={size}
      height={size}
      className={className}
      style={style}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
