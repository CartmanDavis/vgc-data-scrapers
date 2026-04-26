import { Dex } from '@pkmn/dex';

export interface RawPokemon {
  name: string;
  item?: string;
  ability?: string;
  tera?: string;
  attacks?: string[];
}

export interface ValidatedPokemon {
  species: string;
  item: string | null;
  ability: string | null;
  tera_type: string | null;
  moves: string[];
  is_mega: boolean;
  invalid: boolean;
  warnings: string[];
  fixes: string[];
}

/**
 * Items not in @pkmn/dex that are legal in this format (e.g. custom M-A mega stones).
 * Add entries here to suppress "unknown item" warnings and prevent invalid=true.
 * Keys are lowercase item names; values are the canonical display names.
 */
export const CUSTOM_ITEMS: Map<string, string> = new Map([
  ['hoopanite', 'Hoopanite'],
  ['zeraonite', 'Zeraonite'],
  ['marshadite', 'Marshadite'],
]);

/**
 * Species not in @pkmn/dex that are legal in this format.
 * Keys are lowercase; values are the canonical display names.
 */
export const CUSTOM_SPECIES: Map<string, string> = new Map();

// Regex for mega stone detection on custom items not known to @pkmn/dex.
// Matches items ending in 'ite' (case-insensitive), excluding 'Eviolite'.
const MEGA_STONE_PATTERN = /ite$/i;

export function validatePokemon(raw: RawPokemon): ValidatedPokemon {
  const warnings: string[] = [];
  const fixes: string[] = [];
  let invalid = false;

  // --- Species ---
  const rawSpecies = raw.name ?? '';
  const speciesData = Dex.species.get(rawSpecies);
  let species: string;
  if (speciesData.exists) {
    if (speciesData.name !== rawSpecies) {
      fixes.push(`species: "${rawSpecies}" → "${speciesData.name}"`);
    }
    species = speciesData.name;
  } else {
    const custom = CUSTOM_SPECIES.get(rawSpecies.toLowerCase());
    if (custom !== undefined) {
      species = custom;
    } else {
      warnings.push(`Unknown species: "${rawSpecies}"`);
      invalid = true;
      species = rawSpecies;
    }
  }

  // --- Item ---
  let item: string | null = null;
  let is_mega = false;
  if (raw.item) {
    const itemData = Dex.items.get(raw.item);
    if (itemData.exists) {
      if (itemData.name !== raw.item) {
        fixes.push(`item: "${raw.item}" → "${itemData.name}"`);
      }
      item = itemData.name;
      is_mega = !!itemData.megaStone;
    } else {
      const custom = CUSTOM_ITEMS.get(raw.item.toLowerCase());
      if (custom !== undefined) {
        item = custom;
        // Custom mega stones: assume mega if name ends in 'ite' (not eviolite)
        is_mega = MEGA_STONE_PATTERN.test(custom) && custom.toLowerCase() !== 'eviolite';
      } else {
        warnings.push(`Unknown item: "${raw.item}"`);
        invalid = true;
        item = raw.item;
        is_mega = MEGA_STONE_PATTERN.test(raw.item) && raw.item.toLowerCase() !== 'eviolite';
      }
    }
  }

  // --- Ability ---
  let ability: string | null = null;
  if (raw.ability) {
    const abilityData = Dex.abilities.get(raw.ability);
    if (abilityData.exists) {
      if (abilityData.name !== raw.ability) {
        fixes.push(`ability: "${raw.ability}" → "${abilityData.name}"`);
      }
      ability = abilityData.name;
    } else {
      warnings.push(`Unknown ability: "${raw.ability}"`);
      invalid = true;
      ability = raw.ability;
    }
  }

  // --- Tera type ---
  let tera_type: string | null = null;
  if (raw.tera) {
    const typeData = Dex.types.get(raw.tera);
    if (typeData.exists) {
      if (typeData.name !== raw.tera) {
        fixes.push(`tera_type: "${raw.tera}" → "${typeData.name}"`);
      }
      tera_type = typeData.name;
    } else {
      warnings.push(`Unknown tera type: "${raw.tera}"`);
      invalid = true;
      tera_type = raw.tera;
    }
  }

  // --- Moves ---
  const moves: string[] = [];
  for (const rawMove of raw.attacks ?? []) {
    const moveData = Dex.moves.get(rawMove);
    if (moveData.exists) {
      if (moveData.name !== rawMove) {
        fixes.push(`move: "${rawMove}" → "${moveData.name}"`);
      }
      moves.push(moveData.name);
    } else {
      warnings.push(`Unknown move: "${rawMove}"`);
      invalid = true;
      moves.push(rawMove);
    }
  }

  return { species, item, ability, tera_type, moves, is_mega, invalid, warnings, fixes };
}
