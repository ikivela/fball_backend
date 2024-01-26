const mysql = require('mysql2');
const { ApolloServer, gql } = require('apollo-server');
const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');
const { DateTime } = require('luxon');
require('dotenv').config()


const connection = mysql.createConnection({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect();

const typeDefs = gql`
  scalar JSON

  type Game {
    UniqueID: Int!
    TitleID: Int
    TitleOrder: Int
    Title: String
    GameDate: String
    GameTime: String
    HomeTeamID: Int
    AwayTeamID: Int
    RinkID: Int
    SubRink: String
    HomeTeamName: String
    AwayTeamName: String
    RinkName: String
    Result: String
    FinishedType: Int
    GameStatus: Int
    GameEffTime: Int
    ReportLink: Int
    Statistics: Int
    GroupID: Int
    group: String
    class: String
    events: JSON
    rosters: JSON
  }

  type Query {
    games(year: Int): [Game]
    game(id: Int!, year: Int): Game
    rosters(id: Int!, year: Int!): JSON
  }
`;

const JSONResolver = new GraphQLScalarType({
  name: 'JSON',
  description: 'Custom JSON scalar type',
  parseValue(value) {
    return value;
  },
  serialize(value) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});

const resolvers = {
  JSON: JSONResolver, 
  Query: {
    games: async (_, {year}) => {
      // Hae kaikki pelit tietokannasta, jos year tyhjä, hae edellinen vuosi
      year = year || DateTime.now.year()-1; 
      const query = `SELECT * FROM ${year}_games`;
      const games = await queryDatabase(query);
      return games;
    },
    game: async (_, { id, year }) => {
      year = year || DateTime.now.year()-1; 
      // Hae yksi peli tietokannasta annetulla ID:llä
      const query = `SELECT * FROM ${year}_games WHERE UniqueID = ${id}`;
      const [game] = await queryDatabase(query);
      return game;
    },
    rosters: async(_, { id, year}) => {
      const query = `SELECT JSON_UNQUOTE(rosters) as rosters FROM ${year}_games WHERE UniqueID = ${id}`;
      const [rosters] = await queryDatabase(query);
      const json_rosters = JSON.parse(rosters.rosters);
      console.log(json_rosters);
      return json_rosters ? json_rosters : null;
    }
  },
};




const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`GraphQL server is running at ${url}`);
});

async function queryDatabase(query) {
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

