var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');
require('dotenv').config()

// add timestamps in front of log messages
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
var token = process.env.token || "your_token";
var season = '2023-2024';
var club_id = process.env.club_id || "your_club_id";


var basepath = './data/';
var seasons = require('../data/config/seasons');
var active_groups = require('../data/config/active_groups');
let currentTeam_games = [];


var getGames = async function (param) {

	try {

		let response = await axios.get(`${base_url}/getMatches?club_id=${club_id}&start_date=2023-08-01&end_date=2024-05-01&api_key=${token}`);
    games = response.data;
	} catch (e) {
		console.log(base_url);
		console.error(e);
		games = [];
	}

	return games;
};

async function doFetch() {
	var games = await getGames();
	/*games = games.matches.map((match) => {
		return {
			GameDate: match.date,
			GameTime: match.time,
			UniqueID: match.match_id,
			HomeTeamName: match.team_A_description_en,
			AwayTeamName: match.team_B_description_en,
			Result: `${match.fs_A}-${match.fs_B}`,
			Game: `${match.team_A_description_en}-${match.team_B_description_en}`,
			group: match.group_name,
			groupID: match.category_abbrevation,
			class: match.category_name,
			RinkName: match.venue_name,
		};
	});*/
 	  await fs.writeFileSync(`${basepath}./2024-Nibacos_games.json`, JSON.stringify(games));
}

doFetch();

