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
const currentTeam = 'Nibacos';
const app = express();
const port = process.env.PORT || '3000';
var cors = require('cors');
const { DateTime } = require('luxon');
const { deepStrictEqual } = require('assert');
const axios = require('axios');

require('console-stamp')(console, '[HH:MM:ss.l]');

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
    files = files.map((file) => {
      if (file.includes(currentTeam)) return file.substr(0, 4);
    });
    files = files.sort((a, b) => (a > b ? -1 : 1));
    res.status(200).json({ message: 'ok', data: files });
  } else {
    res.status(404).json({ message: 'not found', data: null });
  }
});
app.get('/game/:year/:id', async (req, res) => {
  console.time('getGameStats');
  var data = await getGameStats(req.params.id, req.params.year);

  if (data && data.length > 0) {
    var events = parseEvents(data, req.params.id, req.params.year);
    console.log('game stats', req.params.id, req.params.year, events.length);
    console.timeEnd('getGameStats');
    res.status(200).json(events);
  } else {
    res.status(404).end();
  }
});

app.get('/games/:year?', async (req, res) => {
  let year =
    req.params.year && req.params.year.length == 4
      ? req.params.year
      : DateTime.now().toFormat('yyyy');

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

var getGameStats = async function (gameID, year) {
  let game_url = `http://tilastopalvelu.fi/fb/modules/mod_gamereport/helper/actions.php?gameid=${gameID}&season=${
    year == '2020' ? '2021' : year
  }&rnd=${Math.random()}`;

  if (year && year != DateTime.now().toFormat('yyyy'))
    game_url = game_url.replace('/mod_gamereport/', '/mod_gamereporthistory/');
  console.log('game url', game_url);
  stats = await axios.post(game_url);
  return stats.data;
};
