
var fs = require('fs');
var path = require('path');
var datapath = path.join(path.resolve(__dirname), '../data/');

function torneoPalEvents(data) {

  let events = [];
  //console.log(data);
  let clubs = {};
  clubs[data.match.team_A_id] = data.match.team_A_name;
  clubs[data.match.team_B_id] = data.match.team_B_name;

  for(let goal of data.match.goals) {
    let event = { event: "goal", time: goal.time, result: goal.score_A+"-"+goal.score_B, yv_av: goal.description, team: clubs[goal.team_id], scorer: goal.player_name, assist: "" }; 
    let assist = data.match.events.filter( x => x.code == "syotto" && x.time == goal.time);
    if (assist ) {
      if (Array.isArray(assist))
        assist = assist[assist.length-1];
      event.assist = assist.player_name;
    }
    events.push(event); 
    //console.log(goal.time, goal.player_name);
  }

  //stat = { event: "", time: "", result: "", yv_av: "", team: "", scorer: "", assist: ""};
  console.log(events);
  return events;
}


(async () => { 
  let data = await fs.readFileSync(datapath+'/gamestats/2024-gamestats-722583.json');
  data = JSON.parse(data);
  torneoPalEvents(data);
})();

