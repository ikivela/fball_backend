const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const token = process.env.token;

var games_url = 'https://api.salibandy.fi/games?statGroupId=8588&season=2022';

async function getPlayer(id) {

  let apiurl = `https://salibandy-api.torneopal.fi/taso/rest/getPlayer?player_id=${id}&api_key=${token}`;
  let response = await axios.get(apiurl);
  console.log(apiurl);
  if ( response.data) {
    let data = JSON.parse(response.data);
    console.log(data);
    //let player = data.
    //fs.writeFileSync('player.json', data, 'utf8');
  }
 
}

// example getPlayer(32588);

