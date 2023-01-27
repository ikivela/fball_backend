var axios = require('axios');
var fs = require('fs');
var cheerio = require('cheerio');
const { DateTime } = require('luxon');


// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
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
var seasons = require('../data/config/seasons');
let currentTeam_games = [];

var getLevels = async function (season) {

  let levels = [];

  let url = 'http://tilastopalvelu.fi/fb/';
  if (seasons[season]) {
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

var getGroups = async function (param) {
  let groups = '';

  let url = `${fb_groups_url}${param.level}&area=`;
  if (seasons[param.season]) {
    fb_groups_url = fb_groups_url.replace(
      '/mod_statistics/',
      '/mod_statisticshistory/'
    );
    url = `${url}&season=${param.season}`;
  }

  //console.log(url);
  groups = await axios.get(url);
  groups = groups.data;
  //console.log(groups);
  return groups.statgroups;
};

var getGames = async function (param) {
  // groupID, season, level, teamid, rinkid) {
  let url = `${fb_games_url}${param.groupID
    }&select=&id=&teamid=&rinkid=&rdm=${Math.random()}`;

  if (seasons[param.season]) {
    fb_games_url = fb_games_url.replace(
      '/mod_schedule/',
      '/mod_schedulehistory/'
    );
    url = `${url}&season=${param.season}`;
  }

  let teamid = param.teamid ? param.teamid : '';
  let rinkid = param.rinkid ? param.rinkid : '';
  let random = Math.random();
  let games = [];
  try {
    //console.log(url);
    let response = await axios.post(url, {});
    games = response.data.games;
  } catch (e) {
    console.log(url);
    console.error(e);
    games = [];
  }

  return games;
};

function isTooOld(file, interval = { days: days_old }) {
  try {
    const file_stats = fs.existsSync(file) ? fs.statSync(file) : undefined;
    if (!file_stats) {
      console.log(`${file} does not exist`);
      return true;
    }
    file_time = file_stats.mtime; //.toString();
    return DateTime.fromJSDate(file_time).toMillis() <
      DateTime.now().minus(interval).toMillis()
      ? true
      : false;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function getTeamGames(params) {
  // Check the currentSeason's year, i.e. when to switch new season
  const currentTeam = params.team ? params.team : 'Nibacos';
  const days_old = params.days ? params.days : 7;
  var total = 0;

  if (params && params.update)
    params.update = params.update == true ? true : false;

  var _season = !params.season ? 'current' : params.season;
  if (_season == 'current') {
    _season = DateTime.now().year;
    console.log("Adjusting current season %s", _season);
  }
  console.log('Params: update=%s, season=%s', params.update, _season);

  if (
    isTooOld(`${basepath}${_season}-${currentTeam}_games.json`, {
      days: days_old,
    }) ||
    params.update
  ) {
    console.log(
      `File ${basepath}${_season}-${currentTeam}_games.json is too old, update`
    );

    let _levels = await getLevels(_season);
    console.log(`Season ${_season}`);

    for (let level of _levels) {
      //console.log(level, _season);
      let groups = await getGroups({
        season: _season,
        level: level.id,
      });
      if (!Array.isArray(groups)) {
        console.error('Could not fetch game groups');
        return;
      }
      for (let group of groups) {
        let games = await getGames({
          groupID: group.StatGroupID,
          level: level,
          season: _season,
        });
        console.log(`${level.name} ${group.Name} [${games.length}]`);
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
              currentTeam_games.push({
                ...game,
                groupID: group.StatGroupID,
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
    console.log(
      'Writing %s games for team %s',
      currentTeam_games.length,
      currentTeam
    );

    fs.writeFileSync(
      `${basepath}${_season}-${currentTeam}_games.json`,
      JSON.stringify(currentTeam_games),
      'utf8'
    );
  } else {
    console.log(`Reading ${_season}-${currentTeam}_games.json`);
    currentTeam_games = JSON.parse(
      fs.readFileSync(`${basepath}${_season}-${currentTeam}_games.json`)
    );
  }
}

const yargs = require('yargs');
const argv = yargs
  .option('season', {
    alias: 's',
    description: 'season to fetch',
    type: 'number',
  })
  .option('update', {
    alias: 'u',
    description: 'Update the season datafile',
    type: 'boolean',
  })
  .option('days', {
    alias: 'd',
    description: 'Number of days after the season datafile gets updated',
    type: 'number',
  })
  .option('team', {
    description: 'The team name to search for',
    type: 'string',
  })
  .help()
  .alias('help', 'h').argv;

if (!argv.team) {
  console.log(argv);
  console.log('Use --team teamname to search your team');
  process.exit(-1);
}

getTeamGames({
  season: argv.season,
  update: argv.update,
  days: argv.days,
  team: argv.team,
});
