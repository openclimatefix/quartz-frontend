FROM --platform=linux/arm64 adamgoldman/cypress-m1
VOLUME ["/app/cypress"]
WORKDIR /app
RUN yarn add cypress-plugin-snapshots
RUN yarn add cypress@10.3.0
RUN sudo dbus-daemon --system &> /dev/null
ENV BASE_URL="http://host.docker.internal:3002"
entrypoint ["yarn", "run" ,"cypress"]