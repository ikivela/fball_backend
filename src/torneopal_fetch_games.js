var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');

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

// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || "your_token";
var season = '2024-2025';
var club_id = process.env.club_id || "your_club_id";


var basepath = './data/';
var seasons = require('../data/config/seasons');
var active_groups = require('../data/config/active_groups');
const { resolve } = require('path');
let currentTeam_games = [];


var getGames = async function (param) {

	try {

		let response = await axios.get(`${base_url}/getMatches?club_id=${club_id}&start_date=2024-08-01&end_date=2025-05-30&api_key=${token}`);
    games = response.data;
	} catch (e) {
		console.log(base_url);
		console.error(e);
		games = [];
	}

	return games;
};

// Function to process empty string values to null
function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}

async function insertIntoDatabase(year, games) {
  // Create the connection pool. The pool-specific settings are the defaults
  const connection = await pool.getConnection();
  const tablename = `${year}_games`;
  console.log("Inserting into", tablename);
  console.log("Games length", games.length);  

  try {
    for (let game of games) {
      // Process empty strings to null
      processEmptyToNull(game);
      if ( !game.match_id ) {
        console.log("Error: no match_id");
        continue;
      }
      let [rows, fields] = await connection.execute(`SELECT * FROM ${tablename} WHERE match_id = ?`, [game.match_id]);
      if (rows.length > 0) {
        //console.log(`Match ${game.match_id} already in database`);
        continue;
      }
      await insertDataIntoGames(current_season, game);
    }
  } catch (e) {
    console.error(e);
  } finally {
    console.log("Closing connection");
    connection.release();
    resolve();
  }

}

async function doFetch() {
	try {
    var games = await getGames();
    await insertIntoDatabase(current_season, games.matches);
    fs.writeFileSync(`${basepath}./${current_season}-Nibacos_games.json`, JSON.stringify(games));
  } catch (e) {
    console.error(e);
  }
}

doFetch().catch((error) => {
  console.error(error);
}
).then(() => {
  console.log('All done');
  process.exit(0);
});

