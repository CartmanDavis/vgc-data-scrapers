#!/usr/bin/env node

import { DB } from '../database/db.js';
import axios from 'axios';

interface PokemonData {
  species: string;
  form: string | null;
  item: string | null;
  ability: string | null;
  tera_type: string | null;
  moves: string[];
}

async function uploadPaste(paste: string, title = '', author = '', notes = ''): Promise<string> {
  paste = paste.replace(/\n/g, '\r\n');
  const data = { paste, title, author, notes };
  const response = await axios.post('https://pokepast.es/create', data, {
    maxRedirects: 5,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.request.res?.responseUrl || String(response.request.res?.url) || '';
}

function createPaste(pokemonData: PokemonData[], tournamentName: string, dateStr: string, wins: number, losses: number): string {
  let paste = `${tournamentName} (${dateStr}) - ${wins}W-${losses}L\n\n`;
  
  for (const pokemon of pokemonData) {
    let name = pokemon.species;
    if (pokemon.form) {
      name = `${name}-${pokemon.form}`;
    }
    if (pokemon.item) {
      paste += `${name} @ ${pokemon.item}\n`;
    } else {
      paste += `${name}\n`;
    }

    if (pokemon.ability) {
      paste += `Ability: ${pokemon.ability}\n`;
    }
    if (pokemon.tera_type) {
      paste += `Tera Type: ${pokemon.tera_type}\n`;
    }

    for (const move of pokemon.moves) {
      paste += `- ${move}\n`;
    }

    paste += '\n';
  }

  return paste.trim() + '\n\n';
}

const db = new DB();
await db.init();

const playerId = process.argv[2] || '3315';

const teamsData = db.prepare(`
  SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    t.date,
    mp.team_id
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  JOIN tournaments t ON m.tournament_id = t.id
  WHERE mp.player_id = ?
    AND t.format = 'SVF'
  GROUP BY t.id, mp.team_id
  ORDER BY t.date, t.id
`).all(playerId) as Array<{ tournament_id: string; tournament_name: string; date: string; team_id: number }>;

let allPastes = '';

for (const teamData of teamsData) {
  const pokemonSets = db.prepare(`
    SELECT 
      ps.id,
      ps.species,
      ps.form,
      ps.item,
      ps.ability,
      ps.tera_type
    FROM pokemon_sets ps
    WHERE ps.team_id = ?
    ORDER BY ps.id
    LIMIT 6
  `).all(teamData.team_id) as Array<{ id: number; species: string; form: string | null; item: string | null; ability: string | null; tera_type: string | null }>;

  const matchResults = db.prepare(`
    SELECT 
      CASE 
        WHEN mp.score > opp_mp.score THEN 'W'
        WHEN mp.score < opp_mp.score THEN 'L'
        ELSE 'T'
      END as result
    FROM match_participants mp
    JOIN matches m ON mp.match_id = m.id
    JOIN match_participants opp_mp ON mp.match_id = opp_mp.match_id AND opp_mp.player_id != mp.player_id
    WHERE mp.player_id = ?
      AND mp.team_id = ?
      AND m.tournament_id = ?
    GROUP BY m.round_number, opp_mp.team_id
    ORDER BY m.round_number
  `).all(playerId, teamData.team_id, teamData.tournament_id) as Array<{ result: string }>;

  const wins = matchResults.filter(r => r.result === 'W').length;
  const losses = matchResults.filter(r => r.result === 'L').length;

  const dateObj = new Date(teamData.date);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const teamPokemon: PokemonData[] = [];
  for (const ps of pokemonSets) {
    const moves = db.prepare(`
      SELECT move_name
      FROM moves
      WHERE pokemon_set_id = ?
      ORDER BY id
    `).all(ps.id) as Array<{ move_name: string }>;

    teamPokemon.push({
      species: ps.species,
      form: ps.form,
      item: ps.item,
      ability: ps.ability,
      tera_type: ps.tera_type,
      moves: moves.map(m => m.move_name)
    });
  }

  const teamPaste = createPaste(teamPokemon, teamData.tournament_name, dateStr, wins, losses);
  allPastes += teamPaste;
}

const url = await uploadPaste(allPastes, 'My Teams', 'Player');
console.log(url);

db.close();
