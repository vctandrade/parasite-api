FROM node:10-alpine

COPY app app
WORKDIR app
RUN npm install

ENTRYPOINT ["npm", "start", "--"]
