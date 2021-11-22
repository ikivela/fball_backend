var axios = require('axios');
var fs = require('fs');
var async = require('async');
var cheerio = require('cheerio');
const { DateTime } = require('luxon');
// add timestamps in front of log messages
require('console-stamp')(console, '[HH:MM:ss.l]');

const currentTeam = 'Nibacos';
var fb_areas_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statistics/helper/areas.php?level='; //2020';
var fb_groups_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statistics/helper/statgroups.php?level='; //2020';
var fb_games_url =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/games.php?statgroupid=';
var fb_games_stats =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/game.php?gameid=';
//&select=&id=&teamid=&rinkid=&season=2020&rdm=0.4436202946460597';

var basepath = './data/';

let currentTeam_games = [];

var getLevels = async function (season) {
  let seasons = {
    2013: 3,
    2014: 4,
    2015: 5,
    2016: 6,
    2017: 7,
    2018: 8,
    2019: 9,
    2020: 10,
  };
  let levels = [];

  let url = 'http://tilastopalvelu.fi/fb/';
  if (season && season != DateTime.now().toFormat('yyyy')) {
    url = `http://tilastopalvelu.fi/fb/index.php/component/content/article?id=12&ssnid=${seasons[season]}`;
  }
  console.log(url);
  let body = await axios({ method: 'get', url: url });
  let $ = cheerio.load(body.data);
  $('#result_level_select')
    .find('option')
    .each((i, elem) => {
      let value = $(elem).attr('value');
      let level = $(elem).text();
      //console.log(`[${value}][${level}]`);
      if (value != '') levels.push({ id: value, name: level });
    });
  return levels;
};

var getAreas = async function (param) {
  //console.log("GetAreas", param);
  let areas = await axios.get(
    fb_areas_url + param.level.id + '&season=' + param.season
  );
  return areas.data;
};

var getGroups = async function (param) {
  let groups = '';
  if (param.season && param.season != DateTime.now().toFormat('yyyy'))
    fb_groups_url = fb_groups_url.replace(
      '/mod_statistics/',
      '/mod_statisticshistory/'
    );

  let url = `${fb_groups_url}${param.level}&area=&season=${param.season}`;
  console.log(url);
  groups = await axios.get(url);
  groups = groups.data;
  //console.log(groups);
  return groups.statgroups;
};

var getGames = async function (param) {
  // groupID, season, level, teamid, rinkid) {
  //console.log(param);
  if (param.season && param.season != DateTime.now().toFormat('yyyy'))
    fb_games_url = fb_games_url.replace(
      '/mod_schedule/',
      '/mod_schedulehistory/'
    );

  let teamid = param.teamid ? param.teamid : '';
  let rinkid = param.rinkid ? param.rinkid : '';
  let random = Math.random();
  let games = [];
  let url = `${fb_games_url}${param.groupID}&select=&id=&teamid=${teamid}&rinkid=${rinkid}&rdm=${random}&season=${param.season}`;
  try {
    let response = await axios.post(url, {});
    games = response.data.games;
  } catch (e) {
    console.log(url);
    console.error(e);
    games = [];
  }

  return games;
};

function isTooOld( file ) {

  const file_stats = fs.statSync(file, interval);
  file_time = file_stats.mtime; //.toString();
  return ( DateTime.fromJSDate(file_time).toMillis() < DateTime.now().minus(interval).toMillis() ) ? true : false;
}

async function getTeamGames(params) {

  _season = params.season ? params.season : DateTime.now().toFormat('yyyy');
  let total = 0;

  if (
    !fs.existsSync(`${basepath}${_season}-${currentTeam}_games.json`) ||
    params.update
  ) {
    let _levels = await getLevels(_season);
    console.log(`Season ${_season}`);
    for (let level of _levels) {
      //console.log(level, _season);
      let groups = await getGroups({ season: _season, level: level.id });
      for (let group of groups) {
        let games = await getGames({
          groupID: group.StatGroupID,
          season: _season,
          level: level,
        });
        console.log(`${level.name} ${group.Name} games [${games.length}]`);
        total += games.length;

        if (games) {
          games = games.filter((x) => {
            return (
              x.HomeTeamName.includes(currentTeam) ||
              x.AwayTeamName.includes(currentTeam)
            );
          });

          if (games.length > 0) {
            for (let game of games) {
              /*            console.log(
                game.UniqueID,
                game.GameDate,
                game.Result,
                game.HomeTeamName,
                game.AwayTeamName,
                game.RinkName
              );*/
              currentTeam_games.push({
                ...game,
                group: group.Name,
                class: level.name,
              });
            }
          }
        } else {
          console.log('Games not found for %s', group.Name);
        }
      } // group of groups
    }

    fs.writeFileSync(
      `${basepath}${_season}-${currentTeam}_games.json`,
      JSON.stringify({
        updated: DateTime.now().toISODate(),
        games: currentTeam_games,
      }),
      'utf8'
    );
  } else {
    console.log(`Reading ${_season}-${currentTeam}_games.json`);
    currentTeam_games = JSON.parse(
      fs.readFileSync(`${basepath}${_season}-${currentTeam}_games.json`)
    );
  }

  console.log('Found %s %s games ', currentTeam_games.length, currentTeam);
}

module.exports = {
  getGames: getTeamGames,
};

if (module.parent === null) {
  getTeamGames({ season: process.argv[2], update: true });
}

//runScript();
