#!/usr/bin/env node

import { DB } from '../database/db.js';
import { config } from '@vgc/common/config.js';
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

function createPaste(pokemonData: PokemonData[]): string {
  let paste = '';
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
  return paste.trim();
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node create-upload.js <player_id> [format]');
  process.exit(1);
}

const playerId = parseInt(args[0], 10);
const formatFilter = args[1] || undefined;

const dbPath = config.dbPath;
const db = new DB(dbPath);
await db.init();

const player = db.prepare('SELECT name FROM players WHERE id = ?').get(playerId) as { name: string } | undefined;
if (!player) {
  console.log(`Player with id ${playerId} not found`);
  process.exit(1);
}

const playerName = player.name;

let query = `
  SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    t.date,
    mp.team_id
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  JOIN tournaments t ON m.tournament_id = t.id
  WHERE mp.player_id = ?
`;
const params: (string | number)[] = [playerId];

if (formatFilter) {
  query += ' AND t.format = ?';
  params.push(formatFilter);
}
query += ' GROUP BY t.id, mp.team_id ORDER BY t.date DESC, t.id;';

const teamsData = db.prepare(query).all(...params) as Array<{ tournament_id: string; tournament_name: string; date: string; team_id: number }>;

for (const teamData of teamsData) {
  const pokemonSets = db.prepare(`
    SELECT id, species, form, item, ability, tera_type
    FROM pokemon_sets
    WHERE team_id = ?
    ORDER BY id
    LIMIT 6
  `).all(teamData.team_id) as Array<{ id: number; species: string; form: string | null; item: string | null; ability: string | null; tera_type: string | null }>;

  const opponentTeamIds = db.prepare(`
    SELECT DISTINCT opp_mp.team_id
    FROM match_participants mp
    JOIN matches m ON mp.match_id = m.id
    JOIN match_participants opp_mp ON mp.match_id = opp_mp.match_id AND opp_mp.player_id != mp.player_id
    WHERE mp.player_id = ?
      AND mp.team_id = ?
      AND m.tournament_id = ?
  `).all(playerId, teamData.team_id, teamData.tournament_id) as Array<{ team_id: number }>;

  const matchResults = db.prepare(`
    SELECT 
      m.round_number,
      opp_mp.team_id as opponent_team_id,
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
  `).all(playerId, teamData.team_id, teamData.tournament_id) as Array<{ round_number: number; opponent_team_id: number; result: string }>;

  const opponentTeams: Record<number, string> = {};
  for (const opp of opponentTeamIds) {
    const speciesList = db.prepare(`
      SELECT ps.species, ps.form
      FROM pokemon_sets ps
      WHERE ps.team_id = ?
      GROUP BY ps.species, ps.form
      ORDER BY ps.id
      LIMIT 6
    `).all(opp.team_id) as Array<{ species: string; form: string | null }>;

    opponentTeams[opp.team_id] = speciesList
      .map(sp => sp.form ? `${sp.species} ${sp.form}` : sp.species)
      .join(', ');
  }

  const teamPokemon: PokemonData[] = [];
  for (const ps of pokemonSets) {
    const moves = db.prepare('SELECT move_name FROM moves WHERE pokemon_set_id = ? ORDER BY id').all(ps.id) as Array<{ move_name: string }>;
    teamPokemon.push({
      species: ps.species,
      form: ps.form,
      item: ps.item,
      ability: ps.ability,
      tera_type: ps.tera_type,
      moves: moves.map(m => m.move_name)
    });
  }

  const pasteContent = createPaste(teamPokemon);
  const url = await uploadPaste(pasteContent, teamData.tournament_name, playerName);

  const dateObj = new Date(teamData.date);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const wins = matchResults.filter(r => r.result === 'W').length;
  const losses = matchResults.filter(r => r.result === 'L').length;

  console.log(`${teamData.tournament_name} (${dateStr})`);
  console.log(`${wins} W - ${losses} L`);
  console.log(url);

  for (const match of matchResults) {
    if (match.opponent_team_id in opponentTeams) {
      console.log(`- ${match.result}: ${opponentTeams[match.opponent_team_id]}`);
    }
  }

  console.log();
}

db.close();
