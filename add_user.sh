#!/bin/bash
# Lisää käyttäjä tai vaihda olemassa olevan käyttäjän salasana suoraan tietokantaan.
# Tietokantayhteys luetaan .env-tiedostosta (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
# Salasanan vaihto mitätöi käyttäjän nykyisen tokenin, joten käyttäjän pitää kirjautua uudelleen.

cd "$(dirname "$0")" || exit 1

# Anna käyttäjänimi
read -p "Anna käyttäjänimi: " USERNAME

# Kysy salasana
read -sp "Anna salasana: " PASSWORD
echo

read -sp "Anna salasana uudestaan: " PASSWORD_CONFIRM
echo

# tarkista että salasanat täsmää
if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
  echo "Salasanat eivät täsmää!"
  exit 1
fi

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Käyttäjänimi ja salasana vaaditaan!"
  exit 1
fi

# Tunnukset välitetään ympäristömuuttujina, jotta ne eivät näy prosessilistassa
NEW_USERNAME="$USERNAME" NEW_PASSWORD="$PASSWORD" node -e '
require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const username = process.env.NEW_USERNAME;
    const hash = await bcrypt.hash(process.env.NEW_PASSWORD, 12);
    // Tuntematon tiiviste: vanha token lakkaa toimimasta, uusi saadaan /login-reitiltä
    const lockedToken = crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
    const [rows] = await conn.query("SELECT username FROM users WHERE username = ?", [username]);
    if (rows.length > 0) {
      await conn.query("UPDATE users SET password = ?, token = ? WHERE username = ?", [hash, lockedToken, username]);
      console.log("Käyttäjän " + username + " salasana vaihdettu.");
    } else {
      await conn.query("INSERT INTO users (username, password, token, valid_login) VALUES (?, ?, ?, NOW())", [username, hash, lockedToken]);
      console.log("Käyttäjä " + username + " lisätty.");
    }
    const [all] = await conn.query("SELECT username FROM users");
    if (all.length > 1) {
      console.log("Huom: kannassa on " + all.length + " käyttäjää: " + all.map(u => u.username).join(", "));
    }
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error("Virhe:", err.message);
  process.exit(1);
});
'
