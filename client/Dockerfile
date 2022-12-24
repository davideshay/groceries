FROM node:alpine as builder

WORKDIR /usr/app

COPY client/package.json client/package-lock.json /usr/app/

RUN NODE_ENV=production npm ci --include=dev

COPY client/. ./

RUN ls -lat

RUN npm run build

FROM nginx:alpine
COPY --from=builder /usr/app/build /usr/share/nginx/html

RUN apk add bash

COPY client/bin/updateenv.sh  /usr/share/nginx/html/updateenv.sh

RUN chmod +x /usr/share/nginx/html/updateenv.sh

ENV LANDSCAPE=PRODUCTION

CMD ["/bin/ash","-c","/usr/share/nginx/html/updateenv.sh && nginx -g \"daemon off;\""]

EXPOSE 80

