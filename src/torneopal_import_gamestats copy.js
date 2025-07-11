const fs = require('fs');
const { connect } = require('http2');
const mysql = require('mysql2/promise');
require('dotenv').config()
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss');


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

const connection = pool.getConnection();


function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}

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

// Function to insert data into the games table
var saveGame = async function (game, gameID, season) {
  if (!validateYear(season)) {
    console.error(`Invalid year for table name: ${season}`);
    process.exit(1);
  }
  try {
    const tablename = `\`${season}_games\``;
    processEmptyToNull(game);
    const matchData = JSON.stringify(game);
    let sql = `UPDATE ${tablename} SET matchdata = ? WHERE match_id = ?`;
    let values = [matchData, gameID];
    const [rows, fields] = await pool.query(sql, values);
    console.log("Game", gameID, "updated to database");
  } catch (e) {
    console.error(e);
  }
}

async function store() {
  try {
  
  let files = await fs.readdirSync('./data/gamestats').filter( x => x.includes('gamestats') && x.includes('2025-gamestat'));
  console.log("gamestat files", files.length);
  
  for(let i=0; i < files.length; i++) {
    let year = files[i].substring(0,4);
    console.log(`${year} - ${i}/${files.length}`);
    let file = files[i];
    const match = file.match(/-(\d+)./);
    if ( match && match[1] ) {
      const jsonData = await fs.readFileSync(`./data/gamestats/${file}`);
      const game = JSON.parse(jsonData).match;
      await saveGame(game, match[1], year);
    } else {
      console.warn("Could not parse GameID");
    }
  }
  pool.releaseConnection(connection);

} catch (e) {
  console.error(e);
}
  //process.exit(0);
}


store().catch( (error) => {
  console.error(error);
}).then( () => {
  console.log('All done');
  process.exit(0);
});
