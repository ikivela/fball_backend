// Lisää players-tauluun last_updated-sarakkeen: milloin pelaajan data on viimeksi haettu Torneopalista.
// Ajetaan kerran: node src/database_add_players_last_updated.js (turvallista ajaa uudelleen).
// Olemassa oleville riveille arvo jää tyhjäksi, kunnes torneopal_fetch_playerdata.js päivittää ne.
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'players' AND COLUMN_NAME = 'last_updated'`
    );
    if (cols.length > 0) {
      console.log('players.last_updated on jo olemassa');
    } else {
      await pool.query('ALTER TABLE players ADD COLUMN last_updated DATETIME NULL DEFAULT NULL');
      console.log('Lisätty players.last_updated');
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
