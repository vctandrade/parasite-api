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
| **Request** | playerID | string | unique identification for the player |

### createRoom
Creates a new game room with the given roster.

| | Object | Type | Description |
| --- | --- | --- | --- |
| **Request** | roster | string array | jobs allowed in the game |
| **Response** | roomID | string | unique identification for the room |

### joinRoom
Adds the player to an existing room.

| | Object | Type | Description |
| --- | --- | --- | --- |
| **Request** | roomID | string | unique identification for the room |
| **Response** | roster | string array | jobs allowed in the game |

### leaveRoom
Removes the player from the room they are currently in.

## Push Topics
### state
Gives an update on the room state.

| Object | Type | Description |
| --- | --- | --- |
| roomID | string | unique identification for the room |
| players | string array | players in the game |