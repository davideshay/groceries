FROM node:bullseye-slim as builder

WORKDIR /usr/app/server

COPY server/. /usr/app/server
COPY client/src/components /usr/app/client/src/components

#COPY server/package.json server/package-lock.json server/tsconfig.json /usr/app/

RUN npm install

RUN ls -lat

RUN npm run build

FROM node:bullseye-slim

WORKDIR /usr/app
COPY --from=builder /usr/app/server/dist ./dist
COPY server/package*.json server/package-lock.json ./

RUN NODE_ENV=production npm install --only=production

CMD node dist/index.js

EXPOSE 80

