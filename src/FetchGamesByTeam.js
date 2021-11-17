var axios = require('axios');
var fs = require('fs');
var async = require('async');
var cheerio = require('cheerio');
const { DateTime } = require('luxon');

const currentTeam = 'Nibacos';

var fb_areas_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statisticshistory/helper/areas.php?level='; //2020';
var fb_groups_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statistics/helper/statgroups.php?level='; //2020';
var fb_games_url =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/games.php?statgroupid=';
var fb_games_stats =
  'http://tilastopalvelu.fi/fb/modules/mod_schedule/helper/game.php?gameid=';
//&select=&id=&teamid=&rinkid=&season=2020&rdm=0.4436202946460597';

var basepath = './games/';

levels = [];

let nibacos_games = [];

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

  let url = 'http://tilastopalvelu.fi/fb/';
  if (season && season != '2021') {
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
};

var getAreas = async function (param) {
  //console.log("GetAreas", param);
  var path = basepath + param.season + '-areas-' + param.level.id + '.json';
  if (!fs.existsSync(path)) {
    areas = await axios.get(
      fb_areas_url + param.level.id + '&season=' + param.season
    );
    fs.writeFileSync(path, JSON.stringify(areas.data));
  } else {
    areas = JSON.parse(fs.readFileSync(path));
  }
};

var getGroups = async function (param) {
  let groups_all = '';
  let url = `${fb_groups_url}${param.level}&area=&season=${param.season}`;
  groups_all = await axios.get(url);
  groups_all = groups_all.data;
  return groups_all;
};

var getGames = async function (param) {
  // groupID, season, level, teamid, rinkid) {
  //console.log(param);
  let season = param.season ? param.season : DateTime.now().toFormat('yyyy');
  let teamid = param.teamid ? param.teamid : '';
  let rinkid = param.rinkid ? param.rinkid : '';
  var path = `${basepath}${season}-games-${param.level.id}-${param.groupID}.json`;
  let random = Math.random();
  let games = [];
  let url = `${fb_games_url}${param.groupID}&select=&id=&teamid=${teamid}&rinkid=${rinkid}&rdm=${random}&season=${param.season}`;
  let response = await axios.post(url, {});
  games = response.data.games;
  return games;
};

async function getTeamGames(_season) {
  _season = _season ? _season : '';

  if (!fs.existsSync(basepath + 'nibacos_games.json')) {
    await getLevels(_season);
    for (let level of levels) {
      //console.log(level, _season);
      let groups = await getGroups({ season: _season, level: level.id });
      console.log(groups);
      for (let group of groups.statgroups) {
        let games = await getGames({
          groupID: group.StatGroupID,
          season: _season,
          level: level,
        });
        console.log(level.name, group.Name, 'otteluita ', games);

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
              nibacos_games.push({
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
      basepath + 'nibacos_games.json',
      JSON.stringify(nibacos_games),
      'utf8'
    );
  } else {
    console.log('Reading nibacos_games.json');
    nibacos_games = JSON.parse(
      fs.readFileSync(basepath + 'nibacos_games.json')
    );
  }

  console.log('Found %s nibacos games', nibacos_games.length);
  //for (let game of nibacos_games) {
  //console.log(game);
  //}
  //await getStats();
  //await getStats( '2020', '27' );
  //for (let _player of players)
  //  console.log(_player.name, _player.goals, _player.assists, _player.total);
}

module.exports = {
  getGames: getTeamGames,
};

if (module.parent === null) {
  getTeamGames();
}

//runScript();
