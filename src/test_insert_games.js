/**
 * Testiskripti insertDataIntoGames-funktiolle.
 * Testaa 4 skenaariota:
 *   1. Tuleva peli ilman tulosta → INSERT
 *   2. Mennyt peli tuloksella → INSERT
 *   3. Mennyt peli ilman tulosta (ei kannassa) → SKIP
 *   4. Mennyt peli ilman tulosta (jo kannassa) → DELETE
 *
 * Käyttö: node src/test_insert_games.js
 * Huom: käyttää oikeaa tietokantaa (.env), luo test-taulun "9999_games" ja poistaa sen lopuksi.
 */

import { insertDataIntoGames, initGameTable, pool } from './torneopal_fetch_games.js';

const TEST_YEAR = '9999';

function makeGame(overrides) {
  return {
    match_id: 'TEST001',
    category_id: '1',
    category_name: 'Test',
    competition_id: '1',
    competition_name: 'Test Cup',
    date: '2025-01-15',
    time: '18:00:00',
    fs_A: null,
    fs_B: null,
    ...overrides,
  };
}

async function cleanup() {
  const conn = await pool.getConnection();
  await conn.query(`DROP TABLE IF EXISTS \`${TEST_YEAR}_games\``);
  conn.release();
}

async function getRow(matchId) {
  const conn = await pool.getConnection();
  const [rows] = await conn.execute(
    `SELECT * FROM \`${TEST_YEAR}_games\` WHERE match_id = ?`, [matchId]
  );
  conn.release();
  return rows[0] || null;
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('Alustetaan testitaulu...');
  await cleanup();
  await initGameTable(TEST_YEAR);

  // Testi 1: Tuleva peli ilman tulosta → pitäisi lisätä
  console.log('\nTesti 1: Tuleva peli ilman tulosta → INSERT');
  const futureGame = makeGame({ match_id: 'T001', date: '2027-06-01', fs_A: null, fs_B: null });
  await insertDataIntoGames(TEST_YEAR, futureGame);
  assert(await getRow('T001') !== null, 'Tuleva peli lisättiin tietokantaan');

  // Testi 2: Mennyt peli tuloksella → pitäisi lisätä
  console.log('\nTesti 2: Mennyt peli tuloksella → INSERT');
  const pastGameWithResult = makeGame({ match_id: 'T002', date: '2025-01-10', fs_A: '3', fs_B: '2' });
  await insertDataIntoGames(TEST_YEAR, pastGameWithResult);
  assert(await getRow('T002') !== null, 'Mennyt peli tuloksella lisättiin');

  // Testi 3: Mennyt peli ilman tulosta, ei kannassa → SKIP
  console.log('\nTesti 3: Mennyt peli ilman tulosta, ei kannassa → SKIP');
  const pastGameNoResult = makeGame({ match_id: 'T003', date: '2025-01-10', fs_A: null, fs_B: null });
  await insertDataIntoGames(TEST_YEAR, pastGameNoResult);
  assert(await getRow('T003') === null, 'Mennyttä peliä ilman tulosta ei lisätty');

  // Testi 4: Mennyt peli ilman tulosta, JO kannassa → DELETE
  console.log('\nTesti 4: Mennyt peli ilman tulosta, jo kannassa → DELETE');
  // Lisätään ensin rivi suoraan kantaan
  const conn = await pool.getConnection();
  await conn.execute(
    `INSERT INTO \`${TEST_YEAR}_games\` (match_id, category_id, category_name, competition_id, competition_name, date, time, matchdata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['T004', '1', 'Test', '1', 'Test Cup', '2025-01-10', '18:00:00', '{}']
  );
  conn.release();
  assert(await getRow('T004') !== null, 'Rivi lisättiin kantaan manuaalisesti');

  const pastGameToDelete = makeGame({ match_id: 'T004', date: '2025-01-10', fs_A: null, fs_B: null });
  await insertDataIntoGames(TEST_YEAR, pastGameToDelete);
  assert(await getRow('T004') === null, 'Mennyt peli ilman tulosta poistettiin');

  // Yhteenveto
  console.log(`\n--- Tulokset: ${passed} passed, ${failed} failed ---`);

  await cleanup();
  console.log('Testitaulu siivottu.');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Testi kaatui:', err);
  cleanup().finally(() => process.exit(1));
});
