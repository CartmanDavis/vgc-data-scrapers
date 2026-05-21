// ─── Player names & countries ─────────────────────────────────────────────────

const PLAYER_DEFS = [
  { id: 'p1',  name: 'Aaron Traylor',    country: 'United States', flag: '🇺🇸' },
  { id: 'p2',  name: 'Wolfe Glick',      country: 'United States', flag: '🇺🇸' },
  { id: 'p3',  name: 'Sejun Park',       country: 'South Korea',   flag: '🇰🇷' },
  { id: 'p4',  name: 'Markus Stadter',   country: 'Germany',       flag: '🇩🇪' },
  { id: 'p5',  name: 'Toler Webb',       country: 'United States', flag: '🇺🇸' },
  { id: 'p6',  name: 'Paul Chua',        country: 'Singapore',     flag: '🇸🇬' },
  { id: 'p7',  name: 'Edu Folgueras',    country: 'Spain',         flag: '🇪🇸' },
  { id: 'p8',  name: 'Barry Anderson',   country: 'United Kingdom',flag: '🇬🇧' },
  { id: 'p9',  name: 'James Baek',       country: 'Canada',        flag: '🇨🇦' },
  { id: 'p10', name: 'Aaron Park',       country: 'South Korea',   flag: '🇰🇷' },
  { id: 'p11', name: 'Gabby Snyder',     country: 'United States', flag: '🇺🇸' },
  { id: 'p12', name: 'Nicholas Kan',     country: 'Hong Kong',     flag: '🇭🇰' },
  { id: 'p13', name: 'Hirofumi Kimura',  country: 'Japan',         flag: '🇯🇵' },
  { id: 'p14', name: 'Ryota Otsubo',     country: 'Japan',         flag: '🇯🇵' },
  { id: 'p15', name: 'Emilio Forbes',    country: 'Brazil',        flag: '🇧🇷' },
  { id: 'p16', name: 'Lee Provost',      country: 'Australia',     flag: '🇦🇺' },
  { id: 'p17', name: 'Melanie Yates',    country: 'United States', flag: '🇺🇸' },
  { id: 'p18', name: 'Giovanni Costa',   country: 'Italy',         flag: '🇮🇹' },
];

// ─── Tournament name templates ────────────────────────────────────────────────

// Slot definitions: null = use next regional city; string = fixed name; attendees override for online
const SLOT_OVERRIDES: Record<number, { name: string; attendees: number }> = {
   2: { name: 'Nino Pokebros FF #1',              attendees: 96  },
   4: { name: 'Victory Road January Challenge #1', attendees: 128 },
   6: { name: 'Nino Pokebros FF #2',              attendees: 112 },
   7: { name: 'SpearPillar',                       attendees: 80  },
  10: { name: 'Victory Road January Challenge #2', attendees: 104 },
  12: { name: 'Nino Pokebros FF #3',              attendees: 96  },
  14: { name: 'SpearPillar',                       attendees: 88  },
  16: { name: 'Victory Road February Challenge #1',attendees: 120 },
  17: { name: 'Nino Pokebros FF #4',              attendees: 72  },
  19: { name: 'SpearPillar',                       attendees: 96  },
  22: { name: 'Victory Road February Challenge #2',attendees: 108 },
  23: { name: 'Nino Pokebros FF #5',              attendees: 80  },
  25: { name: 'Victory Road March Challenge #1',   attendees: 136 },
  27: { name: 'Nino Pokebros FF #6',              attendees: 88  },
  29: { name: 'Victory Road March Challenge #2',   attendees: 112 },
  31: { name: 'SpearPillar',                       attendees: 96  },
  32: { name: 'Nino Pokebros FF #7',              attendees: 104 },
  37: { name: 'Nino Pokebros FF #8',              attendees: 80  },
  39: { name: 'Victory Road April Challenge #1',   attendees: 128 },
  41: { name: 'World Championships 2026',          attendees: 1512 },
};

const REGIONAL_CITIES = [
  'Milwaukee', 'Hartford', 'Salt Lake City', 'Memphis', 'Portland',
  'Cleveland', 'Indianapolis', 'Charlotte', 'Richmond', 'Phoenix',
  'Denver', 'Columbus', 'Kansas City', 'Nashville', 'Pittsburgh',
  'San Antonio', 'Minneapolis', 'Orlando', 'Baltimore', 'Sacramento',
  'Raleigh', 'Louisville', 'Detroit', 'St. Louis', 'New Orleans',
  'Omaha', 'Albuquerque', 'Tampa', 'Providence', 'Buffalo',
  'Spokane', 'Little Rock', 'Tulsa', 'Des Moines', 'Wichita',
  'Boise', 'Anchorage', 'Burlington', 'Madison',
];

const INTL_ENTRIES = [
  { name: 'International Championships — Sydney',   attendees: 1024 },
  { name: 'International Championships — Berlin',   attendees: 987  },
  { name: 'International Championships — São Paulo',attendees: 856  },
];

// ─── Team compositions ────────────────────────────────────────────────────────

const TEAMS: string[][] = [
  ['Garchomp',  'Mewtwo',    'Groudon',   'Kyogre',    'Rayquaza',  'Gengar'    ],
  ['Garchomp',  'Charizard', 'Blaziken',  'Blastoise',  'Salamence', 'Lucario'  ],
  ['Mewtwo',    'Groudon',   'Kyogre',    'Salamence',  'Gengar',    'Medicham'  ],
  ['Rayquaza',  'Garchomp',  'Charizard', 'Venusaur',   'Swampert',  'Lucario'   ],
  ['Kyogre',    'Groudon',   'Gengar',    'Salamence',  'Blaziken',  'Garchomp'  ],
  ['Mewtwo',    'Rayquaza',  'Blastoise', 'Medicham',   'Charizard', 'Swampert'  ],
  ['Garchomp',  'Gengar',    'Venusaur',  'Mewtwo',     'Kyogre',    'Blaziken'  ],
  ['Salamence', 'Charizard', 'Groudon',   'Lucario',    'Garchomp',  'Rayquaza'  ],
];

// ─── Fake tournament index ────────────────────────────────────────────────────

function buildTournaments() {
  const result: Array<{ id: string; name: string; date: string; format: string; attendees: number; winner: string; winner_id: string }> = [];
  let intlIdx = 0;
  let cityIdx = 0;
  for (let i = 0; i < 42; i++) {
    const date = new Date(2026, 0, 4 + i * 3).toISOString().split('T')[0];
    const winner = PLAYER_DEFS[i % PLAYER_DEFS.length];
    if (i === 8 || i === 20 || i === 34) {
      const intl = INTL_ENTRIES[intlIdx++];
      result.push({ id: `t${i + 1}`, name: intl.name, date, format: 'M-A', attendees: intl.attendees, winner: winner.name, winner_id: winner.id });
    } else if (SLOT_OVERRIDES[i]) {
      const ov = SLOT_OVERRIDES[i];
      result.push({ id: `t${i + 1}`, name: ov.name, date, format: 'M-A', attendees: ov.attendees, winner: winner.name, winner_id: winner.id });
    } else {
      const city = REGIONAL_CITIES[cityIdx++ % REGIONAL_CITIES.length];
      const attendees = 200 + ((i * 37 + 13) % 320);
      result.push({ id: `t${i + 1}`, name: `Regional Championships — ${city}`, date, format: 'M-A', attendees, winner: winner.name, winner_id: winner.id });
    }
  }
  return result;
}

export const MOCK_TOURNAMENTS = buildTournaments();

// ─── Players ──────────────────────────────────────────────────────────────────

