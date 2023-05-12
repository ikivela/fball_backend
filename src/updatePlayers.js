var fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

var basepath = path.join(path.resolve(__dirname), '../data/');
var players = fs.readFileSync(basepath + "players.json", 'utf-8');
//var games = fs.readFileSync(basepath + "2023-Nibacos_games.json", 'utf-8');
let seasons = fs
  .readdirSync(basepath)
  .filter((file) => file.includes('Nibacos_games'));


players = JSON.parse(players);
//games = JSON.parse(games);
if (Object.keys(players).length === 0) process.exit(-1);

async function readGames() {
  seasons.forEach((_season, i, _arr) => {
    var year = _season.split('-')[0];
    var _current_season = fs.readFile(basepath + _season, 'utf-8');
    var _games = JSON.parse(_current_season);
    if (_games.length > 0) {
      _games.forEach((_game, n, _arr) => {
        var filepath = basepath + "rosters/" + year + "-roster-" + game.UniqueID + ".json";
        if (fs.existsSync(filepath)) {
          var roster = fs.readFile(filepath, 'utf-8');
          if (roster.length > 0)
            roster = JSON.parse(roster);
          var found = roster.find(x => x.PlayerUniqueID == player.PlayerUniqueID);
          if (found) {
            updatePlayer(player, game);
          }
        }
      });
    }
  });
}

//console.log("players length", players.length, "games length", games.length);
async function update() {
  let counter = 0;
  let total = Object.keys(players).length;

  for (let id of Object.keys(players)) {
    console.log("player %s [%d/%d]", id, ++counter, total);
    for (let season of seasons) {
      var year = season.split('-')[0];
      var current_season = fs.readFileSync(basepath + season, 'utf-8');
      var games = JSON.parse(current_season);
      //console.log("Current season", season, games.length);
      for (let game of games) {
        var filepath = basepath + "rosters/" + year + "-roster-" + game.UniqueID + ".json";

        if (fs.existsSync(filepath)) {
          var roster = fs.readFileSync(filepath, 'utf-8');
          if (roster.length > 0)
            roster = JSON.parse(roster);
          var found = roster.find(x => x.PlayerUniqueID == id);
          if (found) {
            updatePlayer(id, game);
          }
        }
      }
    }

  }
}
// updatePlayer function
function updatePlayer(id, _game) {
  // find the player from the players array
  var season = 0;
  var year = DateTime.fromFormat(_game.GameDate, 'yyyy-MM-dd').year;
  var month = DateTime.fromFormat(_game.GameDate, 'yyyy-MM-dd').month;
  season = month > 7 ? parseInt(year) + 1 : parseInt(year);
  // No playerHistory yet, add empty
  if (players[id] && players[id].PlayerHistory == undefined) {
    console.log("NEW ->", players[id].PlayerLastName);
    players[id].PlayerHistory = {};
    players[id].PlayerHistory[season] = [];
    players[id].totalGames = 0;
  } else {
    players[id].totalGames++
    if (!players[id].PlayerHistory[season])
      players[id].PlayerHistory[season] = [];
    players[id].PlayerHistory[season].push(_game.UniqueID);
  }
  //console.log(players);

}

if (module.parent === null) {
  update();
  //readGames();
  fs.writeFileSync(basepath + 'players.json', JSON.stringify(players), 'utf-8');
}
//ListPlayers(rosters);