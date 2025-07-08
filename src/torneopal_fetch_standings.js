var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');
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
var season = getEnvVar('season', '2023-2024');
var club_id = getEnvVar('club_id', '368');
if (!club_id) {
  console.error('Club ID is required. Set the club_id environment variable.');
  process.exit(1);
}

var basepath = './data/';

// https://salibandy.api.torneopal.com/taso/rest/getGroup?competition_id=sb2023&category_id=875&group_id=1

var getStandings = async function (cat_id) {

  try {

    let response = await axios.get(`${base_url}/getGroup?competition_id=sb2023&category_id=${cat_id}&group_id=1&api_key=${token}`);
    return response.data;
  } catch (e) {
    console.log(base_url);
    console.error(e);
    games = [];
  }

  return games;
};

async function doFetch() {
  var standings = await getStandings(875);
  console.log(standings.group.group_name, standings.group.teams.length);

  //fs.writeFileSync(`${basepath}./2024-Nibacos_games.json`, JSON.stringify(games));
}

doFetch();