export const MOCK_PLAYERS = [
  { id: 'p1',  name: 'Aaron Traylor',    country: 'United States',  flag: '🇺🇸', tournaments: 18, wins: 3, top_cuts: 12, best_placing: 1, win_rate: 61.4 },
  { id: 'p2',  name: 'Wolfe Glick',      country: 'United States',  flag: '🇺🇸', tournaments: 21, wins: 4, top_cuts: 15, best_placing: 1, win_rate: 63.2 },
  { id: 'p3',  name: 'Sejun Park',       country: 'South Korea',    flag: '🇰🇷', tournaments: 16, wins: 2, top_cuts: 10, best_placing: 1, win_rate: 58.7 },
  { id: 'p4',  name: 'Markus Stadter',   country: 'Germany',        flag: '🇩🇪', tournaments: 19, wins: 3, top_cuts: 11, best_placing: 1, win_rate: 59.1 },
  { id: 'p5',  name: 'Toler Webb',       country: 'United States',  flag: '🇺🇸', tournaments: 14, wins: 2, top_cuts: 9,  best_placing: 1, win_rate: 57.3 },
  { id: 'p6',  name: 'Paul Chua',        country: 'Singapore',      flag: '🇸🇬', tournaments: 12, wins: 1, top_cuts: 7,  best_placing: 1, win_rate: 55.8 },
  { id: 'p7',  name: 'Edu Folgueras',    country: 'Spain',          flag: '🇪🇸', tournaments: 17, wins: 2, top_cuts: 8,  best_placing: 2, win_rate: 54.2 },
  { id: 'p8',  name: 'Barry Anderson',   country: 'United Kingdom', flag: '🇬🇧', tournaments: 15, wins: 1, top_cuts: 8,  best_placing: 2, win_rate: 53.9 },
  { id: 'p9',  name: 'James Baek',       country: 'Canada',         flag: '🇨🇦', tournaments: 13, wins: 1, top_cuts: 6,  best_placing: 3, win_rate: 53.1 },
  { id: 'p10', name: 'Aaron Park',       country: 'South Korea',    flag: '🇰🇷', tournaments: 20, wins: 2, top_cuts: 9,  best_placing: 2, win_rate: 56.4 },
  { id: 'p11', name: 'Gabby Snyder',     country: 'United States',  flag: '🇺🇸', tournaments: 11, wins: 1, top_cuts: 5,  best_placing: 3, win_rate: 52.6 },
  { id: 'p12', name: 'Nicholas Kan',     country: 'Hong Kong',      flag: '🇭🇰', tournaments: 9,  wins: 1, top_cuts: 4,  best_placing: 4, win_rate: 51.8 },
  { id: 'p13', name: 'Hirofumi Kimura',  country: 'Japan',          flag: '🇯🇵', tournaments: 14, wins: 0, top_cuts: 6,  best_placing: 3, win_rate: 50.9 },
  { id: 'p14', name: 'Ryota Otsubo',     country: 'Japan',          flag: '🇯🇵', tournaments: 12, wins: 0, top_cuts: 5,  best_placing: 4, win_rate: 50.3 },
  { id: 'p15', name: 'Emilio Forbes',    country: 'Brazil',         flag: '🇧🇷', tournaments: 10, wins: 0, top_cuts: 4,  best_placing: 5, win_rate: 49.7 },
  { id: 'p16', name: 'Lee Provost',      country: 'Australia',      flag: '🇦🇺', tournaments: 8,  wins: 0, top_cuts: 3,  best_placing: 6, win_rate: 48.5 },
  { id: 'p17', name: 'Melanie Yates',    country: 'United States',  flag: '🇺🇸', tournaments: 11, wins: 0, top_cuts: 3,  best_placing: 7, win_rate: 47.9 },
  { id: 'p18', name: 'Giovanni Costa',   country: 'Italy',          flag: '🇮🇹', tournaments: 7,  wins: 0, top_cuts: 2,  best_placing: 8, win_rate: 46.2 },
];

// ─── Tournament standings ─────────────────────────────────────────────────────

type StandingRow = { placing: number; player_id: string; player_name: string; country: string; flag: string; wins: number; losses: number; team: string[] };

