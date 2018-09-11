FROM node:10-alpine

COPY app app
WORKDIR app
RUN npm install

EXPOSE 80
ENTRYPOINT ["npm", "start", "--"]
