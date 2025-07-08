const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config()

// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST,  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Function to initialize the "game" table in the database
async function initGameTable(_year) {

  const tablename = `${_year}_games`;
  const connection = await pool.getConnection();
  console.log("creating table", tablename);
  await connection.query(`DROP TABLE IF EXISTS ${tablename}`);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${tablename} (
        match_id VARCHAR(10) PRIMARY KEY,
    match_number INT,
    match_report TEXT,
    match_external_id VARCHAR(10),
    age_group VARCHAR(10),
    aggregate_match VARCHAR(255),
    competition_id VARCHAR(20),
    competition_name VARCHAR(255),
    competition_result_service_name VARCHAR(255),
    competition_logo TEXT,
    competition_area_name VARCHAR(255),
    competition_status VARCHAR(20),
    competition_officiality VARCHAR(20),
    season_id VARCHAR(20),
    organiser VARCHAR(50),
    organiser_private BOOLEAN,
    category_id VARCHAR(10),
    category_external_id VARCHAR(10),
    category_abbrevation VARCHAR(10),
    category_name VARCHAR(50),
    category_logo TEXT,
    category_logo_dark_bg TEXT,
    category_group VARCHAR(10),
    category_group_name VARCHAR(50),
    category_group_name_en VARCHAR(50),
    category_live BOOLEAN,
    calculate_points BOOLEAN,
    season_order INT,
    group_id VARCHAR(10),
    group_name VARCHAR(100),
    phase_number INT,
    phase_id VARCHAR(10),
    phase_name VARCHAR(255),
    group_type VARCHAR(50),
    match_type VARCHAR(20),
    round_id VARCHAR(10),
    round_name VARCHAR(50),
    round_date_begin DATE,
    round_date_end DATE,
    round_team_id VARCHAR(10),
    round_club_id VARCHAR(10),
    round_club_name VARCHAR(255),
    stage VARCHAR(50),
    stage_name VARCHAR(255),
    standings_name VARCHAR(255),
    date DATE,
    time TIME,
    reschedule BOOLEAN,
    time_reservation_start TIME,
    time_end TIME,
    time_zone VARCHAR(50),
    time_zone_offset VARCHAR(10),
    sunset TIME,
    club_A_id VARCHAR(10),
    club_A_name VARCHAR(100),
    club_A_abbrevation VARCHAR(50),
    club_A_www TEXT,
    club_A_crest TEXT,
    club_A_crest_dark_bg TEXT,
    team_A_id VARCHAR(10),
    team_A_name VARCHAR(100),
    team_A_abbrevation VARCHAR(50),
    team_A_description TEXT,
    team_A_description_en TEXT,
    team_A_www TEXT,
    club_A_distance VARCHAR(255),
    team_A_home_venue_id VARCHAR(10),
    team_A_primary_category_id VARCHAR(10),
    team_A_primary_category_abbrevation VARCHAR(10),
    club_B_id VARCHAR(10),
    club_B_name VARCHAR(100),
    club_B_abbrevation VARCHAR(50),
    club_B_www TEXT,
    club_B_distance VARCHAR(255),
    club_B_crest TEXT,
    club_B_crest_dark_bg TEXT,
    team_B_id VARCHAR(10),
    team_B_name VARCHAR(100),
    team_B_abbrevation VARCHAR(50),
    team_B_description TEXT,
    team_B_description_en TEXT,
    team_B_www TEXT,
    team_B_home_venue_id VARCHAR(10),
    team_B_primary_category_id VARCHAR(10),
    team_B_primary_category_abbrevation VARCHAR(10),
    statistics_level VARCHAR(50),
    shotmap VARCHAR(255),
    status VARCHAR(50),
    matchcard_status VARCHAR(50),
    forfeit_A BOOLEAN,
    forfeit_B BOOLEAN,
    disqualify_A BOOLEAN,
    disqualify_B BOOLEAN,
    winner VARCHAR(10),
    winner_id VARCHAR(10),
    final_position_win VARCHAR(50),
    final_position_lost VARCHAR(50),
    walkover BOOLEAN,
    fs_A INT,
    fs_B INT,
    hts_A INT,
    hts_B INT,
    ns_A INT,
    ns_B INT,
    es_A INT,
    es_B INT,
    ps_A INT,
    ps_B INT,
    suspensions_A TEXT,
    suspensions_B TEXT,
    suspensions_officials_A TEXT,
    suspensions_officials_B TEXT,
    best_of_match BOOLEAN,
    best_of_count INT,
    can_start_live BOOLEAN,
    lineups_filled BOOLEAN,
    best_of_sequence INT,
    track_scorers BOOLEAN,
    track_assists BOOLEAN,
    starting_players BOOLEAN,
    sport_id VARCHAR(50),
    match_report_exists BOOLEAN,
    p1_start_team VARCHAR(50),
    p1_start_time TIME,
    p1_end_time TIME,
    p1_duration TIME,
    p1s_A INT,
    p1s_B INT,
    p1_winner VARCHAR(50),
    p2_start_team VARCHAR(50),
    p2_start_time TIME,
    p2_end_time TIME,
    p2_duration TIME,
    p2s_A INT,
    p2s_B INT,
    p2_winner VARCHAR(50),
    p3_start_team VARCHAR(50),
    p3_start_time TIME,
    p3_end_time TIME,
    p3_duration TIME,
    p3s_A INT,
    p3s_B INT,
    p3_winner VARCHAR(50),
    p4_start_team VARCHAR(50),
    p4_start_time TIME,
    p4_end_time TIME,
    p4_duration TIME,
    p4s_A INT,
    p4s_B INT,
    p4_winner VARCHAR(50),
    p5_start_team VARCHAR(50),
    p5_start_time TIME,
    p5_end_time TIME,
    p5_duration TIME,
    p5s_A INT,
    p5s_B INT,
    p5_winner VARCHAR(50),
    position_name VARCHAR(50),
    players_aside INT,
    libero BOOLEAN,
    serve_order VARCHAR(50),
    players_substitutes INT,
    substitutions INT,
    max_fouls INT,
    max_timeouts INT,
    connected_matches TEXT,
    referee_instructions TEXT,
    odds DECIMAL(10,2),
    betting_url TEXT,
    referee_1_id VARCHAR(10),
    referee_1_name VARCHAR(50),
    referee_2_id VARCHAR(10),
    referee_2_name VARCHAR(50),
    assistant_referee_1_id VARCHAR(10),
    assistant_referee_1_name VARCHAR(50),
    assistant_referee_2_id VARCHAR(10),
    assistant_referee_2_name VARCHAR(50),
    venue_id VARCHAR(10),
    venue_name VARCHAR(100),
    venue_city_name VARCHAR(100),
    venue_city_id VARCHAR(10),
    venue_area_id VARCHAR(10),
    venue_size VARCHAR(50),
    required_venue_size VARCHAR(50),
    venue_referee_club_id VARCHAR(10),
    venue_area_name VARCHAR(50),
    venue_location_id VARCHAR(10),
    venue_location_name VARCHAR(100),
    venue_suburb_name VARCHAR(100),
    attendance INT,
    report_attendance VARCHAR(10),
    referee_classification VARCHAR(50),
    assistant_referee_classification VARCHAR(50),
    report_result BOOLEAN,
    playing_time_min INT,
    period_count INT,
    period_lengths_sec JSON,
    win_period_count INT,
    period_count_fixed BOOLEAN,
    period_min INT,
    extra_period_count INT,
    extra_period_min INT,
    ps_count INT,
    live_period INT,
    live_time TIME,
    live_time_mmss TIME,
    live_minutes INT,
    live_A INT,
    live_B INT,
    live_ps_A INT,
    live_ps_B INT,
    live_timeouts_A INT,
    live_timeouts_B INT,
    live_timeout_skip_A BOOLEAN,
    live_timeout_skip_B BOOLEAN,
    live_timer_start TIMESTAMP,
    live_timer_start_time TIME,
    live_timer_on BOOLEAN,
    temperature DECIMAL(5,2),
    weather VARCHAR(50),
    stream_url TEXT,
    stream_status VARCHAR(50),
    stats_level VARCHAR(50),
    ticket_url TEXT,
    stream VARCHAR(50),
    stream_media TEXT,
    stream_media_name TEXT,
    stream_img TEXT,
    tv VARCHAR(50),
    notice TEXT,
    result_notice TEXT,
    stamp VARCHAR(50),
    version_hash VARCHAR(50),
    timestamp TIMESTAMP
    )
  `);
}

// Function to process empty string values to null
function processEmptyToNull(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'string' && obj[key].trim() === '') {
      obj[key] = null;
    }
  }
}

// Function to insert data into the games table
async function insertDataIntoGames(year, data) {
  //const connection = await mysql.createConnection(connectionConfig);
  const connection = await pool.getConnection();
  const tablename = `${year}_games`;

  for (const gameData of data) {
    processEmptyToNull(gameData);
    const columns = Object.keys(gameData).map(key => `\`${key}\``).join(', ');
    let values = Object.values(gameData);
    var gamestatpath = `./data/gamestats/${year}-gamestats-${gameData.UniqueID}.json`;
    var rosterpath = `./data/rosters/${year}-roster-${gameData.UniqueID}.json`;
    let rosters = "[]";
    let eventsdata = "[]";
    if (fs.existsSync(rosterpath)) {
      rosters = fs.readFileSync(rosterpath).toString();
    }
    if (fs.existsSync(gamestatpath)) {
      eventsdata = fs.readFileSync(gamestatpath).toString();
    }
    values.push(eventsdata);
    values.push(rosters);

    try {
      const [results, fields] = await connection.execute(`
        INSERT INTO ${tablename} (${columns}, events, rosters)
        VALUES (${values.map(() => '?').join(', ')})
      `, values);

      console.log(`Inserted game with UniqueID ${gameData.UniqueID}`);
    } catch (error) {
      console.error(`Error inserting data for UniqueID ${gameData.UniqueID}:`, error);
    }
  }

  connection.release();
}


async function store() {
  // Read the JSON file and parse it into an array of objects
  // Create a MySQL connection pool
  let files = await fs.readdirSync('./data/').filter(x => x.includes('games.json') && x.includes('2024'));

  for (let file of files) {
    let year = file.substring(0, 4);
    await initGameTable(year);
    const jsonData = await fs.readFileSync(`./data/${file}`);
    const jsonArray = JSON.parse(jsonData);
    //await insertDataIntoGames(year, jsonArray);
  }

  //process.exit(0);
}


store().catch((error) => {
  console.error(error);
}).then(() => {
  console.log('All done');
  process.exit(0);
});
