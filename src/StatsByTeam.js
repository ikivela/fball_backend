var axios = require('axios');
var fs = require('fs');
var async = require('async');

var players = [];
var basepath = './data/';

var findPlayer = async function (_name) {
  return players.findIndex((x) => x.name == _name);
};


async function addGoal(_playerid, _event) {
  if (_playerid > -1) {
    players[_playerid].goals++;
  } else {
    players.push({ name: _event.scorer, goals: 1, assists: 0, penalties: 0 });
  }
}

async function addAssist(_playerid, _event) {
  if (_playerid > -1) {
    players[_playerid].assists++;
  } else {
    players.push({ name: _event.assist, goals: 0, assists: 1, penalties: 0 });
  }
}

async function addPenalty(_playerid, _event) {
  if (_playerid > -1) {
    players[_playerid].penalties += parseInt(_event.penalty_time.split(' ')[0]);
  } else {
    players.push({
      name: _event.player,
      goals: 0,
      assists: 0,
      penalties: parseInt(_event.penalty_time.split(' ')[0]),
    });
  }
}

var addStat = async function (record) {
  let playerid = '';
  record.player = record.player ? record.player.trim() : undefined;
  record.scorer = record.scorer ? record.scorer.trim() : undefined;
  record.assist = record.assist ? record.assist.trim() : undefined;
  //console.log(record.event);
  if (record.event == 'goal') {
    //console.log('Goal', record.scorer, record.assist);
    playerid = await findPlayer(record.scorer);
    await addGoal(playerid, record);
    if (record.assist) {
      playerid = await findPlayer(record.assist);
      await addAssist(playerid, record);
    }
  } else if (record.event == 'penalty') {
    //console.log('Penalty', record.player, record.penalty_time);
    playerid = await findPlayer(record.player);
    await addPenalty(playerid, record);
  }
};

var getGameStats = async function (gameID, season) {
  var path =
    basepath + 'gamestats/' + season + '-gamestats-' + gameID + '.json';
  let stats = '';
  if (fs.existsSync(path)) 
    stats = JSON.parse(fs.readFileSync(path));
  else 
    stats = [];

  return stats;
};

async function getStats(_season, club, class_name) {
  // load games
  players = [];
  //console.log('getStats', _season, club, class_name);
  let games = JSON.parse(
    fs.readFileSync(basepath + _season + '-' + club + '_games.json')
  );
  games = games.filter((game) => {
    return (
      game.group.includes(class_name) ||
      (game.class && game.class.includes(class_name))
    );
  });

  if (games.length > 0) {
    for (let game of games) {
      let records = await getGameStats(game.UniqueID, _season);
      records = records.filter((x) => x.team.includes(club));
      /*      console.log(
        _season,
        class_name,
        games.length,
        'tilastoja',
        records.length
      );*/
      for (let record of records) {
        await addStat(record, game.UniqueID);
      }
    }

    //console.log('game parsed done');
    players.map((x) => {
      x.total = x.goals + x.assists;
    });
    players.sort((a, b) => {
      return a.total > b.total ? -1 : 1;
    });
    if (players.length === 0)
      console.log('No stats for %s %s', _season, class_name);
    fs.writeFileSync(
      basepath +
        'stats/' +
        _season +
        '-' +
        class_name.replace(/[\s.]/g, '_') +
        '-stats.json',
      JSON.stringify(players)
    );
    return players;
  } else {
    console.log('No games for %s season %s', class_name, _season);
  }
}

async function runScript() {
  let seasons = fs
    .readdirSync(basepath)
    .filter((file) => file.includes('Nibacos_games'));

  for (let seasonfile of seasons) {
    let classes = [];
    let season = JSON.parse(fs.readFileSync(basepath + seasonfile));
    classes = season.map((season) => {
      if ( season.class !== undefined) return season.class;
    });

    classes = classes.filter(  (value, index, self) => {
       //console.log(value, self.indexOf(value) === index || value == undefined);
       if (value == undefined) 
        return false;
       else 
         return self.indexOf(value) === index;
    });

    //console.log("filt", classes);
    for (let _class of classes) {
      //console.log(_class, seasonfile);
      _class = _class.replace(/\n/g, '');
      let _seasonstring = seasonfile.split('-')[0];

      await getStats(_seasonstring, 'Nibacos', _class);
    }
  }
  //let players = await getStats('2020', 'Nibacos', 'Miesten 2-divisioona');
  //await getStats( '2020', '27' );
  /*for (let _player of players)
    console.log(
      _player.name,
      _player.goals,
      _player.assists,
      _player.penalties,
      _player.total
    );*/
}

module.exports = {
  generate: getStats,
};

if (module.parent === null) {
  runScript();
}

//runScript();
