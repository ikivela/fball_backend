// index.js

/**
 * Required External Modules
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
//const Stats = require('./Stats');

/**
 * App Variables
 */

require('dotenv').config();

const mysql = require('mysql2/promise');
require('dotenv').config()
// Create the conn pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: 'localhost',
  user: process.env.DB_USER,
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
const bodyParser = require('body-parser');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || 'your_token';
var tokens = process.env.tokens || 'your_token2';
var season = '2024-2025';
var club_id = process.env.club_id || 'your_club_id';

const currentTeam = 'Nibacos';
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
const port = process.env.PORT || 3000;
var cors = require('cors');
const axios = require('axios');
const seasons = require('../data/config/seasons.json');
const { pathToFileURL } = require('url');
//const players = require('../data/players.json');
var datapath = path.join(path.resolve(__dirname), '../data/');
var basepath = './data/';

/*
 *  App Configuration
 */
app.use(cors());

/**
 * Routes Definitions
 */
app.get('/', (req, res) => {
  res.status(200).json({ message: 'fball_backend ok' });
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
    //res.status(500).end('request failed');
  }
});


app.get('/roster/', async (req, res) => { 
  const conn = await pool.getConnection();
  const year = req.query.season;
  const gameid = req.query.gameid;
  let sql = `SELECT rosters FROM ${year}_games WHERE UniqueID = ?`;
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
  const conn = await await pool.getConnection();
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
    pool.releaseConnection(conn);
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
        //console.log('class', classname[0], _class);
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

app.get('/games/', async (req, res) => {
  if (!req.query.year)
    return res.status(403).json({ error_message: 'year parameter missing' });
  let year = req.query.year;
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

function parseEvents(response, gameid, year) {
  //console.log('parseEvents', response);
  var actions = response.split('\n');
  actions = actions.filter((x) => x.includes(gameid));
  if (actions.length == 0) return [];
  actions = actions[0].split(';');
  //console.log(actions);
  var events = [];

  for (var i = 0; i < actions.length; i++) {
    var action = actions[i].split(':');
    var stat = '';
    // GOAL
    if (action[1] == '1') {
      stat = {
        event: 'goal',
        time: action[2],
        result: action[3],
        yv_av: action[4],
        team: action[5],
        scorer: action[6],
        assist: action[7].replace(/\d{1,2} /, ''),
      };
      events.push(stat);
    } else if (action[1] == '2') {
      stat = {
        event: 'penalty',
        time: action[2],
        penalty_time: action[3] + ' min',
        team: action[4],
        player: action[5],
        reason: action[7].split('|')[0],
      };
      events.push(stat);
    }
  }
  return events;
}

/*
var getGameStats = async function (gameID, season) {
  let game_url = `${base_url}getMatch?match_id=${gameID}&api_key=${token}&club_id=${club_id}`;
  console.log('game url', gameID, game_url);
  try {
    stats = await axios.post(game_url);
    let writepath =
      basepath + 'gamestats/' + season + '-gamestats-' + gameID + '.json';
    //  console.log(`writing: ${writepath} ${index}/${games_length}` );
    await fs.writeFileSync(writepath, JSON.stringify(stats.data), {
      encoding: 'utf8',
    });
  } catch (e) {
    console.error(
      'getGameStat error',
      e.response.status,
      e.response.statusText
    );
  }
};
*/
var getGames = async function (year) {
  const conn = await pool.getConnection();
  let games = [];
  let tablename = `${year}_games`;
  let sql = `SELECT * FROM ${tablename}`;
  try {
    const [rows, fields] = await conn.query(sql);
    games = rows;
    //console.log(games);
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
