var axios = require('axios');
var fs = require('fs');
var cheerio = require('cheerio');
const { DateTime } = require('luxon');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const api_headers = {
  headers: {
    "authority": "api.salibandy.fi",
    "accept": "application/json, text/plain, */*",
    "accept-language": "fi,en;q=0.9,en-US;q=0.8,sv;q=0.7,fr;q=0.6",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Chromium\";v=\"106\", \"Google Chrome\";v=\"106\", \"Not;A=Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "referrerPolicy": "same-origin",
  "body": null,
  "method": "GET"
};

// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');


var fb_levels_url = 'https://salibandy.fi/wp-json/sbl/v1/levels/';
var fb_games_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statistics/helper/statgroups.php?level='; //2020';
var fb_games_url =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/games.php?statgroupid=';
var fb_games_stats =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/game.php?gameid=';
//&select=&id=&teamid=&rinkid=&season=2020&rdm=0.4436202946460597';

var basepath = './data/';
var seasons = require('../data/config/seasons');
let currentTeam_games = [];


var getLevels = async function (season) {
  console.log(fb_levels_url);
  let response = await axios({ method: 'get', url: fb_levels_url });
  return response.data;
};
// -H 'authority: api.salibandy.fi'   -H 'accept: application/json, text/plain, */*'   -H 'accept-language: fi,en;q=0.9,en-US;q=0.8,sv;q=0.7,fr;q=0.6'   -H 'cache-control: no-cache'   -H 'origin: https://salibandy.fi'   -H 'pragma: no-cache'   -H 'sec-ch-ua: "Chromium";v="106", "Google Chrome";v="106", "Not;A=Brand";v="99"'   -H 'sec-ch-ua-mobile: ?0'   -H 'sec-ch-ua-platform: "Windows"'   -H 'sec-fetch-dest: empty'   -H 'sec-fetch-mode: cors'   -H 'sec-fetch-site: same-site'   -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
var getGames2 = async function () {
  var response = await axios({ method: 'get', url: "https://api.salibandy.fi/games?statGroupId=9224&season=2023" }, api_headers);

  if (response.data)
    return response.data;
  else
    console.error(response.error);
}


var getGames = async function (serie) {
  let response = await axios.get("https://api.salibandy.fi/games?statGroupID=9224&seasons=2023", {
    headers: {
      "authority": "api.salibandy.fi",
      "accept": "application/json, text/plain, */*",
      "accept-language": "fi,en;q=0.9,en-US;q=0.8,sv;q=0.7,fr;q=0.6",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": "\"Chromium\";v=\"106\", \"Google Chrome\";v=\"106\", \"Not;A=Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site"
    }
  });
  return response.data ? response.data : response.error;
}
async function test() {
  //var levels = await getLevels();
  var games = await getGames2();
  console.log("GET games", games.length);
  games = games.sort((x, y) => x.date < y.date ? true : false);
  games = games.filter(x => {
    console.log(x.homeTeam.name, x.awayTeam.name);
    return x.homeTeam.name.includes('Nibacos') || x.awayTeam.name.includes('Nibacos')
  });
  console.log("Found %s Nibacos games", games.length);
  fs.writeFileSync('src/games.json', JSON.stringify(games));
}

test();

//var suomisarja_games = getGames( ) 

/*getTeamGames({
season: argv.season,
update: argv.update,
days: argv.days,
team: argv.team,
});*/
