const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config()

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

function convertSeason(kausi) {
  // "95-96" -> 1995, "01-02" -> 2001
  const first = parseInt(kausi.split('-')[0]);
  return first >= 90 ? 1900 + first : 2000 + first;
}

function convertCategory(sarja) {
  const mapping = {
    '4.divisioona': 'Naisten 4-divisioona',
    '3.divisioona': 'Naisten 3-divisioona',
    '2. divisioona': 'Naisten 2-divisioona',
    '1. divisioona': 'Naisten 1-divisioona',
    '2. divisioona + 1. divisioonakarsinta': 'Naisten 2-divisioona + 1-divisioonakarsinta',
    '2. divisioona + karsinta': 'Naisten 2-divisioona + karsinta',
    '2. divisioona + ylempi jatkosarja': 'Naisten 2-divisioona + ylempi jatkosarja',
    '1. divisioona + 1. divisioonakarsinta': 'Naisten 1-divisioona + 1-divisioonakarsinta',
    'Divarikarsinnat': 'Naisten Divarikarsinnat',
    'Divarikarsinta': 'Naisten Divarikarsinta',
    'Play off': 'Naisten Playoff',
    'Ylempi jatkosarja': 'Naisten Ylempi jatkosarja',
  };
  return mapping[sarja] || 'Naisten ' + sarja;
}

function convertName(name) {
  // "Vähärautio, Sami" -> "Vähärautio Sami"
  return name.replace(',', '').replace(/\s+/g, ' ').trim();
}

async function insertStats(season, category, data) {
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      'INSERT INTO stats (season, category, stats) VALUES (?, ?, ?)',
      [String(season), category, JSON.stringify(data)]
    );
  } catch (error) {
    console.error(`Error inserting stats for season ${season}, category ${category}:`, error.message);
  }
  connection.release();
}

async function importPisteporssi(filterSeason) {
  const csv = fs.readFileSync('./tmp/naiset_pisteporssi.csv', 'utf-8');
  const lines = csv.split('\n').filter(line => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  // Group by season + category
  const groups = {};

  for (const line of dataLines) {
    const parts = line.split(';');
    const kausi = parts[0];
    const nimi = parts[1];
    const sarja = parts[2];
    const maalit = parseInt(parts[4]) || 0;
    const syotot = parseInt(parts[5]) || 0;
    const jaahyt = parseInt(parts[6]) || 0;

    const season = convertSeason(kausi);

    // Skip if a specific season was requested and this doesn't match
    if (filterSeason && season !== filterSeason) continue;

    const category = convertCategory(sarja);
    const name = convertName(nimi);

    const key = `${season}|${category}`;
    if (!groups[key]) {
      groups[key] = { season, category, players: [] };
    }

    groups[key].players.push({
      name,
      goals: maalit,
      total: maalit + syotot,
      assists: syotot,
      penalties: jaahyt
    });
  }

  // Sort each group by total descending, then insert
  for (const key of Object.keys(groups)) {
    const { season, category, players } = groups[key];
    players.sort((a, b) => b.total - a.total);
    console.log(`Inserting: season=${season}, category="${category}", players=${players.length}`);
    await insertStats(season, category, players);
  }
}

const seasonArg = process.argv[2] ? parseInt(process.argv[2]) : null;
if (seasonArg) {
  console.log(`Importing season: ${seasonArg}`);
} else {
  console.log('Importing all seasons');
}

importPisteporssi(seasonArg).then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
