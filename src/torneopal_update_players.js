const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();


async function updatePlayer(player) {
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

  try {
    const apiurl = `https://salibandy-api.torneopal.fi/taso/rest/getPlayer?player_id=${player.player_id}&api_key=${token}`;
    const response = await axios.get(apiurl);
    const data = typeof response.data === 'object' ? response.data : JSON.parse(response.data);

    if (data.call && data.call.status === 'OK' && data.player) {
      const BirthYear = data.player.birthyear;
      await pool.query(
        'INSERT INTO players (firstname, lastname, player_id, birth_year, player_data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE birth_year = VALUES(birth_year), player_data = VALUES(player_data)',
        [player.first_name, player.last_name, player.player_id, BirthYear, JSON.stringify(data.player)]
      );
      
    } else {
      console.log(`Player not found: ${player.player_id}: ${data}`);
    }
  } catch (e) {
    console.error(`Error for player_id ${player.player_id}:`, e.message);
  } finally {
    await pool.end();
  }
}

module.exports = { updatePlayer };