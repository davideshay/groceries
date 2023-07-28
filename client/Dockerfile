FROM node:alpine as builder

WORKDIR /usr/app

COPY client/package.json client/package-lock.json /usr/app/

RUN NODE_ENV=production npm ci --include=dev --verbose

COPY client/. ./

RUN ls -lat

RUN npm run build --verbose

FROM nginx:alpine
COPY --from=builder /usr/app/build /usr/share/nginx/html

RUN apk add bash

WORKDIR /usr/share/nginx/html

COPY client/bin/updateenv.sh  . 

COPY client/env-template ./.env

RUN chmod +x /usr/share/nginx/html/updateenv.sh

ENV LANDSCAPE=PRODUCTION

CMD ["/bin/ash","-c","/usr/share/nginx/html/updateenv.sh && nginx -g \"daemon off;\""]

EXPOSE 80

