var fs = require('fs');
const path = require('path');

var basepath = path.join(path.resolve(__dirname), '../data/rosters/');
var playerspath = path.join(path.resolve(__dirname), '../data/');
var rosters = fs.readdirSync(basepath);
var players = {};
var playerList = "";

/*
 {
    GameDate: '2018-12-16',
    StatName: 'TD-61 PM',
    TeamName: 'Nibacos Valkoinen',
    PlayerUniqueID: '40452676',
    PlayerLastName: 'THYLIN',
    PlayerFirstName: 'Annika',
    PlayerDob: '2008',
    GameRosterUniqueID: '505680',
    RoleID: '11',
    RoleAbbrv: 'OP',
    PlayerLine: '1',
    PlayerJerseyNr: '81',
    Captain: '',
    Height: '0',
    Weight: '0'
  }
*/


async function ListPlayers(_files) {
  console.log("files length", _files.length);
  //_files = _files.slice(0, 10);
  for (let file of _files) {

    playerList = await fs.readFileSync(basepath + file, 'utf-8');
    playerList = JSON.parse(playerList);
    for (let player of playerList) {
      var newPlayer = {
        PlayerUniqueID: player.PlayerUniqueID,
        PlayerFirstName: player.PlayerFirstName,
        PlayerLastName: player.PlayerLastName,
        PlayerDob: player.PlayerDob

      }
      //console.log(newPlayer.PlayerUniqueID, newPlayer.PlayerFirstName, newPlayer.PlayerLastName);
      // stringify id
      //let id = JSON.stringify(newPlayer.PlayerUniqueID);
      if (players[newPlayer.PlayerUniqueID] == undefined) {
        players[newPlayer.PlayerUniqueID] = {
          ...newPlayer
        }
      }

    }
  }

  console.log("Player count", Object.keys(players).length);

  fs.writeFileSync(playerspath + "players.json", JSON.stringify(players), 'utf8');
}

ListPlayers(rosters);