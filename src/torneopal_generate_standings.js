var axios = require('axios');
var fs = require('fs');
const { DateTime } = require('luxon');
require('dotenv').config();
const mysql = require('mysql2/promise');
require('dotenv').config();

// Ympäristömuuttujat ja apumuuttujat
const base_url = 'https://salibandy.api.torneopal.com/taso/rest/';
const token = process.env.token;
const season = process.env.season || '2025-2026';
const basepath = './data/';

function validateYear(year) {
  return /^\d{4}$/.test(year) ? year : null;
}


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function fetchCategories() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT DISTINCT category_id, competition_id, competition_name FROM 2026_games'
    );
    connection.release();
    const uniqueSet = new Set();
    return rows.filter(obj => {
      const key = obj.category_id + obj.competition_name;
      if (!obj.category_id || !obj.competition_name) return false;
      if (!uniqueSet.has(key)) {
        uniqueSet.add(key);
        return true;
      }
      return false;
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}


// add timestamps in front of log messages

// Generate HTML standings files from DB data
async function generateHTMLStandings() {
  try {
    console.log("Generating HTML standings...", season.split('-').pop());
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM standings WHERE season = ?', [season.split('-').pop()]);
    console.log(`Fetched ${rows.length} standings from database.`);
    return;
    for (const row of rows) {
      if (!row.data.groups.length < 0) {
        console.error(`No groups in standings for ${row.category_name}`);
        continue;
      }
      let htmltable = '';
      for (const group of row.data.groups) {
        const name = `<h4>${row.category_name} ${group.group_name}</h4>\n<table><tr>
      <th>Joukkue</th>
      <th>O</th>
      <th>V</th>
      <th>JV</th>
      <th>JH</th>
      <th>H</th>
      <th>M</th>
      <th>ME</th>
      <th>P</th>
      <th>P/O</th>
  </tr>\n`;
        const standings = group.teams
          .map(item => `
            <tr>
                <td>${item.team_name}</td>
                <td>${item.matches_played}</td>
                <td>${item.matches_won || ""}</td>
                <td>${item.matches_tiedwon || ""}</td>
                <td>${item.matches_tied || ""}</td>
                <td>${item.matches_lost || ""}</td>
                <td>${item.goals_for || ""}-${item.goals_against || ""}</td>
                <td>${item.goals_diff || ""}</td>
                <td>${item.points || ""}</td>
                <td>${item.points_per_match ? parseFloat(item.points_per_match).toFixed(1) : ""}</td>
            </tr>
        `)
          .join('\n');
        htmltable += `${name}${standings}</table>`;
      }
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${row.category_name} salibandy</title>
    <style>
        table {
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid black;
            padding: 0.5em;
            text-align: left;
        }
    </style>
</head>
<body>
  ${htmltable}
</body>
</html>`;
      const filename = `${row.category_name.replace(' ', '_')}`;
      await fs.writeFileSync(
        `${basepath}/files/${filename}.html`,
        htmlContent
      );
      console.log(`HTML table for ${row.category_name} saved as ${filename}.html`);
    }
  } catch (error) {
    console.error('Error generating HTML standings:', error);
  }
}

// Fetch standings from API and save to DB (no file write)
async function fetchAndStoreStandings(category) {
  try {
    let url = `${base_url}/getCategory?competition_id=${category.competition_id}&category_id=${category.category_id}&api_key=${token}`;
    const response = await axios.get(url);
   
    if (response.data.call.status == 'error') {
      console.error(category.name, url);
      console.error(response.data.call.error);
      return;
    }
    let seasonYear = season.split('-').pop();
    if (!validateYear(seasonYear)) {
      console.error(`Invalid year for table name: ${seasonYear}`);
      process.exit(1);
    }
    const connection = await pool.getConnection();
    const category_name = response.data.category.category_name;
    const category_id = response.data.category.category_id;
    const competition_name = response.data.category.competition_name;
    await connection.query(
      `INSERT INTO standings (season, category_id, category_name, competition_name, data)
   VALUES (?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE
     category_name = VALUES(category_name),
     season = VALUES(season),
     data = VALUES(data)`,
      [seasonYear, category_id, category_name, competition_name, JSON.stringify({ groups: response.data.category.groups })]
    );

    connection.release();
  } catch (e) {
    console.error(e);
  }
}

// Main orchestrator
async function main() {

  // let url = `${base_url}/getCategory?competition_id=sb2025&category_id=505&api_key=${token}`;
  // const response = await axios.get(url);
  // fs.writeFileSync(`tmp.json`, JSON.stringify(response.data));
  // console.log("File saved:", `tmp.json`);  
  // return; 

  const categories = await fetchCategories();
  if (categories.length === 0) {
    console.error('No categories found, exiting.');
    process.exit(1);
  }
  if (categories.length > 0) {
    for (const cat of categories) {
       await fetchAndStoreStandings(cat);
    }
  }
  await generateHTMLStandings();

  await pool.end();
}


main();
