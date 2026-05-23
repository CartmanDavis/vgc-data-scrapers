import React, { useState } from 'react';

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

function PokeballFallback({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="https://img.pokemondb.net/sprites/items/poke-ball.png"
      alt="Pokéball"
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", ...style }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

export function ItemSprite({ item, size = 24, className, style }: ItemSpriteProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <PokeballFallback size={size} className={className} style={style} />;
  }

  return (
    <img
      src={`https://img.pokemondb.net/sprites/items/${toSlug(item)}.png`}
      alt={item}
      width={size}
      height={size}
      className={className}
      style={style}
      onError={() => setErrored(true)}
    />
  );
}
