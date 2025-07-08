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
var season = getEnvVar('season', '2024-2025');
var club_id = getEnvVar('club_id', null);
if (!club_id) {
  console.error('Club ID is required. Set the club_id environment variable.');
  process.exit(1);
}

var basepath = './data/';
var seasons = require('../data/config/seasons');
var active_groups = require('../data/config/active_groups');
var current_games = require('../data/2025-Nibacos_games.json');
let currentTeam_games = [];


const pool = mysql.createPool({
  host: process.env.DB_HOST,  user: process.env.DB_USER,
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
  
var getCategories = async function (path) {

  var categories = current_games.matches.map((x) => {
    return {
      name: x.category_name,
      competition_id: x.competition_id,
      category_id: x.category_id,
    };
  });
  // Use the filter method to create a new array with unique objects
  const uniqueObjectsSet = new Set();
  const cats = categories.filter((obj) => {
    const key = obj.name + obj.category_id;
    if (!uniqueObjectsSet.has(key)) {
      uniqueObjectsSet.add(key);
      return true;
    }
    return false;
  });
  console.log(cats);
  return cats;
};

var doHTMLtables = async function () {
  var files = fs.readdirSync(`${basepath}/standings/`);
  files = files.filter( file => file.includes('json'));
  for (let file of files) {
    var content = await fs.readFileSync(`${basepath}/standings/${file}`);
    content = JSON.parse(content);
    var category_name = content.category.category_name;
    var season = content.category.season_id;
    var htmltable = '';

    for (let group of content.category.groups) {
      console.log(group.competition_name, group.group_name);
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
    console.log('saving category', category.name, category.category_id);
    await fs.writeFileSync(
      `${basepath}/standings/${season}_${category.name
        .substr(0, 6)
        .replace(' ', '_')}_${category.category_id}.json`,
      JSON.stringify(response.data)
    );
    //console.log(response.data);
    /*console.log(response.data.category);
    if (!response.data.category.category_name) { 
      var category_name = response.data.category.category_name.replace(' ', '_');
      var season = response.data.category.season_id;
      season = season.substr(season.length-4, season.length);
      console.log(category_name, season);
      await fs.writeFileSync(`${basepath}/standings/${season}_${category_name}.json`, JSON.stringify(response.data));
    }*/
  } catch (e) {
    console.error(e);
  }
};

async function doFetch(update) {
  //	var games = await getGames();
  const cats = await getCategories();
  //await fs.writeFileSync(`${basepath}/standings/cats.json`, JSON.stringify(cats));
  if (update) {
    for (let cat of cats) {
      await getStandings(cat);
    }
  }
  doHTMLtables();
  //fs.writeFileSync(`${basepath}./2024-Nibacos_games.json`, JSON.stringify(games));
}

doFetch(true);
