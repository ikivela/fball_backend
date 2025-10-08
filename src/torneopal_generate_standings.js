var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');
require('dotenv').config();
const mysql = require('mysql2/promise');
require('dotenv').config()

// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';

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

// Remove default secrets for production safety
var token = getEnvVar('token', null);
if (!token) {
  console.error('API token is required. Set the token environment variable.');
  process.exit(1);
}
var season = getEnvVar('season', '2025-2026');
var club_id = getEnvVar('club_id', null);
if (!club_id) {
  console.error('Club ID is required. Set the club_id environment variable.');
  process.exit(1);
}

var basepath = './data/';

const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

var getCategories = async function () {

  // fetch games from database
  var rows = [];
  try {
    var connection = await pool.getConnection();
    // select unique categories from the 2026_games table
    console.log('Fetching categories from database');
    // Use a query to get unique categories
    // Note: Adjust the table name and column names as per your database schema
    [rows] = await connection.query(
      'SELECT DISTINCT category_id, competition_id, competition_name FROM 2026_games'
    );
    // Close the connection
    connection.release();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  console.log('Fetching categories from database');
  console.log(rows.length, 'categories found');
  console.log(rows);

  // Use the filter method to create a new array with unique objects
  const uniqueObjectsSet = new Set();
  const cats = rows.filter((obj) => {
    const key = obj.category_id + obj.competition_name;
    // Do not add empty categories
    if (!obj.category_id || !obj.competition_name) {
      return false;
    }
    if (!uniqueObjectsSet.has(key)) {
      uniqueObjectsSet.add(key);
      return true;
    }
    return false;
  });
  console.log('Unique categories:', cats.length);
  return cats;
};

var doHTMLtables = async function () {
  var files = fs.readdirSync(`${basepath}/standings/`);
  files = files.filter(file => file.includes('json'));
  for (let file of files) {
    var content = await fs.readFileSync(`${basepath}/standings/${file}`);
    content = JSON.parse(content);
    if ( !content.category || !content.category.groups ) {
      console.error(`Invalid content in file ${file}, skipping.`);
      continue;
    }
    var category_name = content.category.category_name;
    var season = content.category.season_id;
    var htmltable = '';

    for (let group of content.category.groups) {
      //console.log(group.competition_name, group.group_name);
      var name = `<h4>${category_name} ${group.group_name}</h4>\n<table><tr>
      <th>Joukkue</th>
      <th>O</th>
      <th>V</th>
      <th>JV</th>
      <th>JH</th>
      <th>H</th>
      <th>M</th>
      <th>ME</th>
      <th>P</th>
      <th>P/O</th>
  </tr>\n`;
      var standings = group.teams
        .map(
          (item) => `
            <tr>
                <td>${item.team_name}</td>
                <td>${item.matches_played}</td>
                <td>${item.matches_won || ""}</td>
                <td>${item.matches_tiedwon || ""}</td>
                <td>${item.matches_tied || ""}</td>
                <td>${item.matches_lost || ""}</td>
                <td>${item.goals_for || ""}-${item.goals_against || ""}</td>
                <td>${item.goals_diff || ""}</td>
                <td>${item.points || ""}</td>
                <td>${item.points_per_match ? parseFloat(item.points_per_match).toFixed(1) : ""}</td>
            </tr>
        `
        )
        .join('\n');

      htmltable += `${name}${standings}</table>`;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${category_name} salibandy</title>
    <style>
        table {
            border-collapse: collapse;
            
        }
        th, td {
            border: 1px solid black;
            padding: 0.5em;
            text-align: left;
        }
    </style>
</head>
<body>
  ${htmltable}
  ${content.category.category_notice_full}
</body>
</html>`;

    var filename = `${category_name.replace(' ', '_')}`;
    await fs.writeFileSync(
      `${basepath}/files/${filename}.html`,
      htmlContent
    );
    console.log(`HTML table for ${category_name} saved as ${filename}.html`);
  }
};

var getStandings = async function (category) {
  try {

    let url = `${base_url}/getCategory?competition_id=${category.competition_id}&category_id=${category.category_id}&api_key=${token}`;
    const response = await axios.get(url);
    if (response.data.call.status == 'error') {
      console.error(category.name, url);
      console.error(response.data.call.error);
      return;
    }
    
    // Save to Database
    // get season last 4 digits after '-'
    season = season.split('-').pop();
    if (!validateYear(season)) {
      console.error(`Invalid year for table name: ${season}`);
      process.exit(1);
    }

    const connection = await pool.getConnection();
    var category_name = response.data.category.category_name;
    var category_id = response.data.category.category_id;
    var competition_name = response.data.category.competition_name;

    console.log('Saving standings for season:', season, category_name, competition_name);
    await connection.query(
      `INSERT INTO standings (season, category_id, category_name, competition_name, data)
   VALUES (?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE
     category_name = VALUES(category_name),
     data = VALUES(data)`,
      [season, category_id, category_name, competition_name, JSON.stringify({ groups : response.data.category.groups })]
    );
    await fs.writeFileSync(`${basepath}/standings/${category_name.replace(' ', '_')}.json`, JSON.stringify(response.data));
    //console.log(`Standings for ${category_name} saved to database and file.`);
    connection.release();

  } catch (e) {
    console.error(e);
  }
};

async function doFetch(update) {
  //	var games = await getGames();
  console.log("Season:", season);
  const cats = await getCategories();
  if (cats.length === 0) {
    console.error('No categories found, exiting.');
    process.exit(1);
  }
  //await fs.writeFileSync(`${basepath}/standings/cats.json`, JSON.stringify(cats));
  if (update) {
    for (let cat of cats) {
      await getStandings(cat);
    }
  }
  doHTMLtables();
  await pool.end();
  //fs.writeFileSync(`${basepath}./2024-Nibacos_games.json`, JSON.stringify(games));
}

doFetch(true);
