// index.js

/**
 * Required External Modules
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
//const Stats = require('./Stats');

/**
 * App Variables
 */

require('dotenv').config();
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || "your_token";
var tokens = process.env.tokens || "your_token2";
var season = '2023-2024';
var club_id = process.env.club_id || "your_club_id";


const currentTeam = 'Nibacos';
const app = express();
const port = process.env.PORT || 3000;
var cors = require('cors');
const axios = require('axios');
const seasons = require('../data/config/seasons.json');
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

app.get('/files/', async (req, res) => {
  
  const fullUrl = `https://luna.chydenius.fi/nibacos/api/files/`;
  const dirpath = `${datapath}/files/`;
  
  try {
    const { filename } = req.query;
    let files = await fs.readdirSync(dirpath);
    files = files.filter( file => file.includes('.html'));
    console.log('request filename', filename);
    if (files.includes(filename)) {
      // Serve the specified file
      const filePath = path.join(dirpath, filename);
      res.sendFile(filePath);
    } else {
      let tablerows = "";
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

/*
app.get('/players', async (req, res) => {
  if (players) {
    console.log('GET players', Object.keys(players).length);
    return res.status(200).json(players);
  } else {
    return res.status(404).json({ message: 'players not found' });
  }
});
*/
app.get('/seasons/', async (req, res) => {
  let files = await fs.readdirSync(datapath);
  console.log('files', files.length);
  if (files.length > 0) {
    files = files.filter((file) => file.includes(currentTeam));
    files = files.map((file) => {
      return parseInt(file.split('-')[0]);
    });
    files = files.sort((a, b) => (a > b ? -1 : 1));
    res.status(200).json({ message: 'ok', data: files });
  } else {
    res.status(404).json({ message: 'not found', data: null });
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
  console.time('getGameStats-' + req.query.gameid, req.query.season);
  let filepath = `${datapath}/gamestats/${req.query.season}-gamestats-${req.query.gameid}.json`;

  // If data already fetched
  if (fs.existsSync(filepath)) {
    console.log("file found", filepath);
    let data = await fs.readFileSync(filepath).length;
    console.log("file length", data);

    return res.status(200).sendFile(filepath);
  } else {
    var data = await getGameStats(req.query.gameid, req.query.season);

    if (data && data.length > 0) {
      // Write gamestats to file
      var events = parseEvents(data, req.query.gameid, req.query.season);
      console.log(
        'game stats',
        req.query.gameid,
        req.query.season,
        events.length
      );
      console.timeEnd('getGameStats-' + req.query.gameid);
      fs.writeFileSync(
        `${datapath}/gamestats/${req.query.season}-gamestats-${req.query.gameid}.json`,
        JSON.stringify(events),
        'utf8'
      );
      res.status(200).json(events);
    } else {
      res.status(404).end();
    }
  }
});

app.get('/games/', async (req, res) => {
  if (!req.query.year)
    return res.status(403).json({ error_message: 'year parameter missing' });
  let year = req.query.year;
  console.log('GET games for %s', year);

  try {
    let filepath = `${datapath}${year}-${currentTeam}_games.json`;
    if (fs.existsSync(filepath)) {
      if (year > 2023) {
        var games = await parseGames(filepath);
        res.status(200).json( games );  
      } else {
        res.status(200).sendFile(filepath);
      }
    } else {
      return res.status(404).json({ message: 'Not found' });
    }
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

var getGameStats = async function (gameID, season) {
  let game_url = `${base_url}getMatch?match_id=${gameID}&api_key=${token}&club_id=${club_id}`;
  console.log('game url', gameID, game_url);
  try {
    stats = await axios.post(game_url);
    let writepath = basepath + 'gamestats/' + season + '-gamestats-' + gameID + ".json";
    //  console.log(`writing: ${writepath} ${index}/${games_length}` );
    await fs.writeFileSync(writepath, JSON.stringify(stats.data), { encoding: "utf8" });
  } catch (e) {
    console.error("getGameStat error", e.response.status, e.response.statusText);
  }
}

var parseGames = async function( filepath ) {

  var games = await fs.readFileSync(filepath);
  console.log("reading", filepath, "games length", games.length);
  games = JSON.parse(games);

  games = games.matches.map((match) => {
		return {
			GameDate: match.date,
			GameTime: match.time,
			UniqueID: match.match_id,
			HomeTeamName: match.team_A_description_en,
			AwayTeamName: match.team_B_description_en,
			Result: `${match.fs_A}-${match.fs_B}`,
			Game: `${match.team_A_description_en}-${match.team_B_description_en}`,
			group: match.group_name,
			groupID: match.category_abbrevation,
			class: match.category_name,
			RinkName: match.venue_name,
		};
	});

  return games;

}
