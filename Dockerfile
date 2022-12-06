FROM node:alpine as builder

WORKDIR /usr/app

COPY package.json package-lock.json /usr/app/

RUN NODE_ENV=production npm ci --include=dev

COPY * /usr/app/

RUN npm run build

FROM nginx:alpine
COPY --from=builder /usr/app/build /usr/share/nginx/html

ENV LANDSCAPE=PRODUCTION

EXPOSE 80

