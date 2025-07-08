const fs = require('fs');
const { connect } = require('http2');
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

// Function to initialize the "game" table in the database
async function initGameStatsTable(_year) {
  
  const tablename = `${_year}_gamestats`;
  const connection = await pool.getConnection();
  console.log("creating table", tablename);
  await connection.query(`DROP TABLE IF EXISTS ${tablename}`);
  
  await connection.query(`
      CREATE TABLE IF NOT EXISTS ${tablename} (
      gameid INT PRIMARY KEY,
      events JSON NOT NULL)
  `);
  connection.release();
}

// Function to insert data into the games table
async function insertDataIntoGameStats(year, gameid, data) {
  //const connection = await mysql.createConnection(connectionConfig);
  const connection = await pool.getConnection();
  const tablename = `${year}_gamestats`;

  try {
      await connection.execute(`
        INSERT INTO ${tablename} (gameid, events)
        VALUES ('${gameid}', '${JSON.stringify(data)}')`);

      console.log(`Inserted gamestat with Gameid ${gameid}`);
  } catch (error) {
      console.error(`Error inserting data for Gameid ${gameid}:`, error);
  }
  
  connection.release();

}

async function store() {
  // Read the JSON file and parse it into an array of objects
  // Create a MySQL connection pool
  const years = [2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023];
  for( let _year of years) {
    await initGameStatsTable(_year);
  }
  
  let files = await fs.readdirSync('./data/gamestats').filter( x => x.includes('gamestats') && !x.includes('2024')));
  console.log("gamestat files", files.length);
  
  for(let file of files) {
    let year = file.substring(0,4);
    
    const match = file.match(/-(\d+)./);
    if ( match && match[1] ) {
      const jsonData = await fs.readFileSync(`./data/gamestats/${file}`);
      const jsonArray = JSON.parse(jsonData);
      if ( jsonArray.length > 0)
        await insertDataIntoGameStats(year, match[1], jsonArray);
      else
        console.warn("No stats for game ", year, match[1])
    } else {
      console.warn("Could not parse GameID");
    }

  }
  
  //process.exit(0);
}


store().catch( (error) => {
  console.error(error);
}).then( () => {
  console.log('All done');
  process.exit(0);
});
