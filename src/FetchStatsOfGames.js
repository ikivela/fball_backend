var axios = require('axios');
var fs = require('fs');
var cheerio = require('cheerio');
const { DateTime } = require('luxon');
// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

const seasons = require('../data/config/seasons');

const fb_areas_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statistics/helper/areas.php?level='; //2020';
const fb_groups_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statistics/helper/statgroups.php?level='; //2020';
const fb_games_url =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/games.php?statgroupid=';
var fb_games_stats =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/game.php?gameid=';
//&select=&id=&teamid=&rinkid=&season=2020&rdm=0.4436202946460597';

var basepath = './data/';

var files = fs.readdirSync( basepath );
files = files.filter( file => file.includes('Nibacos_games'));

function parseEvents(response, gameid, year) {
  var actions = response.split('\n');
  actions = actions.filter((x) => x.includes(gameid));
  if (actions.length == 0) return [];
  actions = actions[0].split(';');
  //console.log(actions);
  var events = [];

  for (var i = 0; i < actions.length; i++) {
    var action = actions[i].split(':');
    var stat = '';
    // GOAL
    if (action[1] == '1') {
      stat = {
        event: 'goal',
        time: action[2],
        result: action[3],
        yv_av: action[4],
        team: action[5],
        scorer: action[6],
        assist: action[7].replace(/\d{1,2} /, ''),
      };
      events.push(stat);
    } else if (action[1] == '2') {
      stat = {
        event: 'penalty',
        time: action[2],
        penalty_time: action[3] + ' min',
        team: action[4],
        player: action[5],
        reason: action[7].split('|')[0],
      };
      events.push(stat);
    }
  }
  return events;
}

var getGameStats = async function (index, games_length, gameID, season) {
  let game_url = `http://tilastopalvelu.fi/fb/modules/mod_gamereport/helper/actions.php?gameid=${gameID}&rnd=${Math.random()}`;

  if (seasons[season]) {
    game_url = game_url.replace('/mod_gamereport/', '/mod_gamereporthistory/');
    game_url = `${game_url}&season=${season}`;
  }
  console.log('game url', game_url);
  stats = await axios.post(game_url);
  stats = parseEvents( stats.data, gameID );
  let writepath = basepath + 'gamestats/' + season + '-gamestats-' + gameID + ".json";
  console.log(`writing: ${writepath} ${index}/${games_length}` );
  await fs.writeFileSync( writepath, JSON.stringify(stats), { encoding: "utf8"});
}

async function fetchStats( _file ) {
  console.log("Fetch games file:", _file );
  let season = _file.split('-')[0];
  games = JSON.parse(fs.readFileSync( basepath + _file ), 'utf8');
  
  games = games.filter( game => { 
    return game.GameDate < DateTime.now().toFormat('yyyy-MM-dd') ? true : false; 
  });

  for ( const[index, game] of games.entries() ) {
    await getGameStats( index, games.length, game.UniqueID, season);
  }	 
}

async function fetchSeasons() {
  //for ( let file of files ) {
  let file = '2023-Nibacos_games.json';
   await fetchStats( file );
  //}
}

fetchSeasons();

