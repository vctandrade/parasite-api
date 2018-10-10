# API
### Request
```json
{
  "id": "<integer>",
  "route": "<string>",
  "args": {
    "route-specific-arg-1": "<object>",
    "route-specific-arg-2": "<object>"
  }
}
```

### Response
```json
{
  "id": "<integer>",
  "body": {
    "data": "<object>",
    "error": {
      "code": "<integer>",
      "message": "<string>"
    }
  }
}
```

### Push
```json
{
  "id": null,
  "body": {
    "topic": "<string>",
    "data": "<object>"
  }
}
```

## Routes
### info
Exposes useful information about the server.

| | Object | Type | Description |
| --- | --- | --- | --- |
| **Response** | version | string | server version number |

### login
Authenticates the player, so they can perform account specific actions.

| | Object | Type | Description |
| --- | --- | --- | --- |
| **Request** | token | string | OAuth2 token provided by Google |

### logout
Leaves current game and signs out.

### createGame
Creates a new game with the given roster.

| | Object | Type | Description |
| --- | --- | --- | --- |
| **Request** | roster | string array | jobs allowed in the game |
| **Response** | gameID | string | unique identification for the game |

### joinGame
Adds the player to an existing game.

| | Object | Type | Description |
| --- | --- | --- | --- |
| **Request** | nickname <br/> gameID | string <br/> string | custom public user name <br/> unique identification for the game |
| **Response** | roster | string array | jobs allowed in the game |

### leaveGame
Removes the player from the game they are currently in.

## Push Topics
### state
Gives an update on the game state.

| Object | Type | Description |
| --- | --- | --- |
| players | string array | players in the game |
