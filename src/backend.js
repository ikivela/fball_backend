// index.js

/**
 * Required External Modules
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

/**
 * App Variables
 */

require('dotenv').config();

// Create the conn pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST,  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connLimit: 10,
  maxIdle: 10, // max idle conns, the default value is the same as `connLimit`
  idleTimeout: 60000, // idle conns timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

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

const token = getEnvVar('token', null);
if (!token) {
  console.error('API token is required. Set the token environment variable.');
  process.exit(1);
}

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
const port = process.env.PORT || 3000;
const datapath = path.join(path.resolve(__dirname), '../data/');

/*
 *  App Configuration
 */
app.use(cors());

/**
 * Routes Definitions
 */
app.get('/', (req, res) => {
  res.status(200).end('backend is running');
});

app.get('/pelikello/:id', async (req, res) => {
  let team_A_name, team_B_name, team_A_crest, team_B_crest;
  try {
    if (!req.params['id']) return res.status(404).end('Ottelu id puuttuu');

    let response = await axios.get(
      `https://salibandy-api.torneopal.net/taso/rest/getMatch?match_id=${req.params['id']}&api_key=${token}`
    );
    if (response.data && response.data.match ) {
      team_A_name = response.data.match.team_A_name;
      team_B_name = response.data.match.team_B_name;
      team_A_crest = response.data.match.club_A_crest;
      team_B_crest = response.data.match.club_B_crest;
    } else {
      team_A_name = "team A";
      team_B_name = "team B"
      team_A_crest = "";
      team_B_crest = "";
    }

    res.render('kello', {
      team_A_name: team_A_name,
      team_B_name: team_B_name,
      team_A_crest: team_A_crest,
      team_B_crest: team_B_crest,
      ottelu_id: req.params['id'],
    });
  } catch (e) {
    console.log(e);
    res.status(500).end();
  }
});

