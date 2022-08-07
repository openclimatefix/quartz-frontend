FROM cypress/included:10.3.0
VOLUME ["/app/cypress"]
WORKDIR /app
RUN yarn add cypress-plugin-snapshots
ENV BASE_URL="http://host.docker.internal:3002"