import axios from 'axios';
import fs from 'fs';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import consolestamp from 'console-stamp';
import { updatePlayer } from './torneopal_update_players.js';
import { DateTime } from 'luxon';
import mysql from 'mysql2/promise';

dotenv.config();
consolestamp(console, 'yyyy-mm-dd HH:MM:ss.l');
const argv = yargs(hideBin(process.argv)).argv

let globalTeamPlayers = [];

// Define the MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Helper function to validate year/season (must be 4-digit year)
function validateYear(year) {
  return /^\d{4}$/.test(year) ? year : null;
}

// Validate and sanitize environment variables
function getEnvVar(name, fallback = null, validator = null) {
  let value = process.env[name];
  if (validator && value && !validator(value)) {
    console.error(`Invalid value for environment variable ${name}: ${value}`);
    process.exit(1);
  }
  return value || fallback;
}

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';

// Remove default secrets for production safety
var token = getEnvVar('token', null);
if (!token) {
  console.error('API token is required. Set the token environment variable.');
  process.exit(1);
}
var club_id = getEnvVar('your_club_id', null);
if (!club_id) {
  console.error('Club ID is required. Set the club_id environment variable.');
  process.exit(1);
}

var basepath = './data/';

function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}

var saveGames = async function (game, season) {
  if (!validateYear(season)) {
    console.error(`Invalid year for table name: ${season}`);
    process.exit(1);
  }
  const match_id = game.match_id;
  let game_url = `${base_url}getMatch?match_id=${match_id}&api_key=${token}&club_id=${club_id}`;
  try {
    const stats = await axios.get(game_url);
    if (stats.data == 'Invalid key') throw new Error('Invalid API key');
    if (!stats.data || !stats.data.match) {
      const call = stats.data && stats.data.call;
      console.error(`Skipping game ${match_id}: no match data from API`, call ? (call.error || call.error_message || call.status) : '');
      return;
    }
    // Save to Database
    const tablename = `\`${season}_games\``;
    processEmptyToNull(stats.data.match);
    game = stats.data.match;
    const matchData = JSON.stringify(stats.data.match);
    //const matchData = stats.data.match;
    // Determine 'YourTeamName' teamid from team_A or team_B
    let your_team_id = null;
    console.log(`Processing game ${game.match_id}: ${game.team_A_name} vs ${game.team_B_name}`);
    if (game.team_A_name && game.team_A_name.toLowerCase().includes(process.env.your_team_name.toLowerCase())) {
      your_team_id = game.team_A_id;
    } else if (game.team_B_name && game.team_B_name.toLowerCase().includes(process.env.your_team_name.toLowerCase())) {
      your_team_id = game.team_B_id;
    }
    if (your_team_id) {
      // filter your team players from lineup
      if (game.lineups && Array.isArray(game.lineups)) {
        let players = game.lineups.filter(player => player.team_id === your_team_id);
        // add players to global array, avoiding duplicates
        globalTeamPlayers = globalTeamPlayers || [];
        players.forEach(player => {
          if (!globalTeamPlayers.some(p => p.player_id === player.player_id)) {
            globalTeamPlayers.push(player);
          }
        });
        console.log(`Found ${players.length} ${process.env.your_team_name} players in game ${game.match_id}`);

      }
    } else {
      console.log(`${process.env.your_team_name} team not found in game ${game.match_id}`);
    }
    // Update your_team_id in the database if not already set


    let sql = `UPDATE ${tablename} SET matchdata = CAST(? AS JSON) WHERE match_id = ?`;
    let values = [matchData, game.match_id];
    const [rows, fields] = await pool.query(sql, values);
    if (rows.affectedRows > 0) console.log("Game", game.match_id, "saved to database");
  } catch (e) {
    const body = e.response ? JSON.stringify(e.response.data).slice(0, 300) : '';
    console.error(`Error fetching game ${match_id}:`, e.message, body);
    if (e.response && e.response.status === 401) {
      console.error('API key rejected by Torneopal, aborting run. Check the token in .env.');
      await pool.end();
      process.exit(1);
    }
  }
}

async function fetchStatsDB(db_year) {
  const tablename = `\`${db_year}_games\``;

  let sql = `SELECT match_id FROM ${tablename}`;
  let games = [];
  try {
    const [rows] = await pool.query(sql);
    games = rows;
    console.log("Found %s games in %s", games.length, tablename);
  } catch (e) {
    console.error(e);
  }
  for (const game of games) {
    await saveGames(game, db_year);
  }
  for (const player of globalTeamPlayers) {
    console.log(`Updating player ${player.player_name}`);
    await updatePlayer(player);
  }
  if (globalTeamPlayers.length == 0) {
    console.log("No team players found in today's games.");
  } else {
    console.log(`Total unique ${process.env.your_team_name} players found: ${globalTeamPlayers.length}`);
  }
  // Close the pool
  await pool.end();

}

// Kausi: --year 2026 komentoriviltä tai .env:n year (kauden päättymisvuosi)
async function fetchAllResults(year) {
  const db_year = validateYear(String(year || ''));
  if (!db_year) {
    console.error(`Invalid season year: ${year}. Use --year yyyy or set year in .env.`);
    process.exit(1);
  }
  await fetchStatsDB(db_year);
}

fetchAllResults(argv.year || process.env.year).catch((error) => {
  console.error(error);
}).then(() => {
  process.exit(0);
});

