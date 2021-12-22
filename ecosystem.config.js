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
        COMMON_VARIABLE: 'true',
      },
      instances: 1,
      watch: false,
      autorestart: true,
    },
    {
      name: 'fball_fetch_games_job',
      script: 'node src/FetchGamesByTeam.js 2021 false',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 3 * * *',
      watch: false,
      autorestart: false,
    },
  ],
};
