import axios from 'axios';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { DateTime } from 'luxon';
import dotenv from 'dotenv';
dotenv.config();

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';

// Validate and sanitize environment variables
function getEnvVar(name, fallback = null, validator = null) {
  let value = process.env[name];
  if (validator && value && !validator(value)) {
    console.error(`Invalid value for environment variable ${name}: ${value}`);
    process.exit(1);
  }
  return value || fallback;
}

// Remove default secrets for production safety
var token = getEnvVar('token', null);
if (!token) {
  console.error('API token is required. Set the token environment variable.');
  process.exit(1);
}

var searchPlayer = async function (search_text, season, club_id) {

  try {

    let response = await axios.get(`${base_url}/search?text=${encodeURIComponent(search_text)}&api_key=${token}&competition_id=sb2015&club_id=${club_id}`);
    return response.data;
  } catch (e) {
    console.log(base_url);
    console.error(e);
    games = [];
  }

  return games;
};

async function doFetch() {
  var season = 'sb2014';
  var foundplayers = [];
  var not_found = [];
  var players = fs.readFileSync('./tmp/oldplayers.txt', 'utf-8').split('\n').filter(line => line.trim() !== '');
  // remove , from player names
  players = players.map(name => name.replace(/,/g, '').trim());

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


  for (const playerName of players) {
    var res = await searchPlayer(playerName, season, process.env.your_club_id);
    // filter object with club_id 368
    var players = res.results;
    
    if (players.length > 0) {

      for (const player of players) {
        var playerdata = null;
        // players is found from torneopal, now check if the player is in the specified club
        const apiurl = `https://salibandy-api.torneopal.fi/taso/rest/getPlayer?player_id=${player.id}&api_key=${token}`;
        const response = await axios.get(apiurl);
        const data = typeof response.data === 'object' ? response.data : JSON.parse(response.data);
        if (data.call && data.call.status === 'OK' && data.player) {
          playerdata = data.player;
          // if data.player.club_id is equal to process.env.your_club_id, then the player is found or
          // if data.player.previous_clubs[] contains process.env.your_club_id, then the player is found
          if (playerdata.club_id == process.env.your_club_id || (playerdata.previous_clubs || []).some(c => c.club_id == process.env.your_club_id)) {
          
            console.log(`Player ${playerdata.first_name} ${playerdata.last_name} found`);
            var BirthYear = playerdata.birthyear;
            // Uppercase first letter of first and last name
            playerdata.first_name = playerdata.first_name.charAt(0).toUpperCase() + playerdata.first_name.slice(1).toLowerCase();
            playerdata.last_name = playerdata.last_name.charAt(0).toUpperCase() + playerdata.last_name.slice(1).toLowerCase();
            // Remove player statistics if club_id is not in the statistics 
            playerdata.statistics = playerdata.statistics.filter(stat => stat.team_id == process.env.your_club_id);
            // Remove matches from matches array if club_id is not in the matches
            playerdata.matches = playerdata.matches.filter(match => match.club_A_id == process.env.your_club_id || match.club_B_id == process.env.your_club_id);

            foundplayers.push(playerdata.last_name + ' ' + playerdata.first_name);
            // insert or update player to database
            console.log(`Inserting/updating player ${playerdata.first_name} ${playerdata.last_name} ${BirthYear} with ID ${playerdata.player_id} to database`);
            
            await pool.query(
            'INSERT INTO players (firstname, lastname, player_id, birth_year, player_data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE birth_year = VALUES(birth_year), player_data = VALUES(player_data)',
            [playerdata.first_name, playerdata.last_name, playerdata.player_id, BirthYear, JSON.stringify(playerdata)]
            );

          } else {
            not_found.push(playerName);
            console.log(`Player ${playerName} found but not in the specified club`);
          }
        } else {
          not_found.push(playerName);
          console.log(`Player ${playerName} found but error fetching details: ${data.call.error}`);
        }
      }
    } else {
      not_found.push(playerName);
      console.log(`Player ${playerName} not found`);
    }
  }

  console.log('Found players:', foundplayers.length);
  console.log('Not found players:', not_found.length);
  fs.writeFileSync('./tmp/found_players.json', JSON.stringify(foundplayers, null, 2));
  fs.writeFileSync('./tmp/not_found_players.json', JSON.stringify(not_found, null, 2));
}


await doFetch();
/*try {
  const data = fs.readFileSync('./tmp/player_51804.json', 'utf-8');
  const player = JSON.parse(data);
  if (player.club_id == process.env.your_club_id || (player.previous_clubs || []).some(c => c.club_id == process.env.your_club_id)) {
    console.log(`Player ${player.first_name} ${player.last_name} found`);
  }
} catch (e) {
  console.error('Error reading player data:', e);
}*/
