var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');
require('dotenv').config()

// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';

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

var searchPlayer = async function (search_text, season, club_id) {

  try {

    let response = await axios.get(`${base_url}/search?text=${encodeURIComponent(search_text)}&api_key=${token}&competition_id=sb2015&club_id=${club_id}`);
    return response.data;
  } catch (e) {
    console.log(base_url);
    console.error(e);
    games = [];
  }

  return games;
};

async function doFetch() {
  var season = 'sb2015';
  var res = await searchPlayer(' ', season, process.env.your_club_id);
  // filter object with club_id 368
  player = res.results.filter(p => p.data.club_id == process.env.your_club_id);
  console.log(JSON.stringify(player, null, 2));

}

doFetch();

