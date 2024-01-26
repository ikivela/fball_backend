module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps: [
    // Main API Hosting
    {
      name: 'fball_api',
      script: 'npm run backend',
      env: {
        PORT: 8882,
        COMMON_VARIABLE: 'true',
      },
      instances: 1,
      watch: false,
      autorestart: true,
    },
    {
      name: 'fball_fetch_games_job',
      script: 'node src/torneopal_fetch_games.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 3 * * *',
      watch: false,
      autorestart: false,
    },
    {
      name: 'fball_todays_games',
      script: 'node src/torneopal_fetch_results.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '30 21 * * *',
      watch: false,
      autorestart: false,
    },
    {
      name: 'fball_generateStandings_job',
      script: 'node src/torneopal_generate_standings.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '45 21 * * *',
      watch: false,
      autorestart: false,
    },
     {
      name: 'fball_updateStats_job',
      script: 'npm run updateStats',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 22 * * *',
      watch: false,
      autorestart: false,
    },
  ],
};
