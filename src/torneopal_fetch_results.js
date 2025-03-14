var axios = require('axios');
var fs = require('fs');


const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
require('dotenv').config()

const { DateTime } = require('luxon');
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

const mysql = require('mysql2/promise');
require('dotenv').config()
let current_season = process.env.year || DateTime.local().year;
// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});



var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || "your_token";
var tokens = process.env.tokens || "your_token2";
var season = '2024-2025';
var club_id = process.env.club_id || "your_club_id";

const seasons = require('../data/config/seasons');
const { pathToFileURL } = require('url');
var basepath = './data/';

function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}


var saveGames = async function (game, season) {
  let game_url = `${base_url}getMatch?match_id=${game.match_id}&api_key=${token}&club_id=${club_id}`;
  try {
    stats = await axios.post(game_url);
    if (stats.data == 'Invalid key') throw new Error('Invalid key for game_url', game_url);
    // Save to Database
    const connection = pool.getConnection();
    const tablename = `${season}_games`;
    processEmptyToNull(stats.data.match);

    const matchData = JSON.stringify(stats.data.match);

    let sql = `UPDATE ${tablename} SET matchdata = ? WHERE match_id = ?`;
    let values = [matchData, game.match_id];
    const [rows, fields] = await pool.query(sql, values);
    console.log("Game", game.match_id, "saved to database");
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

async function fetchStatsDB(from_date, season) {
  if ( !from_date ) from_date = DateTime.now().month > 7 ? DateTime.now().plus({years: 1}) : DateTime.now();
  else from_date = DateTime.fromISO(from_date);

  const connection = pool.getConnection();
  const tablename = `${from_date.year}_games`;
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
  for(const game of games) {
    await saveGames(game, from_date.year);
  }

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

async function fetchTodaysResults(params) {
  await fetchStatsDB(params);
  //await fetchStats(params, file);
}

fetchTodaysResults(argv.from_date, 'Nibacos', 2025).catch((error) => {
  console.error(error);
}
).then(() => {
  process.exit(0);
});

