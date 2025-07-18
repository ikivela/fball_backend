var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');

const mysql = require('mysql2/promise');
require('dotenv').config()

// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST,  user: process.env.DB_USER,
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

var basepath = './data/';
var seasons = require('../data/config/seasons');
var active_groups = require('../data/config/active_groups');
const { resolve } = require('path');
const { connect } = require('http2');
let currentTeam_games = [];

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

let current_season = getEnvVar('year', DateTime.local().year.toString(), validateYear);

// Remove default secrets for production safety
var token = getEnvVar('token', null);
if (!token) {
  console.error('API token is required. Set the token environment variable.');
  process.exit(1);
}
var season = getEnvVar('season', '2025-2026');
var start_date = getEnvVar('start_date', '2025-08-01');
var end_date = getEnvVar('end_date', '2026-05-30');
var club_id = getEnvVar('club_id', null);
if (!club_id) {
  console.error('Club ID is required. Set the club_id environment variable.');
  process.exit(1);
}

var getGames = async function (param) {

	try {

		let response = await axios.get(`${base_url}/getMatches?club_id=${club_id}&start_date=${start_date}&end_date=${end_date}&api_key=${token}`);
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
// Function to initialize the "game" table in the database
async function initGameTable(_year) {
  const tablename = `${_year}_games`;
  // Validate table name
  if (!validateYear(_year)) {
    console.error(`Invalid year for table name: ${_year}`);
    process.exit(1);
  }
  const connection = await pool.getConnection();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${tablename}\` (
    match_id VARCHAR(10) PRIMARY KEY,
    category_id VARCHAR(10),
    category_name VARCHAR(50),
    date DATE,
    time TIME,
    matchdata JSON
    )
  `);
  connection.release();
}
// Function to insert data into the games table
async function insertDataIntoGames(year, gameData) {
   // Validate year
   if (!validateYear(year)) {
     console.error(`Invalid year for table name: ${year}`);
     process.exit(1);
   }
   const columns = [
     'match_id',
     'category_id',
     'category_name',
     'date',
     'time',
     'matchdata'
   ].join(', ');
   const values = [
     gameData.match_id,
     gameData.category_id,
     gameData.category_name,
     gameData.date,
     gameData.time,
     JSON.stringify(gameData)
   ];
 
   const connection = await pool.getConnection();
   const tablename = `${year}_games`;
   await initGameTable(year); 
     try {
       await connection.execute(`
         INSERT INTO \`${tablename}\` (${columns})
         VALUES (${values.map(() => '?').join(', ')})
       `, values);
       console.log(`Inserted game with match_id ${gameData.match_id}`);
     } catch (error) {
       console.error(`Error inserting data for match_id ${gameData.match_id}:`, error);
       process.exit(-1);
     }
   connection.release();
 }
 


async function insertIntoDatabase(year, games) {
  // Validate year
  if (!validateYear(year)) {
    console.error(`Invalid year for table name: ${year}`);
    process.exit(1);
  }
  const connection = await pool.getConnection();
  const tablename = `${year}_games`;
  await initGameTable(year); // Ensure the table is initialized
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
      let [rows, fields] = await connection.execute(`SELECT * FROM \`${tablename}\` WHERE match_id = ?`, [game.match_id]);
      if (rows.length > 0) {
        //console.log(`Match ${game.match_id} already in database`);
        continue;
      }
      // pass each game to the insert function
      console.log("Inserting ", game.match_id);
      await insertDataIntoGames(year, game);
      
      
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
    try {
      fs.writeFileSync(`${basepath}./${current_season}-Nibacos_games.json`, JSON.stringify(games));
    } catch (fileErr) {
      console.error('Error writing games file:', fileErr);
    }
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

