const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config()

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

// Function to initialize the "game" table in the database
async function initGameTable(_year) {
  
  const tablename = `${_year}_games`;
  const connection = await pool.getConnection();
  console.log("creating table", tablename);
  await connection.query(`DROP TABLE IF EXISTS ${tablename}`);
  
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${tablename} (
      UniqueID INT PRIMARY KEY,
      TitleID INT,
      TitleOrder INT,
      Title TEXT,
      GameDate DATE,
      GameTime TIME,
      HomeTeamID INT,
      AwayTeamID INT,
      RinkID INT,
      SubRink TEXT,
      HomeTeamName TEXT,
      AwayTeamName TEXT,
      RinkName TEXT,
      Result TEXT,
      FinishedType INT,
      GameStatus INT,
      GameEffTime INT,
      ReportLink INT,
      Statistics INT,
      GroupID INT,
      \`group\` TEXT,
      class TEXT,
      events JSON,
      rosters JSON
    )
  `);
}

// Function to process empty string values to null
function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}

// Function to insert data into the games table
async function insertDataIntoGames(year, data) {
  //const connection = await mysql.createConnection(connectionConfig);
  const connection = await pool.getConnection();
  const tablename = `${year}_games`;

  for (const gameData of data) {
    processEmptyToNull(gameData);
    const columns = Object.keys(gameData).map(key => `\`${key}\``).join(', ');
    let values = Object.values(gameData);
    var gamestatpath = `./data/gamestats/${year}-gamestats-${gameData.UniqueID}.json`;
    var rosterpath = `./data/rosters/${year}-roster-${gameData.UniqueID}.json`;
    let rosters = "[]";
    let eventsdata = "[]";
    if ( fs.existsSync(rosterpath)) {
      rosters = fs.readFileSync(rosterpath).toString();
    }
    if ( fs.existsSync(gamestatpath) ) {
      eventsdata = fs.readFileSync(gamestatpath).toString();
    } 
    values.push( eventsdata );
    values.push( rosters );
   
    try {
      const [results, fields] = await connection.execute(`
        INSERT INTO ${tablename} (${columns}, events, rosters)
        VALUES (${values.map(() => '?').join(', ')})
      `, values);

      console.log(`Inserted game with UniqueID ${gameData.UniqueID}`);
    } catch (error) {
      console.error(`Error inserting data for UniqueID ${gameData.UniqueID}:`, error);
    }
  }

  connection.release();
}


async function store() {
  // Read the JSON file and parse it into an array of objects
  // Create a MySQL connection pool
  let files = await fs.readdirSync('./data/').filter( x => x.includes('games.json') && x.includes('2023'));
  
  for(let file of files) {
    let year = file.substring(0,4);
    await initGameTable(year);
    const jsonData = await fs.readFileSync(`./data/${file}`);
    const jsonArray = JSON.parse(jsonData);
    await insertDataIntoGames(year, jsonArray);
  }
  
  //process.exit(0);
}


store().catch( (error) => {
  console.error(error);
}).then( () => {
  console.log('All done');
  process.exit(0);
});
