var axios = require('axios');
var fs = require('fs');
var async = require('async');

seasons = [28, 29, 30];

var fb_areas_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statisticshistory/helper/areas.php?level='; //2020';
var fb_groups_url =
  'http://tilastopalvelu.fi/fb/modules/mod_statisticshistory/helper/statgroups.php?level='; //2020';
var fb_games_url =
  'http://tilastopalvelu.fi/fb/modules/mod_schedulehistory/helper/games.php?statgroupid=';
var fb_games_stats =
  'http://tilastopalvelu.fi/fb/modules/mod_gamereporthistory/helper/actions.php?gameid=';
//&select=&id=&teamid=&rinkid=&season=2020&rdm=0.4436202946460597';

var players = [];
var basepath = '../data/';

var addStat = async function (scorer, assistant, gameID) {
  gameID = parseInt(gameID);
  if (assistant) {
    assistant = assistant.split(' ');
    assistant = assistant[1] + ' ' + assistant[2];
  }
  let _player = '';

  console.log('Goal', scorer, assistant);

  // Search for player
  let id = players.findIndex((x) => {
    return x.name == scorer;
  });
  if (id > -1) {
    players[id].goals++;
    if (players[id].games.indexOf(gameID) === -1) {
      players[id].games.push(gameID);
    }
  } else {
    _player = { name: scorer, games: [], goals: 1, assists: 0 };
    _player.games.push(gameID);
    players.push(_player);
  }

  if (assistant) {
    id = players.findIndex((x) => {
      return x.name == assistant;
    });
    // Add assists
    if (id > -1) {
      players[id].assists++;
      if (players[id].games.indexOf(gameID) === -1)
        players[id].games.push(gameID);
    } else {
      _player = { name: assistant, games: [], goals: 0, assists: 1 };
      _player.games.push(gameID);
      players.push(_player);
    }
  }
  //console.log( players );
};

var getAreas = async function (season, level) {
  var path = basepath + season + '-' + level + '-areas.json';
  if (!fs.existsSync(path)) {
    areas = await axios.get(fb_areas_url + level + '&season=' + season);
    fs.writeFileSync(path, JSON.stringify(areas.data));
  } else {
    areas = JSON.parse(fs.readFileSync(path));
  }
};

var getGroups = async function (season, level) {
  var path = basepath + season + '-' + level + '-groups.json';
  let groups_all = '';

  if (!fs.existsSync(path)) {
    console.log(
      'fetching data %s',
      fb_groups_url + level + '&area=&season=' + season
    );
    groups_all = await axios.get(
      fb_groups_url + level + '&area=&season=' + season
    );
    groups_all = groups_all.data;
    fs.writeFileSync(path, JSON.stringify(groups_all));
  } else {
    groups_all = JSON.parse(fs.readFileSync(path));
  }
  return groups_all;
};

var getGroup = async function (area, season, level) {
  var path = basepath + season + '-' + level + '-' + area + '-group.json';
  var group = '';
  if (!fs.existsSync(path)) {
    group = await axios.get(
      fb_groups_url + '&season=' + season + '&area=' + area
    );
    fs.writeFilesync(path, JSON.stringify(group.data));
    group = group.data;
  } else {
    group = JSON.parse(fs.readFileSync(path));
  }
  return group;
};

var getGames = async function (groupID, season, level, teamid, rinkid) {
  teamid = teamid ? teamid : '';
  rinkid = rinkid ? rinkid : '';
  var path = basepath + season + '-' + level + '-' + groupID + '-games.json';
  let games = '';
  if (!fs.existsSync(path)) {
    let response = await axios.get(
      fb_games_url +
        groupID +
        '&teamid=' +
        teamid +
        '&select=&id=&rinkid=' +
        rinkid +
        '&season=' +
        season
    );
    games = response.data.games;
    
    fs.writeFileSync(path, JSON.stringify(games));
  } else {
    games = JSON.parse(fs.readFileSync(path));
  }
  return games;
};

var getGameStats = async function (gameID, season, level) {
  var path = basepath + season + '-' + level + '-' + gameID + '-gameStats.txt';
  let stats = '';

  if (!fs.existsSync(path)) {
    stats = await axios.post(
      fb_games_stats + gameID + '&season=' + season + '&rdm=' + Math.random()
    );
    stats = stats.data;
    fs.writeFileSync(path, JSON.stringify(stats));
  } else {
    stats = JSON.parse(fs.readFileSync(path));
  }

  return stats;
};

async function getStats(season, classid) {
  let areas = await getAreas(season, classid);
  let groups_all = await getGroups(season, classid);

  if (groups_all) {
    let lohkot = groups_all.statgroups.filter((x) => {
      return x.Name.includes('PM');
    });

    if (lohkot.length > 0) {
      for (let lohko of lohkot) {
        console.log('lohko', lohko.Name);
        let games = await getGames(lohko.StatGroupID, season, classid);

        if (games && games.length > 0) {
          games = games.filter((x) => {
            return (
              x.HomeTeamName.includes('Nibacos') ||
              x.AwayTeamName.includes('Nibacos')
            );
          });

          if (games.length > 0) {
            for (let game of games) {
              console.log(
                game.UniqueID,
                game.GameDate,
                game.Result,
                game.HomeTeamName,
                game.AwayTeamName,
                game.RinkName
              );
              if (game.Result !== '-') {
                let tilasto = await getGameStats(
                  game.UniqueID,
                  season,
                  classid
                );
                tilasto = tilasto.split(';');

                if (tilasto.length > 0) {
                  for (i = 0; i < tilasto.length - 1; i++) {
                    let merkinta = tilasto[i].split(':');
                    //console.log( merkinta );
                    if (merkinta[1] == '1' && merkinta[5].includes('Nibacos'))
                      await addStat(merkinta[6], merkinta[7], game.UniqueID);
                  }
                }
              }
            }

            console.log('game parsed done');
            players.map((x) => {
              x.total = x.goals + x.assists;
            });
            players.sort((a, b) => {
              return a.total > b.total ? -1 : 1;
            });
            fs.writeFileSync(
              basepath + season + '-' + classid + '-stats-.json',
              JSON.stringify(players)
            );
            return players;
          }
        } else {
        }
      }
      console.log('group parsed');
    } else {
      console.log('No PM groups found');
    }
  }
}

async function runScript() {
  await getStats('2020', '28');
  //await getStats( '2020', '27' );
  for (let _player of players)
    console.log(_player.name, _player.goals, _player.assists, _player.total);
}

module.exports = {
  generate: getStats,
};

if ( module.parent === null ) {
  runScript();
}

//runScript();