app.get('/files/', async (req, res) => {
  const fullUrl = `https://luna.chydenius.fi/nibacos/api/files/`;
  const dirpath = `${datapath}/files/`;

  try {
    const { filename } = req.query;
    let files = await fs.readdirSync(dirpath);
    files = files.filter((file) => file.includes('.html'));
    console.log('request filename', filename);
    if (files.includes(filename)) {
      // Serve the specified file
      const filePath = path.join(dirpath, filename);
      res.sendFile(filePath);
    } else {
      let tablerows = '';
      for (let file of files) {
        const filePath = path.join(dirpath, file);
        const stats = await fs.statSync(filePath);
        // Format the timestamp to a custom format
        const formattedTimestamp = stats.mtime.toLocaleString('fi-FI', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        tablerows += `
                <tr>
                  <td><a href="${fullUrl}?filename=${file}">${file}</a></td>
                  <td>${stats.size} bytes</td>
                  <td>${formattedTimestamp}</td>
                </tr>`;
      }

      const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Nibacos ottelut, sarjataulukot</title>
              </head>
              <body>
                <h1>Sarjataulukot</h1>
                <table>
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Size</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tablerows}
                  </tbody>
                </table>
              </body>
            </html>
          `;

      res.send(html);
    }
  } catch (_error) {
    console.error(_error);
  }
});

app.get('/roster/', async (req, res) => { 
  const conn = await pool.getConnection();
  const year = req.query.season;
  const gameid = req.query.gameid;
  if (!validateYear(year)) {
    return res.status(400).json({ error: 'Invalid year/season parameter' });
  }
  let sql = `SELECT rosters FROM \`${year}_games\` WHERE UniqueID = ?`;
  if ( year > 2023 ) return res.status(200).json({ message: 'ok', data: [] });
  try {
    const [rows, fields] = await pool.query(sql, [gameid]);
    let game = rows;
    if (game.length == 0)
      res.status(200).json({ message: 'ok', data: [] });
    else  
      res.status(200).json(game[0].rosters);
  } catch (e) {
    console.error(e);
    res.status(500).end();
  } finally {
    if ( conn ) pool.releaseConnection(conn);
  }
});

app.get('/seasons/', async (req, res) => {
  // Read how many tables are in the database, and return the list of seasons
  const conn = await pool.getConnection();
  let sql = 'SHOW TABLES';
  let tables = [];
  try {
    const [rows, fields] = await conn.query(sql);
    tables = rows.map((row) => {
      return row[Object.keys(row)[0]];
    });
    tables = tables.filter((table) => table.includes('_games'));
    tables = tables.map((table) => {
      return table.split('_')[0];
    });
    tables = tables.sort((a, b) => (a > b ? -1 : 1));
    res.status(200).json({ message: 'ok', data: tables});
  } catch (e) {
    console.error(e);
    res.status(500).end();
  } finally {
    if ( conn ) pool.releaseConnection(conn);
  }
});

app.get('/seasonstats/', async (req, res) => {
  try {
    let stat_files = await fs.readdirSync(datapath + 'stats');
    let stats = [];
    let data = '';
    let classname = '';
    for (let _stat of stat_files) {
      classname = _stat.split('-');
      let _class = '';
      if (classname.length > 3) _class = classname[1].concat('-', classname[2]);
      else _class = classname[1];
      _class = _class.replace(/__/g, '-');
      _class = _class.replace(/_/g, ' ');

      data = JSON.parse(fs.readFileSync(datapath + 'stats/' + _stat));
      if (data.length > 0) {
        stats.push({ season: classname[0], class: _class, stats: data });
      }
    }
    res.status(200).json(stats);
  } catch (_err) {
    console.error(_err);
    res.status(500).end();
  }
});

app.get('/gamestats/', async (req, res) => {
  const year = req.query.season;
  const gameid = req.query.gameid;
  let sql = `SELECT matchdata FROM ${year}_games WHERE match_id = ?`;
  if (year < 2024) sql = `SELECT * FROM ${year}_games WHERE UniqueID = ?`;
  const conn = await pool.getConnection();
  try {
    const [rows, fields] = await conn.query(sql, [gameid]);
    let game = rows;
    let data = {};
    console.log(game);
    if ( game.length > 0 && year < 2024 )
      data = game[0].events; 
    else if (game.length > 0 && year >= 2024)
      data = { match: {...game[0].matchdata}};

    if (data) return res.status(200).json(data);
    else return res.status(404).end();
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  } finally {
    if ( conn ) pool.releaseConnection(conn);
  }
});

app.get('/players/', async (req, res) => {
  if (req.query.birth_year && !validateYear(req.query.birth_year))
    return res.status(400).json('Invalid birth year');
  if (req.query.player_id) {
    const player = await getPlayerDetails(req.query.player_id);
    if (player) {
      return res.status(200).json(player);
    } else {
      return res.status(404).json({ error: 'Player not found' });
    }
  }
  return res.status(200).json(await getPlayers(req.query.birth_year));
});

app.get('/games/', async (req, res) => {
  if (!req.query.year)
    return res.status(403).json({ error_message: 'year parameter missing' });
  let year = req.query.year;
  if (!validateYear(year)) {
    return res.status(400).json({ error_message: 'Invalid year parameter' });
  }
  console.log('GET games for %s', year);
  try {
    var games = await getGames(year);
    res.status(200).json(games);
  } catch (err) {
    console.log(err);
    res.status(400).json(err);
  }
});

/**
 * Server Activation
 */

app.listen(port, () => {
  console.log(
    `fball_backend running, listening to requests on http://localhost:${port}`
  );
});

var getPlayers = async function(birth_year) {

  if (birth_year)
    if (!validateYear(birth_year)) {
      throw new Error('Invalid year for birth_year')
    }
  const conn = await pool.getConnection();
  let players = [];
  let gender = "";
  let tablename = `players`;
  let sql = `SELECT player_id, firstname, lastname, birth_year, player_data FROM ${tablename}`;
  if ( birth_year) sql += ` WHERE birth_year = ${birth_year}`;
  try {
    const [rows, fields] = await conn.query(sql);
    players = rows.map(row => {
      let games_per_year = {};
      if (row.player_data) {
        try {
          const pdata = row.player_data;
          gender = row.player_data.gender;
          if (pdata.matches && Array.isArray(pdata.matches)) {
            pdata.matches.forEach(match => {
              const season = match.season_id || match.season || null;
              if (season) {
                games_per_year[season] = (games_per_year[season] || 0) + 1;
              }
            });
          }
        } catch (e) {
          console.error(e);
          // JSON parse error, ignore
        }
      }
      return {
        player_id: row.player_id,
        firstname: row.firstname,
        lastname: row.lastname,
        birth_year: row.birth_year,
        gender: gender,
        games_per_year: games_per_year
      };
    });
  } catch (e) {
    console.error(e);
  } finally {
    if ( conn ) pool.releaseConnection(conn);
    return players;
  }
}

var getGames = async function (year) {
  if (!validateYear(year)) {
    throw new Error('Invalid year for table name');
  }
  const conn = await pool.getConnection();
  let games = [];
  let tablename = `\`${year}_games\``;
  let sql = `SELECT * FROM ${tablename}`;
  try {
    const [rows, fields] = await conn.query(sql);
    games = rows;
    if (year > 2023) {
      games = games.map((match) => {
        return {
          GameDate: match.matchdata.date,
          GameTime: match.matchdata.time,
          UniqueID: match.matchdata.match_id,
          HomeTeamName: match.matchdata.team_A_description_en,
          AwayTeamName: match.matchdata.team_B_description_en,
          Result: `${match.matchdata.fs_A}-${match.matchdata.fs_B}`,
          Game: `${match.matchdata.team_A_description_en}-${match.matchdata.team_B_description_en}`,
          group: match.matchdata.group_name,
          groupID: match.matchdata.category_abbrevation,
          class: match.matchdata.category_name,
          RinkName: match.matchdata.venue_name,
        };
      });
    } else {
      // map GameDate to yyyy-mm-dd format  
      for (let i = 0; i < games.length; i++) {
        const date = DateTime.fromJSDate(games[i].GameDate);
        if (date.isValid) {
          games[i].GameDate = date.toFormat('yyyy-MM-dd');
        } else {
          console.log(`Invalid DateTime for game ${i}: ${games[i].GameDate}`);
        }
      }
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    if ( conn )  pool.releaseConnection(conn);
    return games;
  }
}

// Palauttaa kaikki pelaajan tiedot (mukaan lukien player_data) player_id:llä
async function getPlayerDetails(player_id) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM players WHERE player_id = ?', [player_id]);
    if (rows.length === 0) return null;
    return rows[0];
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    if (conn) pool.releaseConnection(conn);
  }
}
