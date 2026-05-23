import React, { useState } from 'react';

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

function pokemonSpriteUrl(species: string, form?: string): string {
  const isMega = form != null && /mega/i.test(form);
  const slug = isMega ? toSlug(`${species}-${form}`) : toSlug(species);
  return `https://img.pokemondb.net/sprites/scarlet-violet/normal/${slug}.png`;
}

const iconSizeToPx = {
  small: 50,
  medium: 100,
  large: 200,
};

export type PokemonIconSize = keyof typeof iconSizeToPx;

interface PokemonIconProps {
  species: string;
  form?: string;
  size?: PokemonIconSize;
  className?: string;
  style?: React.CSSProperties;
}

function PokeballFallback({ sizePx, className, style }: { sizePx: number; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="https://img.pokemondb.net/sprites/items/poke-ball.png"
      alt="Pokéball"
      width={sizePx}
      height={sizePx}
      className={className}
      style={{ imageRendering: "pixelated", ...style }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

export function PokemonIcon({
  species,
  form,
  size = "medium",
  className,
  style,
}: PokemonIconProps) {
  const sizePx = iconSizeToPx[size];
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <PokeballFallback sizePx={sizePx} className={className} style={style} />;
  }

  return (
    <img
      src={pokemonSpriteUrl(species, form)}
      alt={species}
      width={sizePx}
      height={sizePx}
      className={className}
      style={style}
      onError={() => setErrored(true)}
    />
  );
}
