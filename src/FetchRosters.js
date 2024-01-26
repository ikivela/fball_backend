var axios = require('axios');
var fs = require('fs');
const path = require('path');
var cheerio = require('cheerio');
const { DateTime } = require('luxon');
// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
var basepath = path.join(path.resolve(__dirname), '../data/');
const seasons = require('../data/config/seasons');
const fb_rosters_url = 'http://tilastopalvelu.fi/fb/modules/mod_gamerosters/helper/gamerosters.php?team=';

async function parseRoster(_data, _season, _gameid, _both) {
  if (_data.players.length > 0) {
    _gameid = _both ? `${_gameid}_2` : _gameid;
    let writepath = `${basepath}rosters/${_season}-roster-${_gameid}.json`;
    console.log(`writing roster: ${writepath}` );
    await fs.writeFileSync( writepath, JSON.stringify(_data.players), { encoding: "utf8"});
  } 
}
async function fetchRoster(_game,  _club, _season) {

  var url = fb_rosters_url;

  if (_season < '2023') {
    url = fb_rosters_url.replace(
      '/mod_gamerosters/',
      '/mod_gamerostershistory/'
    );
  } 

  var away = _game.AwayTeamName.includes(_club) ? 'away' : undefined;
  var home = _game.HomeTeamName.includes(_club) ? 'home': undefined;
  console.log(_game.HomeTeamName, _game.AwayTeamName, _game.Result, home, away);
  try {
    if (home) {
      url = `${url}home&game=${_game.UniqueID}`;
      url = _season < '2023' ? `${url}&season=${_season}`: url;  
      var homeroster = await axios.post( url );
      parseRoster(homeroster.data,  _season, _game.UniqueID, false);
    }

    if (away) {
      url = `${url}away&game=${_game.UniqueID}`;
      url = _season < '2023' ? `${url}&season=${_season}`: url; 
      console.log(url);
      var awayroster = await axios.post( url );
      parseRoster(awayroster.data, _season, _game.UniqueID, home ? true : false);
    }
  } catch (_error) {
    console.error(_error);
  }//console.log(homeroster);
}	

async function getRosters(_season, club, class_name) {
  // load games
  //console.log('getStats', _season, club, class_name);
  let all_games = JSON.parse(
    fs.readFileSync(basepath + _season + '-' + club + '_games.json')
  );
  games = all_games.filter((game) => {
    return (
      game.group.includes(class_name) ||
      (game.class && game.class.includes(class_name))
    );
  });
  var index = 0;
  if (games.length > 0) {
    for(let game of games) {
      console.log(`[${index++}/${games.length}]`, _season, class_name, game.UniqueID, game.HomeTeamName, game.AwayTeamName);
      await fetchRoster(game, club, _season);
    }

  } else {
    console.log('No rosters for %s season %s', class_name, _season);
  }
}

async function runScript() {
  let seasons = fs
    .readdirSync(basepath)
    .filter((file) => file.includes('Nibacos_games'));

  for (let seasonfile of seasons) {
   // let seasonfile = '2022-Nibacos_games.json';
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

    console.log("filt", classes);
    for (let _class of classes) {
      _class = _class.replace(/\n/g, '');
      let _seasonstring = seasonfile.split('-')[0];
      //console.log(_class, _seasonstring, seasonfile);
      await getRosters( _seasonstring, 'Nibacos', _class);
    }
  }
}

module.exports = {
  generate: getRosters,
};

if (module.parent === null) {
  runScript();
}



