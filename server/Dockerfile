FROM node:bullseye-slim as builder

WORKDIR /usr/app

COPY server/package.json server/package-lock.json /usr/app/

RUN NODE_ENV=production npm ci --include=dev

COPY server/. ./

RUN ls -lat

FROM node:bullseye-slim

WORKDIR /usr/app
COPY server/package*.json ./
RUN npm install --only=production
COPY --from=builder /usr/app/. .
CMD node dist/index.js

EXPOSE 80

