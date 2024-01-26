var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');
require('dotenv').config()

// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || "your_token";
var season = '2023-2024';
var club_id = '368';


var basepath = './data/';

// https://salibandy.api.torneopal.com/taso/rest/getGroup?competition_id=sb2023&category_id=875&group_id=1&matches=1

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

