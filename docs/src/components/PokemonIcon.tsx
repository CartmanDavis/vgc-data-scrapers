import type React from 'react';

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

export function PokemonIcon({
  species,
  form,
  size = "medium",
  className,
  style,
}: PokemonIconProps) {
  const sizePx = iconSizeToPx[size];

  return (
    <img
      src={pokemonSpriteUrl(species, form)}
      alt={species}
      width={sizePx}
      height={sizePx}
      className={className}
      style={style}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