const DEFAULT_STANDINGS: StandingRow[] = [
  { placing: 1, player_id: 'p2',  player_name: 'Wolfe Glick',      country: 'United States',  flag: '🇺🇸', wins: 7, losses: 1, team: ['Garchomp', 'Mewtwo', 'Groudon', 'Kyogre', 'Rayquaza', 'Gengar']     },
  { placing: 2, player_id: 'p1',  player_name: 'Aaron Traylor',    country: 'United States',  flag: '🇺🇸', wins: 6, losses: 2, team: ['Mewtwo', 'Groudon', 'Kyogre', 'Salamence', 'Gengar', 'Medicham']     },
  { placing: 3, player_id: 'p3',  player_name: 'Sejun Park',       country: 'South Korea',    flag: '🇰🇷', wins: 6, losses: 2, team: ['Rayquaza', 'Garchomp', 'Charizard', 'Venusaur', 'Swampert', 'Lucario']  },
  { placing: 4, player_id: 'p4',  player_name: 'Markus Stadter',   country: 'Germany',        flag: '🇩🇪', wins: 5, losses: 3, team: ['Kyogre', 'Groudon', 'Gengar', 'Salamence', 'Blaziken', 'Garchomp']    },
  { placing: 5, player_id: 'p5',  player_name: 'Toler Webb',       country: 'United States',  flag: '🇺🇸', wins: 5, losses: 3, team: ['Mewtwo', 'Rayquaza', 'Blastoise', 'Medicham', 'Charizard', 'Swampert'] },
  { placing: 6, player_id: 'p6',  player_name: 'Paul Chua',        country: 'Singapore',      flag: '🇸🇬', wins: 5, losses: 3, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
  { placing: 7, player_id: 'p7',  player_name: 'Edu Folgueras',    country: 'Spain',          flag: '🇪🇸', wins: 4, losses: 4, team: ['Salamence', 'Charizard', 'Groudon', 'Lucario', 'Garchomp', 'Rayquaza']  },
  { placing: 8, player_id: 'p8',  player_name: 'Barry Anderson',   country: 'United Kingdom', flag: '🇬🇧', wins: 4, losses: 4, team: ['Garchomp', 'Charizard', 'Blaziken', 'Blastoise', 'Salamence', 'Lucario'] },
];

export const MOCK_TOURNAMENT_STANDINGS: Record<string, StandingRow[]> = {
  t1: [
    { placing: 1, player_id: 'p1',  player_name: 'Aaron Traylor',    country: 'United States',  flag: '🇺🇸', wins: 7, losses: 1, team: ['Garchomp', 'Mewtwo', 'Groudon', 'Kyogre', 'Rayquaza', 'Gengar']      },
    { placing: 2, player_id: 'p3',  player_name: 'Sejun Park',       country: 'South Korea',    flag: '🇰🇷', wins: 6, losses: 2, team: ['Mewtwo', 'Groudon', 'Kyogre', 'Salamence', 'Gengar', 'Medicham']      },
    { placing: 3, player_id: 'p5',  player_name: 'Toler Webb',       country: 'United States',  flag: '🇺🇸', wins: 6, losses: 2, team: ['Rayquaza', 'Garchomp', 'Charizard', 'Venusaur', 'Swampert', 'Lucario'] },
    { placing: 4, player_id: 'p13', player_name: 'Hirofumi Kimura',  country: 'Japan',          flag: '🇯🇵', wins: 5, losses: 3, team: ['Kyogre', 'Groudon', 'Gengar', 'Salamence', 'Blaziken', 'Garchomp']    },
    { placing: 5, player_id: 'p7',  player_name: 'Edu Folgueras',    country: 'Spain',          flag: '🇪🇸', wins: 5, losses: 3, team: ['Mewtwo', 'Rayquaza', 'Blastoise', 'Medicham', 'Charizard', 'Swampert'] },
    { placing: 6, player_id: 'p15', player_name: 'Emilio Forbes',    country: 'Brazil',         flag: '🇧🇷', wins: 5, losses: 3, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
    { placing: 7, player_id: 'p16', player_name: 'Lee Provost',      country: 'Australia',      flag: '🇦🇺', wins: 4, losses: 4, team: ['Salamence', 'Charizard', 'Groudon', 'Lucario', 'Garchomp', 'Rayquaza']  },
    { placing: 8, player_id: 'p17', player_name: 'Melanie Yates',    country: 'United States',  flag: '🇺🇸', wins: 4, losses: 4, team: ['Garchomp', 'Charizard', 'Blaziken', 'Blastoise', 'Salamence', 'Lucario'] },
  ],
  t2: [
    { placing: 1, player_id: 'p4',  player_name: 'Markus Stadter',   country: 'Germany',        flag: '🇩🇪', wins: 7, losses: 1, team: ['Mewtwo', 'Rayquaza', 'Blastoise', 'Medicham', 'Charizard', 'Swampert'] },
    { placing: 2, player_id: 'p2',  player_name: 'Wolfe Glick',      country: 'United States',  flag: '🇺🇸', wins: 6, losses: 2, team: ['Garchomp', 'Mewtwo', 'Groudon', 'Kyogre', 'Rayquaza', 'Gengar']      },
    { placing: 3, player_id: 'p10', player_name: 'Aaron Park',       country: 'South Korea',    flag: '🇰🇷', wins: 6, losses: 2, team: ['Salamence', 'Charizard', 'Groudon', 'Lucario', 'Garchomp', 'Rayquaza'] },
    { placing: 4, player_id: 'p6',  player_name: 'Paul Chua',        country: 'Singapore',      flag: '🇸🇬', wins: 5, losses: 3, team: ['Garchomp', 'Charizard', 'Blaziken', 'Blastoise', 'Salamence', 'Lucario'] },
    { placing: 5, player_id: 'p8',  player_name: 'Barry Anderson',   country: 'United Kingdom', flag: '🇬🇧', wins: 5, losses: 3, team: ['Mewtwo', 'Groudon', 'Kyogre', 'Salamence', 'Gengar', 'Medicham']      },
    { placing: 6, player_id: 'p14', player_name: 'Ryota Otsubo',     country: 'Japan',          flag: '🇯🇵', wins: 5, losses: 3, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
    { placing: 7, player_id: 'p11', player_name: 'Gabby Snyder',     country: 'United States',  flag: '🇺🇸', wins: 4, losses: 4, team: ['Rayquaza', 'Garchomp', 'Charizard', 'Venusaur', 'Swampert', 'Lucario'] },
    { placing: 8, player_id: 'p18', player_name: 'Giovanni Costa',   country: 'Italy',          flag: '🇮🇹', wins: 4, losses: 4, team: ['Kyogre', 'Groudon', 'Gengar', 'Salamence', 'Blaziken', 'Garchomp']    },
  ],
  t3: [
    { placing: 1, player_id: 'p2',  player_name: 'Wolfe Glick',      country: 'United States',  flag: '🇺🇸', wins: 8, losses: 0, team: ['Garchomp', 'Mewtwo', 'Groudon', 'Kyogre', 'Rayquaza', 'Gengar']      },
    { placing: 2, player_id: 'p4',  player_name: 'Markus Stadter',   country: 'Germany',        flag: '🇩🇪', wins: 6, losses: 2, team: ['Mewtwo', 'Rayquaza', 'Blastoise', 'Medicham', 'Charizard', 'Swampert'] },
    { placing: 3, player_id: 'p9',  player_name: 'James Baek',       country: 'Canada',         flag: '🇨🇦', wins: 6, losses: 2, team: ['Salamence', 'Charizard', 'Groudon', 'Lucario', 'Garchomp', 'Rayquaza'] },
    { placing: 4, player_id: 'p12', player_name: 'Nicholas Kan',     country: 'Hong Kong',      flag: '🇭🇰', wins: 5, losses: 3, team: ['Kyogre', 'Groudon', 'Gengar', 'Salamence', 'Blaziken', 'Garchomp']    },
    { placing: 5, player_id: 'p1',  player_name: 'Aaron Traylor',    country: 'United States',  flag: '🇺🇸', wins: 5, losses: 3, team: ['Garchomp', 'Charizard', 'Blaziken', 'Blastoise', 'Salamence', 'Lucario'] },
    { placing: 6, player_id: 'p13', player_name: 'Hirofumi Kimura',  country: 'Japan',          flag: '🇯🇵', wins: 4, losses: 4, team: ['Mewtwo', 'Groudon', 'Kyogre', 'Salamence', 'Gengar', 'Medicham']      },
    { placing: 7, player_id: 'p3',  player_name: 'Sejun Park',       country: 'South Korea',    flag: '🇰🇷', wins: 4, losses: 4, team: ['Rayquaza', 'Garchomp', 'Charizard', 'Venusaur', 'Swampert', 'Lucario'] },
    { placing: 8, player_id: 'p15', player_name: 'Emilio Forbes',    country: 'Brazil',         flag: '🇧🇷', wins: 3, losses: 5, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
  ],
  t4: [
    { placing: 1, player_id: 'p5',  player_name: 'Toler Webb',       country: 'United States',  flag: '🇺🇸', wins: 7, losses: 1, team: ['Rayquaza', 'Garchomp', 'Charizard', 'Venusaur', 'Swampert', 'Lucario'] },
    { placing: 2, player_id: 'p3',  player_name: 'Sejun Park',       country: 'South Korea',    flag: '🇰🇷', wins: 6, losses: 2, team: ['Mewtwo', 'Groudon', 'Kyogre', 'Salamence', 'Gengar', 'Medicham']      },
    { placing: 3, player_id: 'p10', player_name: 'Aaron Park',       country: 'South Korea',    flag: '🇰🇷', wins: 6, losses: 2, team: ['Garchomp', 'Mewtwo', 'Groudon', 'Kyogre', 'Rayquaza', 'Gengar']      },
    { placing: 4, player_id: 'p2',  player_name: 'Wolfe Glick',      country: 'United States',  flag: '🇺🇸', wins: 5, losses: 3, team: ['Salamence', 'Charizard', 'Groudon', 'Lucario', 'Garchomp', 'Rayquaza'] },
    { placing: 5, player_id: 'p16', player_name: 'Lee Provost',      country: 'Australia',      flag: '🇦🇺', wins: 5, losses: 3, team: ['Mewtwo', 'Rayquaza', 'Blastoise', 'Medicham', 'Charizard', 'Swampert'] },
    { placing: 6, player_id: 'p7',  player_name: 'Edu Folgueras',    country: 'Spain',          flag: '🇪🇸', wins: 4, losses: 4, team: ['Kyogre', 'Groudon', 'Gengar', 'Salamence', 'Blaziken', 'Garchomp']    },
    { placing: 7, player_id: 'p11', player_name: 'Gabby Snyder',     country: 'United States',  flag: '🇺🇸', wins: 4, losses: 4, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
    { placing: 8, player_id: 'p18', player_name: 'Giovanni Costa',   country: 'Italy',          flag: '🇮🇹', wins: 3, losses: 5, team: ['Garchomp', 'Charizard', 'Blaziken', 'Blastoise', 'Salamence', 'Lucario'] },
  ],
  t5: [
    { placing: 1, player_id: 'p6',  player_name: 'Paul Chua',        country: 'Singapore',      flag: '🇸🇬', wins: 7, losses: 1, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
    { placing: 2, player_id: 'p1',  player_name: 'Aaron Traylor',    country: 'United States',  flag: '🇺🇸', wins: 6, losses: 2, team: ['Garchomp', 'Mewtwo', 'Groudon', 'Kyogre', 'Rayquaza', 'Gengar']      },
    { placing: 3, player_id: 'p14', player_name: 'Ryota Otsubo',     country: 'Japan',          flag: '🇯🇵', wins: 6, losses: 2, team: ['Mewtwo', 'Rayquaza', 'Blastoise', 'Medicham', 'Charizard', 'Swampert'] },
    { placing: 4, player_id: 'p8',  player_name: 'Barry Anderson',   country: 'United Kingdom', flag: '🇬🇧', wins: 5, losses: 3, team: ['Salamence', 'Charizard', 'Groudon', 'Lucario', 'Garchomp', 'Rayquaza'] },
    { placing: 5, player_id: 'p4',  player_name: 'Markus Stadter',   country: 'Germany',        flag: '🇩🇪', wins: 5, losses: 3, team: ['Mewtwo', 'Groudon', 'Kyogre', 'Salamence', 'Gengar', 'Medicham']      },
    { placing: 6, player_id: 'p9',  player_name: 'James Baek',       country: 'Canada',         flag: '🇨🇦', wins: 5, losses: 3, team: ['Kyogre', 'Groudon', 'Gengar', 'Salamence', 'Blaziken', 'Garchomp']    },
    { placing: 7, player_id: 'p12', player_name: 'Nicholas Kan',     country: 'Hong Kong',      flag: '🇭🇰', wins: 4, losses: 4, team: ['Rayquaza', 'Garchomp', 'Charizard', 'Venusaur', 'Swampert', 'Lucario'] },
    { placing: 8, player_id: 'p13', player_name: 'Hirofumi Kimura',  country: 'Japan',          flag: '🇯🇵', wins: 3, losses: 5, team: ['Garchomp', 'Gengar', 'Venusaur', 'Mewtwo', 'Kyogre', 'Blaziken']      },
  ],
  default: DEFAULT_STANDINGS,
};

// ─── Player career results ─────────────────────────────────────────────────────

type PlayerResult = { tournament_id: string; tournament_name: string; date: string; placing: number; wins: number; losses: number; team: string[] };

const DEFAULT_RESULTS: PlayerResult[] = [
  { tournament_id: 't7',  tournament_name: 'Regional Championships — Indianapolis', date: '2026-02-25', placing: 1, wins: 7, losses: 1, team: TEAMS[0] },
  { tournament_id: 't12', tournament_name: 'Regional Championships — Charlotte',   date: '2026-04-11', placing: 3, wins: 6, losses: 2, team: TEAMS[2] },
  { tournament_id: 't18', tournament_name: 'Regional Championships — Richmond',    date: '2026-06-04', placing: 2, wins: 6, losses: 2, team: TEAMS[4] },
  { tournament_id: 't23', tournament_name: 'Regional Championships — Phoenix',     date: '2026-07-21', placing: 5, wins: 5, losses: 3, team: TEAMS[1] },
  { tournament_id: 't30', tournament_name: 'Regional Championships — Denver',      date: '2026-09-16', placing: 4, wins: 5, losses: 3, team: TEAMS[3] },
];

export const MOCK_PLAYER_RESULTS: Record<string, PlayerResult[]> = {
  p1: [
    { tournament_id: 't1',  tournament_name: 'Regional Championships — Milwaukee',    date: '2026-01-04', placing: 1, wins: 7, losses: 1, team: TEAMS[0] },
    { tournament_id: 't5',  tournament_name: 'Regional Championships — Portland',     date: '2026-01-16', placing: 3, wins: 6, losses: 2, team: TEAMS[0] },
    { tournament_id: 't9',  tournament_name: 'Regional Championships — Cleveland',    date: '2026-01-28', placing: 5, wins: 5, losses: 3, team: TEAMS[0] },
    { tournament_id: 't14', tournament_name: 'Regional Championships — Charlotte',    date: '2026-02-17', placing: 2, wins: 6, losses: 2, team: TEAMS[0] },
    { tournament_id: 't20', tournament_name: 'International Championships — Sydney',  date: '2026-03-08', placing: 8, wins: 4, losses: 4, team: TEAMS[0] },
    { tournament_id: 't25', tournament_name: 'Regional Championships — Denver',       date: '2026-04-15', placing: 1, wins: 7, losses: 1, team: TEAMS[0] },
    { tournament_id: 't30', tournament_name: 'Regional Championships — Columbus',     date: '2026-05-27', placing: 4, wins: 5, losses: 3, team: TEAMS[0] },
    { tournament_id: 't35', tournament_name: 'Regional Championships — Kansas City',  date: '2026-07-09', placing: 6, wins: 5, losses: 3, team: TEAMS[0] },
    { tournament_id: 't40', tournament_name: 'Regional Championships — Nashville',    date: '2026-08-21', placing: 2, wins: 6, losses: 2, team: TEAMS[0] },
  ],
  p2: [
    { tournament_id: 't2',  tournament_name: 'Regional Championships — Hartford',     date: '2026-01-07', placing: 1, wins: 7, losses: 1, team: TEAMS[1] },
    { tournament_id: 't3',  tournament_name: 'Regional Championships — Salt Lake City',date:'2026-01-10', placing: 1, wins: 8, losses: 0, team: TEAMS[1] },
    { tournament_id: 't4',  tournament_name: 'Regional Championships — Memphis',      date: '2026-01-13', placing: 4, wins: 5, losses: 3, team: TEAMS[1] },
    { tournament_id: 't10', tournament_name: 'Regional Championships — Indianapolis', date: '2026-01-31', placing: 2, wins: 6, losses: 2, team: TEAMS[1] },
    { tournament_id: 't16', tournament_name: 'Regional Championships — Phoenix',      date: '2026-02-23', placing: 1, wins: 7, losses: 1, team: TEAMS[1] },
    { tournament_id: 't22', tournament_name: 'Regional Championships — Raleigh',      date: '2026-03-17', placing: 3, wins: 6, losses: 2, team: TEAMS[1] },
    { tournament_id: 't28', tournament_name: 'Regional Championships — Pittsburgh',   date: '2026-05-03', placing: 5, wins: 5, losses: 3, team: TEAMS[1] },
    { tournament_id: 't34', tournament_name: 'International Championships — Berlin',  date: '2026-06-24', placing: 1, wins: 7, losses: 1, team: TEAMS[1] },
    { tournament_id: 't38', tournament_name: 'Regional Championships — Minneapolis',  date: '2026-08-03', placing: 2, wins: 6, losses: 2, team: TEAMS[1] },
    { tournament_id: 't42', tournament_name: 'Regional Championships — Wichita',      date: '2026-09-15', placing: 7, wins: 4, losses: 4, team: TEAMS[1] },
  ],
  p3: [
    { tournament_id: 't1',  tournament_name: 'Regional Championships — Milwaukee',    date: '2026-01-04', placing: 2, wins: 6, losses: 2, team: TEAMS[2] },
    { tournament_id: 't4',  tournament_name: 'Regional Championships — Memphis',      date: '2026-01-13', placing: 1, wins: 7, losses: 1, team: TEAMS[2] },
    { tournament_id: 't11', tournament_name: 'Regional Championships — Charlotte',    date: '2026-02-03', placing: 3, wins: 6, losses: 2, team: TEAMS[2] },
    { tournament_id: 't18', tournament_name: 'Regional Championships — Richmond',     date: '2026-03-02', placing: 4, wins: 5, losses: 3, team: TEAMS[2] },
    { tournament_id: 't24', tournament_name: 'Regional Championships — Columbus',     date: '2026-04-10', placing: 1, wins: 7, losses: 1, team: TEAMS[2] },
    { tournament_id: 't29', tournament_name: 'Regional Championships — Kansas City',  date: '2026-05-06', placing: 6, wins: 5, losses: 3, team: TEAMS[2] },
    { tournament_id: 't36', tournament_name: 'Regional Championships — Nashville',    date: '2026-07-12', placing: 2, wins: 6, losses: 2, team: TEAMS[2] },
    { tournament_id: 't41', tournament_name: 'Regional Championships — Boise',        date: '2026-08-24', placing: 5, wins: 5, losses: 3, team: TEAMS[2] },
  ],
  p4: [
    { tournament_id: 't2',  tournament_name: 'Regional Championships — Hartford',     date: '2026-01-07', placing: 1, wins: 7, losses: 1, team: TEAMS[3] },
    { tournament_id: 't6',  tournament_name: 'Regional Championships — Cleveland',    date: '2026-01-19', placing: 3, wins: 6, losses: 2, team: TEAMS[3] },
    { tournament_id: 't13', tournament_name: 'Regional Championships — Indianapolis', date: '2026-02-10', placing: 1, wins: 7, losses: 1, team: TEAMS[3] },
    { tournament_id: 't19', tournament_name: 'Regional Championships — Phoenix',      date: '2026-03-05', placing: 2, wins: 6, losses: 2, team: TEAMS[3] },
    { tournament_id: 't26', tournament_name: 'Regional Championships — Denver',       date: '2026-04-18', placing: 4, wins: 5, losses: 3, team: TEAMS[3] },
    { tournament_id: 't31', tournament_name: 'Regional Championships — Columbus',     date: '2026-05-30', placing: 1, wins: 7, losses: 1, team: TEAMS[3] },
    { tournament_id: 't37', tournament_name: 'Regional Championships — Minneapolis',  date: '2026-07-15', placing: 5, wins: 5, losses: 3, team: TEAMS[3] },
    { tournament_id: 't42', tournament_name: 'Regional Championships — Wichita',      date: '2026-09-15', placing: 3, wins: 6, losses: 2, team: TEAMS[3] },
  ],
  p5: [
    { tournament_id: 't1',  tournament_name: 'Regional Championships — Milwaukee',    date: '2026-01-04', placing: 3, wins: 6, losses: 2, team: TEAMS[4] },
    { tournament_id: 't5',  tournament_name: 'Regional Championships — Portland',     date: '2026-01-16', placing: 1, wins: 7, losses: 1, team: TEAMS[4] },
    { tournament_id: 't12', tournament_name: 'Regional Championships — Charlotte',    date: '2026-02-07', placing: 2, wins: 6, losses: 2, team: TEAMS[4] },
    { tournament_id: 't20', tournament_name: 'International Championships — Sydney',  date: '2026-03-08', placing: 4, wins: 5, losses: 3, team: TEAMS[4] },
    { tournament_id: 't27', tournament_name: 'Regional Championships — Kansas City',  date: '2026-04-21', placing: 1, wins: 7, losses: 1, team: TEAMS[4] },
    { tournament_id: 't33', tournament_name: 'Regional Championships — Nashville',    date: '2026-06-21', placing: 6, wins: 5, losses: 3, team: TEAMS[4] },
    { tournament_id: 't39', tournament_name: 'Regional Championships — Baltimore',    date: '2026-08-06', placing: 5, wins: 5, losses: 3, team: TEAMS[4] },
  ],
  default: DEFAULT_RESULTS,
};

// ─── Pokemon usage ────────────────────────────────────────────────────────────

export const MOCK_POKEMON_USAGE = [
  { species: 'Garchomp',    usage_pct: 42.3, win_rate: 54.8, teams: 987,  unique_players: 614, top_cut_players: 201, top_cut_teams: 312, top_cut_usage: 51.1, top_cut_wr: 57.2 },
  { species: 'Mewtwo',      usage_pct: 38.1, win_rate: 53.5, teams: 890,  unique_players: 571, top_cut_players: 183, top_cut_teams: 289, top_cut_usage: 47.3, top_cut_wr: 55.0 },
  { species: 'Groudon',     usage_pct: 35.6, win_rate: 51.2, teams: 831,  unique_players: 534, top_cut_players: 158, top_cut_teams: 244, top_cut_usage: 40.0, top_cut_wr: 52.1 },
  { species: 'Kyogre',      usage_pct: 33.4, win_rate: 50.9, teams: 779,  unique_players: 502, top_cut_players: 141, top_cut_teams: 210, top_cut_usage: 34.4, top_cut_wr: 51.7 },
  { species: 'Rayquaza',    usage_pct: 29.7, win_rate: 56.1, teams: 693,  unique_players: 421, top_cut_players: 162, top_cut_teams: 248, top_cut_usage: 40.7, top_cut_wr: 58.4 },
  { species: 'Salamence',   usage_pct: 27.2, win_rate: 49.4, teams: 635,  unique_players: 398, top_cut_players: 109, top_cut_teams: 178, top_cut_usage: 29.2, top_cut_wr: 50.3 },
  { species: 'Gengar',      usage_pct: 24.8, win_rate: 48.7, teams: 579,  unique_players: 361, top_cut_players: 91,  top_cut_teams: 143, top_cut_usage: 23.4, top_cut_wr: 49.1 },
  { species: 'Charizard',   usage_pct: 22.1, win_rate: 51.6, teams: 516,  unique_players: 334, top_cut_players: 104, top_cut_teams: 162, top_cut_usage: 26.6, top_cut_wr: 53.2 },
  { species: 'Blaziken',    usage_pct: 19.4, win_rate: 50.1, teams: 453,  unique_players: 287, top_cut_players: 83,  top_cut_teams: 130, top_cut_usage: 21.3, top_cut_wr: 51.8 },
  { species: 'Blastoise',   usage_pct: 17.3, win_rate: 47.9, teams: 404,  unique_players: 251, top_cut_players: 61,  top_cut_teams: 98,  top_cut_usage: 16.1, top_cut_wr: 48.6 },
  { species: 'Venusaur',    usage_pct: 15.8, win_rate: 49.3, teams: 369,  unique_players: 231, top_cut_players: 54,  top_cut_teams: 88,  top_cut_usage: 14.4, top_cut_wr: 50.0 },
  { species: 'Swampert',    usage_pct: 14.2, win_rate: 47.1, teams: 331,  unique_players: 204, top_cut_players: 44,  top_cut_teams: 74,  top_cut_usage: 12.1, top_cut_wr: 47.9 },
  { species: 'Sceptile',    usage_pct: 11.7, win_rate: 46.8, teams: 273,  unique_players: 168, top_cut_players: 31,  top_cut_teams: 51,  top_cut_usage:  8.4, top_cut_wr: 47.2 },
  { species: 'Lucario',     usage_pct:  9.9, win_rate: 57.4, teams: 231,  unique_players:  12, top_cut_players: 8,   top_cut_teams: 62,  top_cut_usage: 10.2, top_cut_wr: 51.0 },
  { species: 'Medicham',    usage_pct:  8.3, win_rate: 45.5, teams: 194,  unique_players: 118, top_cut_players: 22,  top_cut_teams: 38,  top_cut_usage:  6.2, top_cut_wr: 44.8 },
];

// ─── Mega usage ───────────────────────────────────────────────────────────────

export const MOCK_MEGA_USAGE = [
  { pokemon: 'Garchompite',    usage_pct: 38.4, win_rate: 54.8, teams: 896,  top_cut_teams: 298, top_cut_usage: 48.9, top_cut_wr: 57.1 },
  { pokemon: 'Mewtwoite Y',    usage_pct: 34.9, win_rate: 53.5, teams: 815,  top_cut_teams: 264, top_cut_usage: 43.3, top_cut_wr: 55.2 },
  { pokemon: 'Salamencite',    usage_pct: 26.1, win_rate: 49.4, teams: 609,  top_cut_teams: 170, top_cut_usage: 27.9, top_cut_wr: 50.1 },
  { pokemon: 'Gengarite',      usage_pct: 22.7, win_rate: 48.7, teams: 530,  top_cut_teams: 131, top_cut_usage: 21.5, top_cut_wr: 49.0 },
  { pokemon: 'Charizardite X', usage_pct: 18.3, win_rate: 51.6, teams: 427,  top_cut_teams: 142, top_cut_usage: 23.3, top_cut_wr: 53.4 },
  { pokemon: 'Blazikenite',    usage_pct: 16.8, win_rate: 50.1, teams: 392,  top_cut_teams: 112, top_cut_usage: 18.4, top_cut_wr: 51.6 },
  { pokemon: 'Blastoisinite',  usage_pct: 14.5, win_rate: 47.9, teams: 339,  top_cut_teams: 82,  top_cut_usage: 13.5, top_cut_wr: 48.4 },
  { pokemon: 'Venusaurite',    usage_pct: 12.1, win_rate: 49.3, teams: 282,  top_cut_teams: 67,  top_cut_usage: 11.0, top_cut_wr: 49.9 },
];

// ─── Mega H2H ─────────────────────────────────────────────────────────────────

export const MOCK_MEGA_H2H = [
  { mega1: 'Garchompite',    mega2: 'Mewtwoite Y',    matches: 312, mega1_wins: 168, mega2_wins: 144, mega1_wr: 53.8, top_cut_matches: 98, top_cut_mega1_wins: 54, top_cut_mega2_wins: 44, top_cut_mega1_wr: 55.1 },
  { mega1: 'Garchompite',    mega2: 'Salamencite',    matches: 248, mega1_wins: 141, mega2_wins: 107, mega1_wr: 56.9, top_cut_matches: 72, top_cut_mega1_wins: 43, top_cut_mega2_wins: 29, top_cut_mega1_wr: 59.7 },
  { mega1: 'Garchompite',    mega2: 'Gengarite',      matches: 201, mega1_wins: 109, mega2_wins:  92, mega1_wr: 54.2, top_cut_matches: 54, top_cut_mega1_wins: 30, top_cut_mega2_wins: 24, top_cut_mega1_wr: 55.6 },
  { mega1: 'Mewtwoite Y',    mega2: 'Salamencite',    matches: 209, mega1_wins: 115, mega2_wins:  94, mega1_wr: 55.0, top_cut_matches: 63, top_cut_mega1_wins: 36, top_cut_mega2_wins: 27, top_cut_mega1_wr: 57.1 },
  { mega1: 'Mewtwoite Y',    mega2: 'Gengarite',      matches: 175, mega1_wins:  91, mega2_wins:  84, mega1_wr: 52.0, top_cut_matches: 48, top_cut_mega1_wins: 25, top_cut_mega2_wins: 23, top_cut_mega1_wr: 52.1 },
  { mega1: 'Charizardite X', mega2: 'Blazikenite',    matches: 134, mega1_wins:  72, mega2_wins:  62, mega1_wr: 53.7, top_cut_matches: 38, top_cut_mega1_wins: 21, top_cut_mega2_wins: 17, top_cut_mega1_wr: 55.3 },
  { mega1: 'Salamencite',    mega2: 'Gengarite',      matches: 163, mega1_wins:  80, mega2_wins:  83, mega1_wr: 49.1, top_cut_matches: 42, top_cut_mega1_wins: 20, top_cut_mega2_wins: 22, top_cut_mega1_wr: 47.6 },
];

// ─── Mega combos ──────────────────────────────────────────────────────────────

export const MOCK_MEGA_COMBOS = [
  { combo: 'Garchompite + Mewtwoite Y',    teams: 247, usage_pct: 10.6, win_rate: 55.3, top_cut_teams: 89, top_cut_usage: 14.6, top_cut_wr: 57.9 },
  { combo: 'Garchompite + Salamencite',    teams: 182, usage_pct:  7.8, win_rate: 52.1, top_cut_teams: 61, top_cut_usage: 10.0, top_cut_wr: 54.1 },
  { combo: 'Mewtwoite Y + Gengarite',      teams: 158, usage_pct:  6.8, win_rate: 50.7, top_cut_teams: 48, top_cut_usage:  7.9, top_cut_wr: 52.1 },
  { combo: 'Charizardite X + Blazikenite', teams: 113, usage_pct:  4.8, win_rate: 51.6, top_cut_teams: 38, top_cut_usage:  6.2, top_cut_wr: 53.3 },
  { combo: 'Garchompite + Gengarite',      teams:  96, usage_pct:  4.1, win_rate: 53.8, top_cut_teams: 34, top_cut_usage:  5.6, top_cut_wr: 55.9 },
];

// ─── Mega teammates (Garchompite) ─────────────────────────────────────────────

export const MOCK_MEGA_TEAMMATES: Record<string, unknown[]> = {
  'Garchompite': [
    { species: 'Mewtwo',    teams: 287, usage_pct: 32.1, win_rate_with: 56.4, win_rate_without: 52.1 },
    { species: 'Kyogre',    teams: 241, usage_pct: 26.9, win_rate_with: 53.8, win_rate_without: 54.9 },
    { species: 'Groudon',   teams: 218, usage_pct: 24.3, win_rate_with: 55.2, win_rate_without: 53.7 },
    { species: 'Rayquaza',  teams: 189, usage_pct: 21.1, win_rate_with: 57.9, win_rate_without: 52.8 },
    { species: 'Gengar',    teams: 163, usage_pct: 18.2, win_rate_with: 52.4, win_rate_without: 55.1 },
    { species: 'Charizard', teams: 141, usage_pct: 15.7, win_rate_with: 54.1, win_rate_without: 54.8 },
    { species: 'Blaziken',  teams: 118, usage_pct: 13.2, win_rate_with: 51.7, win_rate_without: 55.3 },
  ],
  default: [
    { species: 'Garchomp',  teams: 201, usage_pct: 28.4, win_rate_with: 55.1, win_rate_without: 52.8 },
    { species: 'Mewtwo',    teams: 178, usage_pct: 25.2, win_rate_with: 54.3, win_rate_without: 53.1 },
    { species: 'Groudon',   teams: 152, usage_pct: 21.5, win_rate_with: 52.7, win_rate_without: 53.9 },
    { species: 'Kyogre',    teams: 134, usage_pct: 19.0, win_rate_with: 51.2, win_rate_without: 54.4 },
    { species: 'Rayquaza',  teams: 109, usage_pct: 15.4, win_rate_with: 56.8, win_rate_without: 52.5 },
  ],
};

// ─── Row trend helper ─────────────────────────────────────────────────────────

const ROW_DATES = [
  'Jan 4','Jan 11','Jan 18','Jan 25','Feb 1','Feb 8',
  'Feb 15','Feb 22','Mar 1','Mar 8','Mar 15','Mar 22','Mar 29','Apr 5',
];

function rowTrend(u0: number, u1: number, wr0: number, wr1: number): TrendPoint[] {
  return ROW_DATES.map((date, i) => {
    const t = i / (ROW_DATES.length - 1);
    const wave = Math.sin(i * 0.9) * 0.8;
    return {
      date,
      usage_pct: +(u0 + (u1 - u0) * t + wave).toFixed(1),
      win_rate:  +(wr0 + (wr1 - wr0) * t + wave * 0.5).toFixed(1),
    };
  });
}

// ─── Pokemon moves (Garchomp) ─────────────────────────────────────────────────

export const MOCK_POKEMON_MOVES: Record<string, unknown[]> = {
  Garchomp: [
    { move_name: 'Earthquake',       type: 'Ground',   category: 'physical', teams: 891, win_rate: 55.3, trend: rowTrend(87.1, 90.3, 54.0, 55.3) },
    { move_name: 'Protect',          type: 'Normal',   category: 'status',   teams: 876, win_rate: 54.7, trend: rowTrend(85.4, 88.8, 53.5, 54.7) },
    { move_name: 'Rock Slide',       type: 'Rock',     category: 'physical', teams: 743, win_rate: 54.1, trend: rowTrend(71.2, 75.3, 52.8, 54.1) },
    { move_name: 'Dragon Claw',      type: 'Dragon',   category: 'physical', teams: 612, win_rate: 53.8, trend: rowTrend(58.9, 62.1, 52.4, 53.8) },
    { move_name: 'Stomping Tantrum', type: 'Ground',   category: 'physical', teams: 408, win_rate: 52.4, trend: rowTrend(39.1, 41.4, 51.2, 52.4) },
    { move_name: 'Fire Fang',        type: 'Fire',     category: 'physical', teams: 287, win_rate: 51.9, trend: rowTrend(27.3, 29.1, 50.8, 51.9) },
    { move_name: 'Iron Head',        type: 'Steel',    category: 'physical', teams: 231, win_rate: 50.6, trend: rowTrend(21.8, 23.4, 49.8, 50.6) },
    { move_name: 'Scale Shot',       type: 'Dragon',   category: 'physical', teams: 184, win_rate: 48.7, trend: rowTrend(19.2, 18.6, 49.4, 48.7) },
  ],
  default: [
    { move_name: 'Protect',      type: 'Normal',   category: 'status',   teams: 432, win_rate: 53.1, trend: rowTrend(80.1, 83.4, 52.0, 53.1) },
    { move_name: 'Flamethrower', type: 'Fire',     category: 'special',  teams: 389, win_rate: 51.8, trend: rowTrend(71.4, 74.2, 50.9, 51.8) },
    { move_name: 'Ice Beam',     type: 'Ice',      category: 'special',  teams: 341, win_rate: 50.3, trend: rowTrend(62.8, 65.1, 49.5, 50.3) },
    { move_name: 'Hyper Voice',  type: 'Normal',   category: 'special',  teams: 278, win_rate: 49.7, trend: rowTrend(51.3, 53.2, 48.9, 49.7) },
    { move_name: 'Shadow Ball',  type: 'Ghost',    category: 'special',  teams: 212, win_rate: 51.2, trend: rowTrend(38.7, 40.8, 50.1, 51.2) },
    { move_name: 'Thunderbolt',  type: 'Electric', category: 'special',  teams: 189, win_rate: 48.9, trend: rowTrend(34.2, 36.3, 48.1, 48.9) },
  ],
};

// ─── Pokemon items (Garchomp) ─────────────────────────────────────────────────

export const MOCK_POKEMON_ITEMS: Record<string, unknown[]> = {
  Garchomp: [
    { item: 'Rocky Helmet', teams: 421, win_rate: 55.9, trend: rowTrend(38.4, 42.7, 54.5, 55.9) },
    { item: 'Choice Scarf', teams: 318, win_rate: 54.2, trend: rowTrend(29.8, 32.3, 53.0, 54.2) },
    { item: 'Life Orb',     teams: 201, win_rate: 52.8, trend: rowTrend(19.1, 20.4, 51.6, 52.8) },
    { item: 'Lum Berry',    teams: 147, win_rate: 51.4, trend: rowTrend(13.8, 14.9, 50.3, 51.4) },
    { item: 'Assault Vest', teams:  89, win_rate: 49.6, trend: rowTrend( 8.2,  9.0, 48.8, 49.6) },
    { item: 'Focus Sash',   teams:  62, win_rate: 47.3, trend: rowTrend( 6.4,  6.3, 47.9, 47.3) },
  ],
  default: [
    { item: 'Life Orb',      teams: 298, win_rate: 53.4, trend: rowTrend(52.1, 55.3, 52.2, 53.4) },
    { item: 'Choice Specs',  teams: 241, win_rate: 52.1, trend: rowTrend(42.4, 44.8, 51.0, 52.1) },
    { item: 'Choice Scarf',  teams: 178, win_rate: 51.7, trend: rowTrend(31.2, 33.4, 50.6, 51.7) },
    { item: 'Assault Vest',  teams: 134, win_rate: 49.8, trend: rowTrend(23.5, 25.1, 48.9, 49.8) },
    { item: 'Focus Sash',    teams:  98, win_rate: 48.2, trend: rowTrend(17.1, 18.3, 47.4, 48.2) },
  ],
};

// ─── Pokemon partners (Garchomp) ──────────────────────────────────────────────

export const MOCK_POKEMON_PARTNERS: Record<string, unknown[]> = {
  Garchomp: [
    { partner_species: 'Mewtwo',    teams: 287, usage_pct: 29.1, win_rate: 56.4, trend: rowTrend(26.8, 29.1, 55.0, 56.4) },
    { partner_species: 'Groudon',   teams: 241, usage_pct: 24.4, win_rate: 53.8, trend: rowTrend(22.1, 24.4, 52.5, 53.8) },
    { partner_species: 'Kyogre',    teams: 218, usage_pct: 22.1, win_rate: 52.1, trend: rowTrend(20.3, 22.1, 51.0, 52.1) },
    { partner_species: 'Rayquaza',  teams: 189, usage_pct: 19.2, win_rate: 57.9, trend: rowTrend(16.4, 19.2, 56.1, 57.9) },
    { partner_species: 'Gengar',    teams: 163, usage_pct: 16.5, win_rate: 52.4, trend: rowTrend(15.1, 16.5, 51.5, 52.4) },
    { partner_species: 'Blaziken',  teams: 141, usage_pct: 14.3, win_rate: 51.7, trend: rowTrend(13.2, 14.3, 50.9, 51.7) },
    { partner_species: 'Charizard', teams: 118, usage_pct: 12.0, win_rate: 54.1, trend: rowTrend(10.8, 12.0, 53.0, 54.1) },
    { partner_species: 'Blastoise', teams:  98, usage_pct:  9.9, win_rate: 48.3, trend: rowTrend( 9.4,  9.9, 49.1, 48.3) },
  ],
  default: [
    { partner_species: 'Garchomp', teams: 287, usage_pct: 29.1, win_rate: 55.2, trend: rowTrend(26.0, 29.1, 53.8, 55.2) },
    { partner_species: 'Groudon',  teams: 201, usage_pct: 20.4, win_rate: 52.8, trend: rowTrend(18.5, 20.4, 51.5, 52.8) },
    { partner_species: 'Kyogre',   teams: 178, usage_pct: 18.1, win_rate: 51.4, trend: rowTrend(16.6, 18.1, 50.2, 51.4) },
    { partner_species: 'Gengar',   teams: 143, usage_pct: 14.5, win_rate: 50.1, trend: rowTrend(13.3, 14.5, 49.2, 50.1) },
    { partner_species: 'Blaziken', teams: 112, usage_pct: 11.4, win_rate: 49.7, trend: rowTrend(10.5, 11.4, 48.9, 49.7) },
  ],
};

// ─── Pokemon matchups (Garchomp) ──────────────────────────────────────────────

export const MOCK_POKEMON_MATCHUPS: Record<string, unknown[]> = {
  Garchomp: [
    { opponent_species: 'Rayquaza',  matches: 412, wins: 241, win_rate: 58.5, trend: rowTrend(39.2, 41.4, 56.8, 58.5) },
    { opponent_species: 'Groudon',   matches: 378, wins: 214, win_rate: 56.6, trend: rowTrend(36.1, 38.4, 55.1, 56.6) },
    { opponent_species: 'Blaziken',  matches: 301, wins: 168, win_rate: 55.8, trend: rowTrend(28.8, 30.5, 54.3, 55.8) },
    { opponent_species: 'Kyogre',    matches: 351, wins: 191, win_rate: 54.4, trend: rowTrend(33.5, 35.6, 53.0, 54.4) },
    { opponent_species: 'Charizard', matches: 289, wins: 154, win_rate: 53.3, trend: rowTrend(27.6, 29.3, 52.1, 53.3) },
    { opponent_species: 'Mewtwo',    matches: 445, wins: 233, win_rate: 52.4, trend: rowTrend(42.4, 45.1, 51.2, 52.4) },
    { opponent_species: 'Gengar',    matches: 312, wins: 156, win_rate: 50.0, trend: rowTrend(29.8, 31.7, 50.8, 50.0) },
    { opponent_species: 'Salamence', matches: 267, wins: 125, win_rate: 46.8, trend: rowTrend(25.5, 27.1, 48.2, 46.8) },
    { opponent_species: 'Venusaur',  matches: 201, wins:  90, win_rate: 44.8, trend: rowTrend(19.2, 20.4, 46.3, 44.8) },
  ],
  default: [
    { opponent_species: 'Garchomp', matches: 445, wins: 212, win_rate: 47.6, trend: rowTrend(42.4, 45.1, 48.8, 47.6) },
    { opponent_species: 'Groudon',  matches: 312, wins: 159, win_rate: 51.0, trend: rowTrend(29.8, 31.7, 49.6, 51.0) },
    { opponent_species: 'Kyogre',   matches: 289, wins: 143, win_rate: 49.5, trend: rowTrend(27.5, 29.3, 48.3, 49.5) },
    { opponent_species: 'Rayquaza', matches: 234, wins: 104, win_rate: 44.4, trend: rowTrend(22.3, 23.8, 45.8, 44.4) },
    { opponent_species: 'Mewtwo',   matches: 201, wins: 100, win_rate: 49.8, trend: rowTrend(19.2, 20.4, 48.6, 49.8) },
  ],
};

// ─── Metagame summary ─────────────────────────────────────────────────────────

export const MOCK_METAGAME_SUMMARY = [{ unique_players: 1847 }];

// ─── Usage trends (weekly aggregates) ────────────────────────────────────────

export type TrendPoint = { date: string; usage_pct: number; win_rate: number };

function trend(points: [string, number, number][]): TrendPoint[] {
  return points.map(([date, usage_pct, win_rate]) => ({ date, usage_pct, win_rate }));
}

export const MOCK_POKEMON_TREND: Record<string, TrendPoint[]> = {
  Garchomp: trend([
    ['Jan 4',  34.2, 52.1], ['Jan 11', 36.8, 53.4], ['Jan 18', 38.5, 54.2],
    ['Jan 25', 40.1, 55.1], ['Feb 1',  41.8, 54.8], ['Feb 8',  43.2, 55.3],
    ['Feb 15', 42.7, 54.9], ['Feb 22', 44.1, 55.7], ['Mar 1',  43.8, 54.6],
    ['Mar 8',  42.3, 53.8], ['Mar 15', 41.9, 54.1], ['Mar 22', 42.6, 54.5],
    ['Mar 29', 43.1, 54.8], ['Apr 5',  42.3, 54.8],
  ]),
  Mewtwo: trend([
    ['Jan 4',  30.4, 51.2], ['Jan 11', 32.1, 51.9], ['Jan 18', 34.7, 52.8],
    ['Jan 25', 36.2, 53.5], ['Feb 1',  37.8, 53.1], ['Feb 8',  38.5, 53.5],
    ['Feb 15', 39.1, 53.4], ['Feb 22', 38.8, 53.8], ['Mar 1',  39.0, 53.2],
    ['Mar 8',  38.5, 53.6], ['Mar 15', 37.9, 53.3], ['Mar 22', 38.1, 53.5],
    ['Mar 29', 38.0, 53.4], ['Apr 5',  38.1, 53.5],
  ]),
  Rayquaza: trend([
    ['Jan 4',  22.1, 53.9], ['Jan 11', 23.8, 54.7], ['Jan 18', 25.4, 55.3],
    ['Jan 25', 27.0, 55.9], ['Feb 1',  27.9, 56.1], ['Feb 8',  28.6, 56.4],
    ['Feb 15', 29.1, 56.8], ['Feb 22', 29.7, 57.2], ['Mar 1',  30.2, 56.9],
    ['Mar 8',  29.8, 56.4], ['Mar 15', 29.5, 56.2], ['Mar 22', 29.7, 56.3],
    ['Mar 29', 29.8, 56.0], ['Apr 5',  29.7, 56.1],
  ]),
  default: trend([
    ['Jan 4',  18.3, 49.4], ['Jan 11', 19.1, 49.8], ['Jan 18', 20.0, 50.2],
    ['Jan 25', 20.8, 50.1], ['Feb 1',  21.4, 50.5], ['Feb 8',  21.9, 50.3],
    ['Feb 15', 22.1, 50.8], ['Feb 22', 22.0, 50.6], ['Mar 1',  21.8, 50.4],
    ['Mar 8',  21.5, 50.2], ['Mar 15', 21.7, 50.5], ['Mar 22', 21.9, 50.3],
    ['Mar 29', 22.0, 50.4], ['Apr 5',  21.8, 50.3],
  ]),
};

// ─── Pokemon players ──────────────────────────────────────────────────────────

export interface PokemonPlayerRow {
  player_id: string;
  player_name: string;
  country: string;
  flag: string;
  teams: number;
  win_rate: number;
  best_placing: number;
}

export const MOCK_POKEMON_PLAYERS: Record<string, PokemonPlayerRow[]> = {
  Garchomp: [
    { player_id: 'p1',  player_name: 'Aaron Traylor',   country: 'United States',  flag: '🇺🇸', teams: 9,  win_rate: 61.4, best_placing: 1 },
    { player_id: 'p2',  player_name: 'Wolfe Glick',     country: 'United States',  flag: '🇺🇸', teams: 10, win_rate: 59.8, best_placing: 1 },
    { player_id: 'p4',  player_name: 'Markus Stadter',  country: 'Germany',        flag: '🇩🇪', teams: 8,  win_rate: 58.2, best_placing: 1 },
    { player_id: 'p5',  player_name: 'Toler Webb',      country: 'United States',  flag: '🇺🇸', teams: 7,  win_rate: 57.3, best_placing: 1 },
    { player_id: 'p7',  player_name: 'Edu Folgueras',   country: 'Spain',          flag: '🇪🇸', teams: 6,  win_rate: 54.2, best_placing: 2 },
    { player_id: 'p8',  player_name: 'Barry Anderson',  country: 'United Kingdom', flag: '🇬🇧', teams: 5,  win_rate: 53.7, best_placing: 2 },
    { player_id: 'p10', player_name: 'Aaron Park',      country: 'South Korea',    flag: '🇰🇷', teams: 7,  win_rate: 56.1, best_placing: 2 },
    { player_id: 'p11', player_name: 'Gabby Snyder',    country: 'United States',  flag: '🇺🇸', teams: 4,  win_rate: 51.9, best_placing: 3 },
    { player_id: 'p13', player_name: 'Hirofumi Kimura', country: 'Japan',          flag: '🇯🇵', teams: 3,  win_rate: 49.8, best_placing: 4 },
    { player_id: 'p16', player_name: 'Lee Provost',     country: 'Australia',      flag: '🇦🇺', teams: 2,  win_rate: 48.1, best_placing: 6 },
  ],
  Mewtwo: [
    { player_id: 'p3',  player_name: 'Sejun Park',      country: 'South Korea',    flag: '🇰🇷', teams: 8,  win_rate: 58.7, best_placing: 1 },
    { player_id: 'p1',  player_name: 'Aaron Traylor',   country: 'United States',  flag: '🇺🇸', teams: 9,  win_rate: 61.4, best_placing: 1 },
    { player_id: 'p6',  player_name: 'Paul Chua',       country: 'Singapore',      flag: '🇸🇬', teams: 5,  win_rate: 55.8, best_placing: 1 },
    { player_id: 'p4',  player_name: 'Markus Stadter',  country: 'Germany',        flag: '🇩🇪', teams: 6,  win_rate: 59.1, best_placing: 1 },
    { player_id: 'p14', player_name: 'Ryota Otsubo',    country: 'Japan',          flag: '🇯🇵', teams: 4,  win_rate: 50.3, best_placing: 3 },
    { player_id: 'p9',  player_name: 'James Baek',      country: 'Canada',         flag: '🇨🇦', teams: 3,  win_rate: 49.6, best_placing: 4 },
  ],
  Rayquaza: [
    { player_id: 'p2',  player_name: 'Wolfe Glick',     country: 'United States',  flag: '🇺🇸', teams: 10, win_rate: 63.2, best_placing: 1 },
    { player_id: 'p5',  player_name: 'Toler Webb',      country: 'United States',  flag: '🇺🇸', teams: 7,  win_rate: 57.3, best_placing: 1 },
    { player_id: 'p4',  player_name: 'Markus Stadter',  country: 'Germany',        flag: '🇩🇪', teams: 5,  win_rate: 57.9, best_placing: 1 },
    { player_id: 'p10', player_name: 'Aaron Park',      country: 'South Korea',    flag: '🇰🇷', teams: 4,  win_rate: 55.4, best_placing: 2 },
    { player_id: 'p7',  player_name: 'Edu Folgueras',   country: 'Spain',          flag: '🇪🇸', teams: 3,  win_rate: 53.1, best_placing: 2 },
  ],
  default: [
    { player_id: 'p2',  player_name: 'Wolfe Glick',     country: 'United States',  flag: '🇺🇸', teams: 6,  win_rate: 58.4, best_placing: 1 },
    { player_id: 'p1',  player_name: 'Aaron Traylor',   country: 'United States',  flag: '🇺🇸', teams: 5,  win_rate: 55.1, best_placing: 1 },
    { player_id: 'p3',  player_name: 'Sejun Park',      country: 'South Korea',    flag: '🇰🇷', teams: 4,  win_rate: 53.8, best_placing: 2 },
    { player_id: 'p4',  player_name: 'Markus Stadter',  country: 'Germany',        flag: '🇩🇪', teams: 3,  win_rate: 51.2, best_placing: 3 },
    { player_id: 'p9',  player_name: 'James Baek',      country: 'Canada',         flag: '🇨🇦', teams: 2,  win_rate: 49.7, best_placing: 4 },
  ],
};

export const MOCK_MEGA_TREND: Record<string, TrendPoint[]> = {
  Garchompite: trend([
    ['Jan 4',  30.1, 52.4], ['Jan 11', 32.4, 53.1], ['Jan 18', 34.2, 53.9],
    ['Jan 25', 36.0, 54.8], ['Feb 1',  37.5, 54.5], ['Feb 8',  38.8, 54.8],
    ['Feb 15', 38.3, 54.6], ['Feb 22', 39.7, 55.2], ['Mar 1',  39.4, 54.4],
    ['Mar 8',  38.0, 53.6], ['Mar 15', 37.6, 53.9], ['Mar 22', 38.3, 54.2],
    ['Mar 29', 38.7, 54.5], ['Apr 5',  38.4, 54.8],
  ]),
  'Mewtwoite Y': trend([
    ['Jan 4',  27.3, 51.5], ['Jan 11', 29.0, 52.1], ['Jan 18', 30.8, 52.9],
    ['Jan 25', 32.4, 53.6], ['Feb 1',  33.7, 53.2], ['Feb 8',  34.5, 53.5],
    ['Feb 15', 35.1, 53.4], ['Feb 22', 34.8, 53.7], ['Mar 1',  35.1, 53.1],
    ['Mar 8',  34.6, 53.5], ['Mar 15', 34.2, 53.2], ['Mar 22', 34.6, 53.4],
    ['Mar 29', 34.8, 53.4], ['Apr 5',  34.9, 53.5],
  ]),
  'Charizardite X': trend([
    ['Jan 4',  22.4, 50.8], ['Jan 11', 21.1, 50.3], ['Jan 18', 20.0, 51.2],
    ['Jan 25', 18.9, 51.4], ['Feb 1',  17.8, 51.7], ['Feb 8',  17.1, 51.5],
    ['Feb 15', 16.8, 51.8], ['Feb 22', 17.2, 51.6], ['Mar 1',  17.9, 51.9],
    ['Mar 8',  18.2, 51.6], ['Mar 15', 18.4, 51.7], ['Mar 22', 18.3, 51.5],
    ['Mar 29', 18.3, 51.6], ['Apr 5',  18.3, 51.6],
  ]),
  default: trend([
    ['Jan 4',  15.2, 48.9], ['Jan 11', 15.8, 49.2], ['Jan 18', 16.4, 49.5],
    ['Jan 25', 17.0, 49.3], ['Feb 1',  17.5, 49.7], ['Feb 8',  17.9, 49.5],
    ['Feb 15', 18.1, 49.9], ['Feb 22', 18.0, 49.7], ['Mar 1',  17.8, 49.5],
    ['Mar 8',  17.5, 49.3], ['Mar 15', 17.7, 49.6], ['Mar 22', 17.9, 49.4],
    ['Mar 29', 18.0, 49.5], ['Apr 5',  17.8, 49.4],
  ]),
};

