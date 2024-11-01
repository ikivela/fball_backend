var axios = require('axios');
var fs = require('fs');


const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
require('dotenv').config()


const { DateTime } = require('luxon');
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || "your_token";
var tokens = process.env.tokens || "your_token2";
var season = '2024-2025';
var club_id = process.env.club_id || "your_club_id";

const seasons = require('../data/config/seasons');
var basepath = './data/';


var getGameStats = async function (index, games_length, gameID, season) {
  let game_url = `${base_url}getMatch?match_id=${gameID}&api_key=${token}&club_id=${club_id}`;
  //console.log('game url', gameID, game_url);
  try {
    stats = await axios.post(game_url);
    if (stats.data == 'Invalid key') throw new Error('Invalid key for game_url', game_url);
    let writepath = basepath + 'gamestats/' + season + '-gamestats-' + gameID + ".json";
    await fs.writeFileSync(writepath, JSON.stringify(stats.data), { encoding: "utf8" });
    console.log(`Game ${gameID} fetched and saved`);
  } catch (e) {
    console.error(e);
  }
}

async function fetchStats(from_date, _file) {
  console.log("Fetch games file:", _file, "from_date", from_date);
  let season = _file.split('-')[0];
  games = JSON.parse(fs.readFileSync(basepath + _file), 'utf8');
  if (from_date) {
      games = games.matches.filter(game => {
       return game.date > from_date && game.date <= DateTime.now().toFormat('yyyy-MM-dd') ? true : false;
      });
  } else {
      games = games.matches.filter(game => {
       return game.date == DateTime.now().toFormat('yyyy-MM-dd') ? true : false;
      });
  }

  if (games.length == 0) console.log("No games found.");
  else console.log("Found %s games", games.length);
  for (const [index, game] of games.entries()) {
    await getGameStats(index, games.length, game.match_id, season);
  }
}

async function fetchTodaysResults(params, team, season) {
  let file = `${season}-${team}_games.json`;
  await fetchStats(params, file);
}

fetchTodaysResults(argv.from_date, 'Nibacos', 2025);

