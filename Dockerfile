FROM mhart/alpine-node:16.4.2

ENV APP_DIR /app/

# Install pre-requisites

# Add app source
WORKDIR $APP_DIR
ADD . $APP_DIR

# Install dependencies
RUN npm install --production

EXPOSE 3000

# run application
CMD [ "npx", "pm2-runtime", "ecosystem.config.js" ]
