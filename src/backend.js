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
const port = process.env.PORT || '80';
var cors = require('cors');
const { DateTime } = require('luxon');
const { deepStrictEqual } = require('assert');

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
    console.log(files);
    res.status(200).json({ message: 'ok', data: files });
  } else {
    console.log(files);
    res.status(404).json({ message: 'not found', data: null });
  }
});

app.get('/games/:year?', async (req, res) => {
  var contents;
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
