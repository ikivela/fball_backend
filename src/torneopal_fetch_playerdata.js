const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  const token = process.env.token;

  // Tarkista komentoriviparametri
  const argPlayerId = process.argv[2];
  let players = [];
  if (argPlayerId) {
    const [rows] = await pool.query('SELECT player_id, firstname, lastname FROM players WHERE player_id = ?', [argPlayerId]);
    players = rows;
    if (players.length === 0) {
      console.error(`Pelaajaa id:llä ${argPlayerId} ei löytynyt.`);
      await pool.end();
      process.exit(1);
    }
  } else {
    const [rows] = await pool.query('SELECT player_id, firstname, lastname FROM players');
    players = rows;
  }

  for (const player of players) {
    try {
      const apiurl = `https://salibandy-api.torneopal.fi/taso/rest/getPlayer?player_id=${player.player_id}&api_key=${token}`;
      const response = await axios.get(apiurl);
      const data = typeof response.data === 'object' ? response.data : JSON.parse(response.data);

      if (data.call && data.call.status === 'OK' && data.player) {
        // Tarkista nimi ja syntymävuosi
        const apiFirst = (data.player.first_name || '').trim().toLowerCase();
        const apiLast = (data.player.last_name || '').trim().toLowerCase();
        const dbFirst = (player.firstname || '').trim().toLowerCase();
        const dbLast = (player.lastname || '').trim().toLowerCase();
        const BirthYear = data.player.birthyear;
        console.log(apiFirst, dbFirst, apiLast, dbLast, BirthYear);
        if (
          apiFirst === dbFirst &&
          apiLast === dbLast &&
          BirthYear
        ) {
          // Päivitä player_data-kenttä
          await pool.query(
            'UPDATE players SET birth_year = ?, player_data = ? WHERE player_id = ?',
            [BirthYear, JSON.stringify(data.player), player.player_id]
          );
          console.log(`Updated player ${player.player_id}: ${player.firstname} ${player.lastname}`);
        } else {
          console.log(`Skipped player ${player.lastname} ${player.firstname} (${player.player_id}): name mismatch or missing birthyear`);
        }
      } else {
        console.log(`Error: ${data.call.error} [${player.player_id}]`);
      }
    } catch (e) {
      console.error(`Error for player ${player.lastname} ${player.firstname) (${player.player_id}):`, e.message);
    }
    // 1 sekunnin viive jokaisen API-kutsun jälkeen
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await pool.end();
}

main().catch(console.error); 
