FROM node:bookworm-slim as builder

WORKDIR /usr/app

COPY client/package.json client/package-lock.json /usr/app/

RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential

RUN NODE_ENV=production npm ci --include=dev

COPY client/. ./

RUN npm run build

FROM nginx:bookworm
COPY --from=builder /usr/app/build /usr/share/nginx/html

# RUN apk add bash

WORKDIR /usr/share/nginx/html

COPY client/bin/updateenv.sh  . 

COPY client/env-template ./.env

RUN chmod +x /usr/share/nginx/html/updateenv.sh

ENV LANDSCAPE=PRODUCTION

CMD ["/usr/bin/bash","-c","/usr/share/nginx/html/updateenv.sh && nginx -g \"daemon off;\""]

EXPOSE 80

