var axios = require('axios');
var fs = require('fs');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
require('dotenv').config()
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
require('dotenv').config()
const { updatePlayer } = require('./torneopal_update_players');
const { DateTime } = require('luxon');
const mysql = require('mysql2/promise');

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
var club_id = getEnvVar('club_id', null);
if (!club_id) {
  console.error('Club ID is required. Set the club_id environment variable.');
  process.exit(1);
}

const { pathToFileURL } = require('url');
const e = require('cors');
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
  let game_url = `${base_url}getMatch?match_id=${game.match_id}&api_key=${token}&club_id=${club_id}`;
  try {
    stats = await axios.post(game_url);
    if (stats.data == 'Invalid key') throw new Error('Invalid key for game_url', game_url);
    // Save to Database
    const tablename = `\`${season}_games\``;
    processEmptyToNull(stats.data.match);
    const game = stats.data.match;
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
    console.error(e);
  }
}

var getGameStats = async function (index, games_length, gameID, season) {
  let game_url = `${base_url}getMatch?match_id=${gameID}&api_key=${token}&club_id=${club_id}`;
  //console.log('game url', gameID, game_url);
  try {
    stats = await axios.post(game_url);
    if (stats.data == 'Invalid key') throw new Error('Invalid key for game_url', game_url);
    let writepath = basepath + 'gamestats/' + season + '-gamestats-' + gameID + ".json";
    await fs.writeFileSync(writepath, JSON.stringify(stats.data), { encoding: "utf8" });
    console.log(`Game ${gameID} fetched and saved`);
  } catch (e) {
    console.error(e);
  }
}

async function fetchStatsDB(from_date) {

  // validate year from yyy-MM-DD format
  if (!from_date || !DateTime.fromFormat(from_date, 'yyyy-MM-dd').isValid) {
    console.error(`Invalid date format for from_date: ${from_date}. Expected format is yyyy-MM-dd.`);
    process.exit(1);
  }
  console.log(from_date);
  from_date = DateTime.fromFormat(from_date, 'yyyy-MM-dd');
  const db_year = from_date.month > 6 ? from_date.plus({ years: 1 }).year : from_date.year;
  console.log("Fetching games for date:", from_date.toFormat('yyyy-MM-dd'), "from db_year", db_year);
  const connection = pool.getConnection();
  const tablename = `\`${db_year}_games\``;

  let sql = `SELECT * FROM ${tablename} WHERE date = ?`;
  let games = [];
  try {
    const [rows, fields] = await pool.query(sql, [from_date.toFormat('yyyy-MM-dd')]);
    games = rows;
    console.log("Found %s games", games.length);
  } catch (e) {
    console.error(e);
  }
  pool.releaseConnection(connection);
  for (const game of games) {
    await saveGames(game, db_year);
  }
  for (const player of globalTeamPlayers) {
    console.log(`Updating player ${player.player_name}`);
    await updatePlayer(player);
  }
  if ( globalTeamPlayers.length == 0 ) {
    console.log("No team players found in today's games.");
  } else {
    console.log(`Total unique ${process.env.your_team_name} players found: ${globalTeamPlayers.length}`);
  }
  // Close the pool
  await pool.end();

}

async function fetchStats(from_date, _file) {
  console.log("Fetch games file:", _file, "from_date", DateTime.fromISO(from_date).toFormat('yyyy-MM-dd'));
  from_date = DateTime.fromISO(from_date).toFormat('yyyy-MM-dd');
  let season = _file.split('-')[0];
  games = JSON.parse(fs.readFileSync(basepath + _file), 'utf8');
  if (from_date) {
    games = games.matches.filter(game => {
      return game.date >= from_date && game.date <= DateTime.now().toFormat('yyyy-MM-dd') ? true : false;
    });
  } else {
    games = games.matches.filter(game => {
      return game.date == DateTime.now().toFormat('yyyy-MM-dd') ? true : false;
    });
  }

  if (games.length == 0) console.log("No games found.");
  else console.log("Found %s games", games.length);
  for (const [index, game] of games.entries()) {
    await getGameStats(index, games.length, game.match_id, season);
  }
}

async function fetchTodaysResults(from_date) {
  // from_date can be undefined or a string
  let date;
  if (!from_date) {
    console.log("No from_date provided, using today's date");
    date = DateTime.now().toFormat('yyyy-MM-dd');
    console.log("Today:", date);
  } else {
    date = from_date;
    console.log("From date:", date);
  }
  await fetchStatsDB(date);
}

fetchTodaysResults(argv.from_date).catch((error) => {
  console.error(error);
}).then(() => {
  process.exit(0);
});

