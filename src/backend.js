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
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * App Variables
 */

require('dotenv').config();

// Create the conn pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
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
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
// Tokenit tallennetaan kantaan SHA-256-tiivisteinä
function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Middleware apitokenin tarkistukseen
async function requireApiToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid or missing API token' });
  }
  const userToken = authHeader.replace('Bearer ', '');
  // Vanha rekisteröinnin oletustoken ei kelpaa tunnistautumiseen
  if (!userToken || userToken === 'default_token') {
    return res.status(401).json({ error: 'Invalid or missing API token' });
  }
  try {
    const [rows] = await pool.query('SELECT valid_login FROM users WHERE token = ?', [hashToken(userToken)]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or missing API token' });
    }
    // Tarkista valid_login
    const validLogin = rows[0].valid_login;
    const now = new Date();
    const validDate = new Date(validLogin);
    // 6kk = 6*30*24*60*60*1000 ms
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
    if (now - validDate > sixMonthsMs) {
      return res.status(401).json({ error: 'Token expired' });
    }
    next();
  } catch (err) {
    console.error('Token check failed:', err);
    return res.status(500).json({ error: 'Token check failed' });
  }
}
const port = process.env.PORT || 3000;
const datapath = path.join(path.resolve(__dirname), '../data/');

/*
 *  App Configuration
 */
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));
// Epäonnistuneiden kirjautumisten rajoitus IP-osoitteittain
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map();

function isLoginBlocked(ip) {
  const entry = loginFailures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(ip) {
  const entry = loginFailures.get(ip);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.set(ip, { count: 1, first: Date.now() });
  } else {
    entry.count++;
  }
}

