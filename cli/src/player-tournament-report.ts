#!/usr/bin/env node

import { Command } from 'commander';
import { DB } from '@vgc/common/database/db';
import axios from 'axios';

interface PokemonData {
  species: string;
  form: string | null;
  item: string | null;
  ability: string | null;
  tera_type: string | null;
  moves: string[];
}

async function uploadPaste(paste: string, title = '', author = '', notes = ''): Promise<string | null> {
  try {
    paste = paste.replace(/\n/g, '\r\n');
    const data = { paste, title, author, notes };
    const response = await axios.post('https://pokepast.es/create', data, {
      maxRedirects: 5,
      timeout: 30000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (response.status === 200) {
      return response.request.res?.responseUrl || String(response.request.res?.url) || null;
    }
    return null;
  } catch {
    return null;
  }
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

async function getPokemonData(db: DB, teamId: number): Promise<PokemonData[]> {
  const pokemonSets = db.prepare(`
    SELECT id, species, form, item, ability, tera_type
    FROM pokemon_sets
    WHERE team_id = ?
    ORDER BY id LIMIT 6
  `).all(teamId) as Array<{ id: number; species: string; form: string | null; item: string | null; ability: string | null; tera_type: string | null }>;

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
  return teamPokemon;
}

const program = new Command();

program
  .name('player-tournament-report')
  .description('Generate a tournament report for a player including pastes')
  .argument('<playerName>', 'Player name to look up')
  .option('--days <number>', 'Number of days to look back', '90')
  .action(async (playerName: string, options) => {
    const db = new DB();
    await db.init();

    const players = db.prepare('SELECT id, name FROM players WHERE name LIKE ?').all(`%${playerName}%`) as Array<{ id: number; name: string }>;

    if (players.length === 0) {
      console.log(`No player found matching: ${playerName}`);
      return;
    }

    if (players.length > 1) {
      console.log('Multiple players found:');
      for (const p of players) {
        console.log(`  - ${p.name} (id: ${p.id})`);
      }
      return;
    }

    const player = players[0];
    console.log(`Generating report for: ${player.name} (id: ${player.id})\n`);

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(options.days));

    const tournaments = db.prepare(`
      SELECT t.id, t.name, t.date, ts.wins, ts.losses, ts.team_id
      FROM tournament_standings ts
      JOIN tournaments t ON ts.tournament_id = t.id
      WHERE ts.player_id = ? AND t.date >= ?
      ORDER BY t.date DESC
    `).all(player.id, daysAgo.toISOString()) as Array<{ id: string; name: string; date: string; wins: number; losses: number; team_id: number }>;

    if (tournaments.length === 0) {
      console.log(`No tournaments found for ${player.name} in the last ${options.days} days`);
      return;
    }

    const output: string[] = [];
    const seenPastes: Record<number, string | null> = {};

    for (const tournament of tournaments) {
      console.log(`Processing: ${tournament.name.substring(0, 40)}...`);

      const tournamentLink = `https://play.limitlesstcg.com/tournament/${tournament.id}/standings`;

      const teamPokemon = await getPokemonData(db, tournament.team_id);
      const playerPaste = createPaste(teamPokemon);
      const playerUrl = await uploadPaste(playerPaste, `${player.name} - ${tournament.name}`, player.name);
      seenPastes[tournament.team_id] = playerUrl;

      const matchResults = db.prepare(`
        SELECT m.round_number, p.name, 
          CASE WHEN mp.score > opp_mp.score THEN 'W' WHEN mp.score < opp_mp.score THEN 'L' ELSE 'T' END as result,
          opp_mp.team_id, opp_mp.score
        FROM matches m
        JOIN match_participants mp ON m.id = mp.match_id AND mp.player_id = ?
        JOIN match_participants opp_mp ON m.id = opp_mp.match_id AND opp_mp.player_id != ?
        JOIN players p ON opp_mp.player_id = p.id
        WHERE m.tournament_id = ?
        ORDER BY m.round_number
      `).all(player.id, player.id, tournament.id) as Array<{ round_number: number; name: string; result: string; team_id: number; score: number }>;

      const dateObj = new Date(tournament.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      output.push(`## [${tournament.name}](${tournamentLink})`);
      output.push(dateStr);
      if (playerUrl) {
        output.push(playerUrl);
      } else {
        output.push('(upload failed)');
      }
      output.push(`${tournament.wins} - ${tournament.losses}`);

      const seenTeams = new Set<number>();
      for (const match of matchResults) {
        if (seenTeams.has(match.team_id)) continue;
        seenTeams.add(match.team_id);

        let oppUrl = seenPastes[match.team_id];
        if (!oppUrl) {
          const oppPokemon = await getPokemonData(db, match.team_id);
          const oppPaste = createPaste(oppPokemon);
          oppUrl = await uploadPaste(oppPaste, `${match.name} - ${tournament.name}`, match.name);
          seenPastes[match.team_id] = oppUrl;
        }

        if (oppUrl) {
          output.push(`* ${match.result} - ${oppUrl}`);
        } else {
          output.push(`* ${match.result} - (upload failed)`);
        }
      }

      output.push('');
    }

    db.close();

    console.log('\n' + '='.repeat(80));
    for (const line of output) {
      console.log(line);
    }
  });

program.parse();
