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

// Function to insert data into the games table
async function insertDataStats(year, category, data) {
  //const connection = await mysql.createConnection(connectionConfig);
  const connection = await pool.getConnection();
  const tablename = `stats`;

  try {
      // Check if table name exists
      await connection.execute(`
        INSERT INTO ${tablename} (season, category, stats)
        VALUES ('${year}', '${category}', '${JSON.stringify(data)}')`);
  } catch (error) {
      console.error(`Error inserting data for year ${year} and category ${category}:`, error);
  }
  connection.release();

}

async function store() {
  // Read the JSON file and parse it into an array of objects
  
  let files = await fs.readdirSync('./data/stats');
  console.log("stats files", files.length);
  
  for(let file of files) {
    let year = file.substring(0,4);
    // Regex: vuosiluku-<category>-stats.json
    const match = file.match(/^\d{4}-(.+?)-stats/);
    if (match && match[1]) {
      const category = match[1].replace(/_/g, ' ');
      const jsonData = await fs.readFileSync(`./data/stats/${file}`);
      const jsonArray = JSON.parse(jsonData);
      if (jsonArray.length > 0) {
        // Muutetaan mahdolliset kokonaan isot nimet title case -muotoon
        for (let obj of jsonArray) {
          if (obj.name) {
            // Jos koko nimi on isoilla
            if (/^[A-ZÄÖÅ\s]+$/.test(obj.name)) {
              obj.name = obj.name.toLowerCase().replace(/(^|\s|[-])([a-zäöå])/g, (m, p1, p2) => p1 + p2.toUpperCase());
            } else {
              // Jos sukunimi on isoilla ja etunimi normaalisti (esim. LEHTINEN Joni)
              const parts = obj.name.split(' ');
              if (parts.length === 2 && /^[A-ZÄÖÅ-]+$/.test(parts[0]) && /^[A-ZÄÖÅ][a-zäöå]+$/.test(parts[1])) {
                parts[0] = parts[0].toLowerCase().replace(/(^|[-])([a-zäöå])/g, (m, p1, p2) => p1 + p2.toUpperCase());
                obj.name = parts.join(' ');
              }
            }
          }
        }
        console.log(`Inserting stats for year ${year} and category ${category} with ${jsonArray.length} entries`);
        await insertDataStats(year, category, jsonArray);
      } else {
        console.warn("No stats for game ", year, category);
      }
    } else {
      console.warn("Could not parse category from filename:", file);
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
