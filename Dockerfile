FROM node:alpine

WORKDIR /needu-api
COPY . .
RUN npm install
CMD node index.js