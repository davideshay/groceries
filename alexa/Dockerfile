FROM node:bullseye-slim as builder

WORKDIR /usr/app/alexa

COPY alexa/. /usr/app/alexa
COPY client/src/components /usr/app/client/src/components

#COPY server/package.json server/package-lock.json server/tsconfig.json /usr/app/

RUN npm install

RUN ls -lat

RUN npm run build

FROM node:bullseye-slim

WORKDIR /usr/app
COPY --from=builder /usr/app/alexa/dist ./dist
COPY --from=builder /usr/app/alexa/data ./data
COPY --from=builder /usr/app/alexa/views ./views
COPY alexa/package*.json alexa/package-lock.json ./

RUN ls -laRt

RUN NODE_ENV=production npm install --omit=dev

CMD node dist/index.js

EXPOSE 3000
