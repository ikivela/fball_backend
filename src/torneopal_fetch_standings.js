import axios from 'axios';
import fs from 'fs';
import { DateTime } from 'luxon';
import dotenv from 'dotenv';
import consolestamp from 'console-stamp';
dotenv.config();

// add timestamps in front of log messages
consolestamp(console, 'yyyy-mm-dd HH:MM:ss');

var base_url = 'https://salibandy.api.torneopal.com/taso/rest/';

// Helper function to validate year/season (must be 4-digit year)
function validateYear(year) {
  return /^\d{4}$/.test(year) ? year : null;
}

// Validate and sanitize environment variables
function getEnvVar(name, fallback = null, validator = null) {
  let value = process.env[name];
  if (validator && value && !validator(value)) {
    console.error(`Invalid value for environment variable ${name}: ${value}`);
    process.exit(1);
  }
  return value || fallback;
}

// Remove default secrets for production safety
var token = getEnvVar('token', null);
if (!token) {
  console.error('API token is required. Set the token environment variable.');
  process.exit(1);
}
// Kausi .env:stä (esim. 2026-2027). Torneopalin kilpailutunnus on kauden alkuvuosi: sb2026.
var season = getEnvVar('season', null);
if (!season || !/^\d{4}-\d{4}$/.test(season)) {
  console.error('Set season in .env (e.g. season=2026-2027).');
  process.exit(1);
}
const competition_id = `sb${season.split('-')[0]}`;

// Testityökalu yhden lohkon sarjataulukon hakuun:
// node src/torneopal_fetch_standings.js <category_id> [group_id]
const category_id = process.argv[2];
const group_id = process.argv[3] || '1';
if (!/^\d+$/.test(category_id || '') || !/^\d+$/.test(group_id)) {
  console.error('Usage: node src/torneopal_fetch_standings.js <category_id> [group_id]');
  process.exit(1);
}

var getStandings = async function (cat_id, grp_id) {
  try {
    let response = await axios.get(`${base_url}getGroup?competition_id=${competition_id}&category_id=${cat_id}&group_id=${grp_id}&api_key=${token}`);
    return response.data;
  } catch (e) {
    console.error(e.message);
    return null;
  }
};

async function doFetch() {
  const standings = await getStandings(category_id, group_id);
  if (!standings || !standings.group) {
    console.error('No standings found:', standings && standings.call ? standings.call.error || standings.call.error_message : '');
    process.exit(1);
  }
  console.log(standings.group.group_name, standings.group.teams.length);
}

doFetch();

