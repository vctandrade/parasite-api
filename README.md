# Parasite: the Game
[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

## Instructions
This project is configured for Docker Swarm, so make sure you have it up and running.

```console
$ docker build -t parasite api .
$ docker stack deploy --compose-file=docker-compose.yml parasite-api
```
