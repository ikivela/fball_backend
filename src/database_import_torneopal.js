const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config()
let current_season = 2025;
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

// Function to process empty string values to null
function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}

async function store() {
  // Read the JSON file and parse it into an array of objects
  // Create a MySQL connection pool
  let files = await fs.readdirSync('./data/').filter(x => x.includes('games.json') && x.includes(current_season));

  for (let file of files) {
    let year = file.substring(0, 4);
    await initGameTable(year);
    const jsonData = await fs.readFileSync(`./data/${file}`);
    if ( !jsonData ) {
      console.log("Error reading file", file);
      process.exit(-1);
    }
    console.log("reading file", file);
    const jsonArray = JSON.parse(jsonData);
    console.log("jsonArray", jsonArray.matches.length);
    
    for (let game of jsonArray.matches) {
      // Process empty strings to null
      
      processEmptyToNull(game);
      console.log("Inserting ", game.match_id);
      await insertDataIntoGames(year, game);
    }
  }

  //process.exit(0);
}

store().catch((error) => {
  console.error(error);
}).then(() => {
  console.log('All done');
  process.exit(0);
});

// Function to insert data into the games table
async function insertDataIntoGames(year, gameData) {
 //console.log("gameData", gameData)
  //const connection = await mysql.createConnection(connectionConfig);
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

    try {
      await connection.execute(`
        INSERT INTO ${tablename} (${columns})
        VALUES (${values.map(() => '?').join(', ')})
      `, values);

      console.log(`Inserted game with match_id ${gameData.match_id}`);
    } catch (error) {

      console.error(`Error inserting data for match_id ${gameData.match_id}:`, error);
      process.exit(-1);

    }

  connection.release();
}

// Function to initialize the "game" table in the database
async function initGameTable(_year) {

  const tablename = `${_year}_games`;
  const connection = await pool.getConnection();
  console.log("creating table", tablename);
  await connection.query(`DROP TABLE IF EXISTS ${tablename}`);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${tablename} (
    match_id VARCHAR(10) PRIMARY KEY,
    category_id VARCHAR(10),
    category_name VARCHAR(50),
    date DATE,
    time TIME,
    matchdata JSON
    )
  `);
}
