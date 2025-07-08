const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

async function getPlayerFromAPI(player_id) {
  const token = process.env.token;
  const apiurl = `https://salibandy-api.torneopal.fi/taso/rest/getPlayer?player_id=${player_id}&api_key=${token}`;
  try {
    const response = await axios.get(apiurl);
    const data = typeof response.data === 'object' ? response.data : JSON.parse(response.data);
    if (data.call && data.call.status === 'OK' && data.player) {
      return data.player;
    }
  } catch (e) {
    console.error(`API error for player_id ${player_id}:`, e.message);
  }
  return null;
}

async function main() {
  // Connect to DB
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

  // Create players table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      player_id VARCHAR(32) PRIMARY KEY,
      firstname VARCHAR(100),
      lastname VARCHAR(100)
    )
  `);

  // Keep unique players across all years
  const playersMap = new Map();
  const nameMap = new Map(); // etunimi+suukunimi -> [player_id, ...]

  for (let year = 2025; year <= 2025; year++) {
    let tableName = `${year}_games`;
    let rows;
    let useRosters = year < 2024;
    try {
      if (useRosters) {
        [rows] = await pool.query(`SELECT rosters FROM \`${tableName}\``);
      } else {
        [rows] = await pool.query(`SELECT matchdata FROM \`${tableName}\``);
      }
    } catch (e) {
      console.error(`Error reading table ${tableName}:`, e);
      continue;
    }

    for (const row of rows) {
      if (useRosters) {
        // rosters column: array of player objects
        let rosterArr;
        try {
          rosterArr = typeof row.rosters === 'object' ? row.rosters : JSON.parse(row.rosters);
        } catch (e) {
          console.error('Invalid rosters JSON:', e);
          continue;
        }
        if (!Array.isArray(rosterArr)) continue;
        for (const player of rosterArr) {
          if (
            player.TeamName &&
            player.TeamName.toLowerCase().includes('nibacos') &&
            player.PlayerUniqueID &&
            player.PlayerFirstName &&
            player.PlayerLastName
          ) {
            const key = (player.PlayerFirstName.trim().toLowerCase() + ' ' + player.PlayerLastName.trim().toLowerCase());
            if (!nameMap.has(key)) nameMap.set(key, []);
            if (!nameMap.get(key).includes(player.PlayerUniqueID)) {
              nameMap.get(key).push(player.PlayerUniqueID);
            }
            playersMap.set(player.PlayerUniqueID, {
              player_id: player.PlayerUniqueID,
              firstname: player.PlayerFirstName,
              lastname: player.PlayerLastName
            });
          }
        }
      } else {
        // matchdata column: JSON with lineups
        let matchdata;
        try {
          matchdata = typeof row.matchdata === 'object' ? row.matchdata : JSON.parse(row.matchdata);
        } catch (e) {
          console.error('Invalid matchdata JSON:', e);
          continue;
        }
        if (!matchdata.lineups) continue;

        let nibacosTeamId = null;
        if (matchdata.team_A_name && matchdata.team_A_name.toLowerCase().includes('nibacos')) {
          nibacosTeamId = matchdata.team_A_id;
        } else if (matchdata.team_B_name && matchdata.team_B_name.toLowerCase().includes('nibacos')) {
          nibacosTeamId = matchdata.team_B_id;
        }
        if (!nibacosTeamId) continue;

        let nibacosPlayers = (Array.isArray(matchdata.lineups) ? matchdata.lineups : Object.values(matchdata.lineups).flat())
          .filter(player => player.team_id === nibacosTeamId);

        for (const player of nibacosPlayers) {
          if (player.player_id && player.first_name && player.last_name) {
            const key = (player.first_name.trim().toLowerCase() + ' ' + player.last_name.trim().toLowerCase());
            if (!nameMap.has(key)) nameMap.set(key, []);
            if (!nameMap.get(key).includes(player.player_id)) {
              nameMap.get(key).push(player.player_id);
            }
            playersMap.set(player.player_id, {
              player_id: player.player_id,
              firstname: player.first_name,
              lastname: player.last_name
            });
          }
        }
      }
    }
    console.log(`Processed ${tableName}`);
  }

  // Print stats about found players and duplicates
  console.log("found players", nameMap.size);
  let dupes = 0;
  for (const ids of nameMap.values()) {
    if (ids.length > 1) dupes++;
  }
  console.log("Names with duplicates:", dupes);

  // Käy läpi nameMap ja poista duplikaatit, varmistaen oikea player_id API:sta
  const finalPlayers = new Map();
  let checked = 0;
  for (const [name, ids] of nameMap.entries()) {
    // Poista mahdolliset duplikaatit id-listasta
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 1) {
      // Ei duplikaattia, lisää suoraan
      finalPlayers.set(uniqueIds[0], playersMap.get(uniqueIds[0]));
      // Debug: tulosta yksittäiset
      // console.log(`Single name: ${name}, player_id: ${uniqueIds[0]}`);
    } else {
      // Oikeasti duplikaatti, tarkista API:sta
      console.log(`Duplicate name: ${name}, ids: ${uniqueIds.join(', ')}`);
      for (const id of uniqueIds) {
        checked++;
        console.log(`Checking duplicate name: ${name}, player_id: ${id} (${checked})`);
        const playerData = await getPlayerFromAPI(id);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1s viive
        if (playerData && playerData.firstname && playerData.lastname) {
          const key = (playerData.firstname.trim().toLowerCase() + ' ' + playerData.lastname.trim().toLowerCase());
          if (key === name) {
            finalPlayers.set(id, {
              player_id: id,
              firstname: playerData.firstname,
              lastname: playerData.lastname
            });
          }
        }
      }
    }
  }

  // Insert unique players into players table
  console.log("Players listed:", finalPlayers.size)
  for (const player of finalPlayers.values()) {
    try {
      await pool.query(
        'INSERT IGNORE INTO players (player_id, firstname, lastname) VALUES (?, ?, ?)',
        [player.player_id, player.firstname, player.lastname]
      );
    } catch (e) {
      console.error('Error inserting player:', player, e);
    }
  }

  console.log(`Inserted/updated ${finalPlayers.size} unique Nibacos players from all years (no duplicates by name).`);
  await pool.end();
}

main().catch(console.error);