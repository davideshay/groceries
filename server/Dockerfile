FROM node:bullseye-slim as builder

WORKDIR /usr/app

COPY server/package.json server/package-lock.json /usr/app/

RUN NODE_ENV=production npm ci

COPY server/. ./

RUN ls -lat

RUN npm run build

FROM node:bullseye-slim

WORKDIR /usr/app
COPY --from=builder /usr/app/dist ./dist
COPY server/package*.json server/package-lock.json ./

RUN npm install --only=production

CMD node dist/index.js

EXPOSE 80

