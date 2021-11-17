const axios = require('axios');
var url = 'https://api.salibandy.fi/games?statGroupId=8588&season=2022';
async function sendData() {
  let response = await axios.get(url);
  console.log(response.data);
  if (response.data.games && response.data.games.length)
    console.log(response.data.games);
}

sendData();
