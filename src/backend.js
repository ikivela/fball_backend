// index.js

/**
 * Required External Modules
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const Stats = require('./Stats');

/**
 * App Variables
 */

require('dotenv').config();
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

const currentTeam = 'Nibacos';
const app = express();
const port = process.env.PORT || '3000';
var cors = require('cors');
const axios = require('axios');
const seasons = require('../data/config/seasons.json');
var datapath = path.join(path.resolve(__dirname), '../data/');

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
  if ( fs.existsSync(filepath)) {
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
      fs.writeFileSync( `${datapath}/gamestats/${req.query.season}-gamestats-${req.query.gameid}.json`, JSON.stringify(events), 'utf8');
      res.status(200).json(events);
    } else {
      res.status(404).end();
    }
 }
});

app.get('/games/', async (req, res) => {
  if (!req.query.year) return res.status(403).json({ error_message: "year parameter missing"});
  let year = req.query.year;
  console.log('GET games for %s', year);

  try {
    let filepath = `${datapath}${year}-${currentTeam}_games.json`;
    if (fs.existsSync(filepath)) {
      res.status(200).sendFile(filepath);
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
  let game_url = `http://tilastopalvelu.fi/fb/modules/mod_gamereport/helper/actions.php?gameid=${gameID}&rnd=${Math.random()}`;
  if (seasons[season.toString()]) {
    console.log("archived season");
    game_url = game_url.replace('/mod_gamereport/', '/mod_gamereporthistory/');
    game_url = `${game_url}&season=${season}`;
  }
  console.log('game url', game_url);
  stats = await axios.post(game_url);
  return stats.data;
};
