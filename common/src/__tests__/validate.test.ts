import { describe, it, expect } from 'vitest';
import { validatePokemon } from '../processors/validate.js';

describe('validatePokemon', () => {
  describe('species', () => {
    it('accepts a known species', () => {
      const result = validatePokemon({ name: 'Pikachu' });
      expect(result.species).toBe('Pikachu');
      expect(result.invalid).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it('normalizes species casing and records a fix', () => {
      const result = validatePokemon({ name: 'pikachu' });
      expect(result.species).toBe('Pikachu');
      expect(result.fixes).toContain('species: "pikachu" → "Pikachu"');
      expect(result.invalid).toBe(false);
    });

    it('marks unknown species as invalid with a warning', () => {
      const result = validatePokemon({ name: 'NotAPokemon' });
      expect(result.invalid).toBe(true);
      expect(result.warnings).toContain('Unknown species: "NotAPokemon"');
      expect(result.species).toBe('NotAPokemon');
    });

    it('marks empty species as invalid', () => {
      const result = validatePokemon({ name: '' });
      expect(result.invalid).toBe(true);
    });
  });

  describe('item', () => {
    it('returns null item when none provided', () => {
      const result = validatePokemon({ name: 'Pikachu' });
      expect(result.item).toBeNull();
      expect(result.is_mega).toBe(false);
    });

    it('accepts a known non-mega item', () => {
      const result = validatePokemon({ name: 'Pikachu', item: 'Choice Band' });
      expect(result.item).toBe('Choice Band');
      expect(result.is_mega).toBe(false);
      expect(result.invalid).toBe(false);
    });

    it('normalizes item casing and records a fix', () => {
      const result = validatePokemon({ name: 'Pikachu', item: 'choice band' });
      expect(result.item).toBe('Choice Band');
      expect(result.fixes).toContain('item: "choice band" → "Choice Band"');
    });

    it('detects a standard mega stone and sets is_mega', () => {
      const result = validatePokemon({ name: 'Venusaur', item: 'Venusaurite' });
      expect(result.item).toBe('Venusaurite');
      expect(result.is_mega).toBe(true);
      expect(result.invalid).toBe(false);
    });

    it('recognizes custom mega stone items (Hoopanite) without invalid flag', () => {
      const result = validatePokemon({ name: 'Pikachu', item: 'Hoopanite' });
      expect(result.item).toBe('Hoopanite');
      expect(result.is_mega).toBe(true);
      expect(result.invalid).toBe(false);
    });

    it('recognizes custom mega stone items (Zeraonite)', () => {
      const result = validatePokemon({ name: 'Pikachu', item: 'Zeraonite' });
      expect(result.item).toBe('Zeraonite');
      expect(result.is_mega).toBe(true);
      expect(result.invalid).toBe(false);
    });

    it('marks unknown item as invalid with a warning', () => {
      const result = validatePokemon({ name: 'Pikachu', item: 'FakeStone' });
      expect(result.invalid).toBe(true);
      expect(result.warnings).toContain('Unknown item: "FakeStone"');
      expect(result.item).toBe('FakeStone');
    });

    it('treats unknown item ending in "ite" as a mega stone', () => {
      const result = validatePokemon({ name: 'Pikachu', item: 'Unknownite' });
      expect(result.is_mega).toBe(true);
    });

    it('does not treat Eviolite as a mega stone', () => {
      const result = validatePokemon({ name: 'Chansey', item: 'Eviolite' });
      expect(result.is_mega).toBe(false);
    });
  });

  describe('ability', () => {
    it('accepts a known ability', () => {
      const result = validatePokemon({ name: 'Pikachu', ability: 'Static' });
      expect(result.ability).toBe('Static');
      expect(result.invalid).toBe(false);
    });

    it('normalizes ability casing and records a fix', () => {
      const result = validatePokemon({ name: 'Pikachu', ability: 'static' });
      expect(result.ability).toBe('Static');
      expect(result.fixes).toContain('ability: "static" → "Static"');
    });

    it('marks unknown ability as invalid', () => {
      const result = validatePokemon({ name: 'Pikachu', ability: 'FakeAbility' });
      expect(result.invalid).toBe(true);
      expect(result.warnings).toContain('Unknown ability: "FakeAbility"');
    });

    it('returns null ability when none provided', () => {
      const result = validatePokemon({ name: 'Pikachu' });
      expect(result.ability).toBeNull();
    });
  });

  describe('tera type', () => {
    it('accepts a known tera type', () => {
      const result = validatePokemon({ name: 'Pikachu', tera: 'Fire' });
      expect(result.tera_type).toBe('Fire');
      expect(result.invalid).toBe(false);
    });

    it('normalizes tera type casing and records a fix', () => {
      const result = validatePokemon({ name: 'Pikachu', tera: 'fire' });
      expect(result.tera_type).toBe('Fire');
      expect(result.fixes).toContain('tera_type: "fire" → "Fire"');
    });

    it('marks unknown tera type as invalid', () => {
      const result = validatePokemon({ name: 'Pikachu', tera: 'Cosmic' });
      expect(result.invalid).toBe(true);
      expect(result.warnings).toContain('Unknown tera type: "Cosmic"');
    });

    it('returns null tera type when none provided', () => {
      const result = validatePokemon({ name: 'Pikachu' });
      expect(result.tera_type).toBeNull();
    });
  });

  describe('moves', () => {
    it('accepts known moves', () => {
      const result = validatePokemon({ name: 'Pikachu', attacks: ['Thunderbolt', 'Quick Attack'] });
      expect(result.moves).toEqual(['Thunderbolt', 'Quick Attack']);
      expect(result.invalid).toBe(false);
    });

    it('normalizes move casing and records a fix', () => {
      const result = validatePokemon({ name: 'Pikachu', attacks: ['thunderbolt'] });
      expect(result.moves).toContain('Thunderbolt');
      expect(result.fixes).toContain('move: "thunderbolt" → "Thunderbolt"');
    });

    it('marks unknown move as invalid', () => {
      const result = validatePokemon({ name: 'Pikachu', attacks: ['FakeBlast'] });
      expect(result.invalid).toBe(true);
      expect(result.warnings).toContain('Unknown move: "FakeBlast"');
      expect(result.moves).toContain('FakeBlast');
    });

    it('returns empty moves array when none provided', () => {
      const result = validatePokemon({ name: 'Pikachu' });
      expect(result.moves).toEqual([]);
    });

    it('handles a mix of valid and invalid moves', () => {
      const result = validatePokemon({ name: 'Pikachu', attacks: ['Thunderbolt', 'FakeBlast'] });
      expect(result.moves).toHaveLength(2);
      expect(result.invalid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('combined validation', () => {
    it('accumulates fixes and warnings across all fields', () => {
      const result = validatePokemon({
        name: 'pikachu',
        item: 'choice band',
        ability: 'static',
        attacks: ['FakeBlast'],
      });
      expect(result.fixes.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings).toHaveLength(1);
      expect(result.invalid).toBe(true);
    });

    it('returns fully valid result for a clean pokemon entry', () => {
      const result = validatePokemon({
        name: 'Pikachu',
        item: 'Choice Band',
        ability: 'Static',
        tera: 'Electric',
        attacks: ['Thunderbolt', 'Quick Attack', 'Volt Switch', 'Fake Out'],
      });
      expect(result.invalid).toBe(false);
      expect(result.warnings).toHaveLength(0);
      expect(result.fixes).toHaveLength(0);
    });
  });
});
