import { Dex } from '@pkmn/dex';
import type { ID, ModData } from '@pkmn/dex';
import * as ChampionsMod from '@pkmn/mods/champions';

const championsDex = Dex.mod('champions' as ID, ChampionsMod as unknown as ModData);

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

/**
 * Species name aliases: maps alternate names used by external sources (e.g. Limitless)
 * to the @pkmn/dex-compatible lookup name. Applied before the normal dex lookup.
 * Keys are lowercase raw names; values are dex lookup strings.
 */
export const SPECIES_ALIASES: Map<string, string> = new Map([
  // Limitless uses adjective-first order; dex expects species-first
  ['eternal flower floette', 'Floette-Eternal'],
  ['wash rotom',             'Rotom-Wash'],
  ['heat rotom',             'Rotom-Heat'],
  ['frost rotom',            'Rotom-Frost'],
  ['fan rotom',              'Rotom-Fan'],
  ['mow rotom',              'Rotom-Mow'],
  // Limitless says "Paldean", dex uses "Paldea"
  ['paldean tauros aqua breed', 'Tauros-Paldea-Aqua'],
  // Aegislash-Blade is an in-battle form only; store as base species
  ['aegislash blade forme',  'Aegislash'],
  ['aegislash blade',        'Aegislash'],
]);

// Regex for mega stone detection on custom items not known to @pkmn/dex.
// Matches items ending in 'ite' (case-insensitive), excluding 'Eviolite'.
const MEGA_STONE_PATTERN = /ite$/i;

export function validatePokemon(raw: RawPokemon): ValidatedPokemon {
  const warnings: string[] = [];
  const fixes: string[] = [];
  let invalid = false;

  // --- Species ---
  const rawSpecies = raw.name ?? '';
  let lookupSpecies = rawSpecies;
  let isMegaFromName = false;

  // Apply source-specific name aliases before any other normalization.
  const aliased = SPECIES_ALIASES.get(rawSpecies.toLowerCase());
  if (aliased !== undefined) {
    lookupSpecies = aliased;
  } else {
    // Strip "Mega " prefix and optional trailing X/Y/Z form letter before Dex lookup.
    // @pkmn/dex only knows base species names, not "Mega Venusaur"-style names.
    if (lookupSpecies.startsWith('Mega ')) {
      isMegaFromName = true;
      lookupSpecies = lookupSpecies.slice(5);
      if (/^.+ [XYZ]$/.test(lookupSpecies)) {
        lookupSpecies = lookupSpecies.slice(0, -2);
      }
    }
  }

  const speciesData = championsDex.species.get(lookupSpecies);
  let species: string;
  if (speciesData.exists) {
    if (speciesData.name !== rawSpecies) {
      fixes.push(`species: "${rawSpecies}" → "${speciesData.name}"`);
    }
    species = speciesData.name;
  } else {
    const custom = CUSTOM_SPECIES.get(lookupSpecies.toLowerCase());
    if (custom !== undefined) {
      if (custom !== rawSpecies) {
        fixes.push(`species: "${rawSpecies}" → "${custom}"`);
      }
      species = custom;
    } else {
      warnings.push(`Unknown species: "${rawSpecies}"`);
      invalid = true;
      species = rawSpecies;
    }
  }

  // --- Item ---
  let item: string | null = null;
  let is_mega = isMegaFromName;
  if (raw.item) {
    const itemData = championsDex.items.get(raw.item);
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
    const abilityData = championsDex.abilities.get(raw.ability);
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
    const typeData = championsDex.types.get(raw.tera);
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
    const moveData = championsDex.moves.get(rawMove);
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
