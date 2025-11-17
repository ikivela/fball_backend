#!/bin/bash
# Syötä backend-API url
BACKEND_URL=${1:-"http://localhost:3000"}

#lue token .env tiedostosta
source .env
#admin token
TOKEN=$ADMIN_TOKEN

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


if [ -z "$TOKEN" ]; then
	echo "Login epäonnistui: $LOGIN_RESPONSE"
	exit 1
fi

# Lähetä POST /register API:lle Authorization-headerilla
RESPONSE=$(curl -s -X POST "$BACKEND_URL/register" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer $TOKEN" \
	-d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

# Tarkista onnistuiko
if echo "$RESPONSE" | grep -q 'User registered'; then
	echo "Käyttäjä lisätty API:n kautta!"
else
	echo "Virhe: $RESPONSE"
fi