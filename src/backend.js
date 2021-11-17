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

const app = express();
const port = process.env.PORT || '8000';
var cors = require('cors');
var datapath = './data/';

/*
 *  App Configuration
 */
app.use(cors());

/**
 * Routes Definitions
 */
app.get('/', (req, res) => {
  res.status(200).json({ message: 'säbästats ok' });
});

app.get('/stats', async (req, res) => {
  let data = await Stats.generate('2020', '28');
  res.status(200).json(data);
});

app.get('/games/', async (req, res) => {
  var contents;
  console.time('GET games');
  try {
    let data = fs.readFileSync(datapath + 'nibacos_games.json', 'utf8');
    data = JSON.parse(data);
    console.timeEnd('GET games');
    return res.status(200).json(data);
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
    `Säbästats server, listening to requests on http://localhost:${port}`
  );
});