// Kirjautumisreitti
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (isLoginBlocked(req.ip)) {
    return res.status(429).json({ error: 'Too many failed login attempts, try again later' });
  }
  try {
    // Hae käyttäjä users-taulusta
    const [rows] = await pool.query('SELECT username, password FROM users WHERE username = ?', [username]);
    // Tarkista salasana bcryptillä
    const match = rows.length > 0 && await bcrypt.compare(password, rows[0].password);
    if (!match) {
      recordLoginFailure(req.ip);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    loginFailures.delete(req.ip);
    // Uusi token jokaisella kirjautumisella, kantaan vain tiiviste
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE users SET token = ?, valid_login = NOW() WHERE username = ?', [hashToken(token), username]);
    return res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Routes Definitions
 */
app.get('/', requireApiToken, (req, res) => {
  res.status(200).end('Floorball backend is running');
});

app.get('/standings/', requireApiToken, async (req, res) => {

  try {
    let sql = `SELECT category_id, season, category_name, data FROM standings ORDER BY season DESC`;
    const [rows, fields] = await pool.query(sql);
    let standings = rows.map(row => {
      return {
        category_id: row.category_id,
        season: row.season,
        category_name: row.category_name,
        groups: row.data.groups.map(group => {
          return {
            group_name: group.group_name,
            teams: group.teams.map(team => {
              return {
                team_id: team.team_id,
                team_name: team.team_name,
                matches_played: team.matches_played,
                matches_won: team.matches_won,
                matches_lost: team.matches_lost,
                matches_tied: team.matches_tied,
                goals_diff: team.goals_diff,
                goals_for: team.goals_for,
                goals_against: team.goals_against,
                points: team.points,

              }
            })
          }
        })
      }
    });

    res.status(200).json(standings);

  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});


app.get('/roster/', requireApiToken, async (req, res) => {
  const year = req.query.season ? req.query.season : new Date().getFullYear();
  const gameid = req.query.gameid;

  if (!gameid) {
    return res.status(400).json({ error: 'Missing gameid parameter' });
  }
  if (!validateYear(year)) {
    return res.status(400).json({ error: 'Invalid year/season parameter' });
  }
  let sql = `SELECT rosters FROM \`${year}_games\` WHERE UniqueID = ?`;
  console.log('GET roster for gameid %s, season %s', gameid, year);

  if (year > 2023) return res.status(200).json({ message: 'ok', data: [] });
  try {
    const [rows, fields] = await pool.query(sql, [gameid]);
    let game = rows;
    if (game.length == 0)
      res.status(200).json({ message: 'No roster found', data: [] });
    else
      res.status(200).json(game[0].rosters);
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get('/seasons/', requireApiToken, async (req, res) => {
  // Read how many tables are in the database, and return the list of seasons
  let sql = 'SHOW TABLES';
  let tables = [];
  try {
    const [rows, fields] = await pool.query(sql);
    tables = rows.map((row) => {
      return row[Object.keys(row)[0]];
    });
    tables = tables.filter((table) => table.includes('_games'));
    tables = tables.map((table) => {
      return table.split('_')[0];
    });
    tables = tables.sort((a, b) => (a > b ? -1 : 1));
    res.status(200).json({ message: 'ok', data: tables });
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get('/seasonstats/', requireApiToken, async (req, res) => {
  try {
    // Get all stats from database
    let sql = `SELECT season, category, stats FROM stats`;
    const [rows, fields] = await pool.query(sql);

    let stats = rows.map(row => {
      return {
        season: row.season,
        class: row.category,
        stats: row.stats
      };
    });
    return res.status(200).json(stats);
    /*

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
    res.status(200).json(stats);*/
  } catch (_err) {
    console.error(_err);
    res.status(500).end();
  }
});

app.get('/alltime-stats/', requireApiToken, async (req, res) => {
  try {
    const gender = typeof req.query.gender === 'string' ? req.query.gender.toLowerCase() : req.query.gender; // 'naisten' or 'miesten'
    if (gender && gender !== 'naisten' && gender !== 'miesten') {
      return res.status(400).json({ error: 'Invalid gender parameter' });
    }
    let rows;
    if (gender) {
      const prefix = gender.charAt(0).toUpperCase() + gender.slice(1);
      [rows] = await pool.query('SELECT season, category, stats FROM stats WHERE category LIKE ?', [`${prefix}%`]);
    } else {
      [rows] = await pool.query('SELECT season, category, stats FROM stats');
    }

    // Filter out base categories when a "+" version exists for the same season
    // e.g. if "Miesten 2-divisioona + 1-divisioonakarsinta" exists, skip "Miesten 2-divisioona"
    const seasonCategories = {};
    for (const row of rows) {
      if (!seasonCategories[row.season]) seasonCategories[row.season] = [];
      seasonCategories[row.season].push(row.category);
    }

    const filteredRows = rows.filter(row => {
      if (!row.category.includes('+')) {
        // Check if a "+" version exists that starts with this category name
        const dominated = seasonCategories[row.season].some(
          cat => cat !== row.category && cat.includes('+') && cat.startsWith(row.category)
        );
        return !dominated;
      }
      return true;
    });

    const playerMap = {};

    for (const row of filteredRows) {
      const players = typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats;
      for (const p of players) {
        if (!playerMap[p.name]) {
          playerMap[p.name] = { name: p.name, goals: 0, assists: 0, total: 0, penalties: 0 };
        }
        playerMap[p.name].goals += p.goals || 0;
        playerMap[p.name].assists += p.assists || 0;
        playerMap[p.name].penalties += p.penalties || 0;
      }
    }

    const allTime = Object.values(playerMap).map(p => {
      p.total = p.goals + p.assists;
      return p;
    }).sort((a, b) => b.total - a.total);
    return res.status(200).json(allTime);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

app.get('/gamestats/', requireApiToken, async (req, res) => {
  const year = req.query.season;
  const gameid = req.query.gameid;
  if (!validateYear(year)) {
    return res.status(400).json({ error: 'Invalid season parameter' });
  }
  if (!gameid) {
    return res.status(400).json({ error: 'Missing gameid parameter' });
  }
  let sql = `SELECT matchdata FROM \`${year}_games\` WHERE match_id = ?`;
  if (year < 2024) sql = `SELECT * FROM \`${year}_games\` WHERE UniqueID = ?`;
  try {
    const [rows, fields] = await pool.query(sql, [gameid]);
    let game = rows;
    let data = {};
    console.log("found gameid:", gameid);
    if (game.length > 0 && year < 2024)
      data = game[0].events;
    else if (game.length > 0 && year >= 2024)
      data = { match: { ...game[0].matchdata } };

    if (data) return res.status(200).json(data);
    else return res.status(404).end();
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  }
});

app.get('/players/', requireApiToken, async (req, res) => {
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

app.get('/games/', requireApiToken, async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error_message: 'Failed to fetch games' });
  }
});

/**
 * Server Activation
 */

app.listen(port, () => {
  console.log(
    `fball_backend running, listening to requests on ${process.env.your_backend_url}:${process.env.PORT}`
  );
});

var getPlayers = async function (birth_year) {

  if (birth_year)
    if (!validateYear(birth_year)) {
      throw new Error('Invalid year for birth_year')
    }
  let players = [];
  let gender = "";
  let tablename = `players`;
  let sql = `SELECT player_id, firstname, lastname, birth_year, player_data FROM ${tablename}`;
  const queryParams = [];
  if (birth_year) {
    sql += ` WHERE birth_year = ?`;
    queryParams.push(birth_year);
  }
  try {
    const [rows, fields] = await pool.query(sql, queryParams);
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
  }
  return players;
}

var getGames = async function (year) {
  if (!validateYear(year)) {
    throw new Error('Invalid year for table name');
  }
  let games = [];
  let tablename = `\`${year}_games\``;
  let sql = `SELECT * FROM ${tablename}`;
  try {
    const [rows, fields] = await pool.query(sql);
    games = rows;
    if (year > 2023) {
      games = games.map((match) => {
        if (match.matchdata == undefined) {
          console.warn(`No match data found for game ${match.date}`);
          return {};
        } else {
          const periodWins = getPeriodWinResult(match.matchdata);
          return {
            GameDate: match.matchdata.date,
            GameTime: match.matchdata.time,
            UniqueID: match.matchdata.match_id,
            HomeTeamName: match.matchdata.team_A_description_en,
            AwayTeamName: match.matchdata.team_B_description_en,
            // Erävoittopeleissä tulos on erävoitot, maalit yhteensä erikseen
            Result: periodWins ? periodWins.result : `${match.matchdata.fs_A}-${match.matchdata.fs_B}`,
            GoalsResult: `${match.matchdata.fs_A}-${match.matchdata.fs_B}`,
            PeriodScores: periodWins ? periodWins.periods : null,
            Game: `${match.matchdata.team_A_description_en}-${match.matchdata.team_B_description_en}`,
            group: match.matchdata.group_name,
            groupID: match.matchdata.category_abbrevation,
            class: match.matchdata.category_name,
            competition: match.matchdata.competition_name,
            RinkName: match.matchdata.venue_name,
          };
        }
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
  }
  return games;
}

// Nuorten erävoittopeleissä (Torneopal: match_type "double") jokainen erä ratkaistaan erikseen.
// Palauttaa erävoitot ("0-2") ja erien tulokset ("0-13, 1-17"), tai null jos kyse ei ole erävoittopelistä
// tai eriä ei ole vielä pelattu.
function getPeriodWinResult(m) {
  if (m.match_type !== 'double') return null;
  const periodCount = Number(m.period_count) || 0;
  let winsA = 0;
  let winsB = 0;
  const periods = [];
  for (let i = 1; i <= periodCount; i++) {
    const scoreA = m[`p${i}s_A`];
    const scoreB = m[`p${i}s_B`];
    if (scoreA == null || scoreA === '' || scoreB == null || scoreB === '') continue;
    periods.push(`${scoreA}-${scoreB}`);
    const winner = m[`p${i}_winner`] || (Number(scoreA) > Number(scoreB) ? 'A' : Number(scoreB) > Number(scoreA) ? 'B' : '');
    if (winner === 'A') winsA++;
    else if (winner === 'B') winsB++;
  }
  if (periods.length === 0) return null;
  return { result: `${winsA}-${winsB}`, periods: periods.join(', ') };
}

// Palauttaa kaikki pelaajan tiedot (mukaan lukien player_data) player_id:llä
async function getPlayerDetails(player_id) {
  try {
    const [rows] = await pool.query('SELECT * FROM players WHERE player_id = ?', [player_id]);
    if (rows.length === 0) return null;
    return rows[0];
  } catch (e) {
    console.error(e);
    return null;
  }
}
