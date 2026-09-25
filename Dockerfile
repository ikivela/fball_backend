FROM node:22-slim

ENV APP_DIR /app/

# Install pre-requisites

# Add app source
WORKDIR $APP_DIR
ADD . $APP_DIR

# Install dependencies
RUN npm ci --omit=dev

EXPOSE 3000

# run application
CMD [ "npx", "pm2-runtime", "ecosystem.config.js" ]
