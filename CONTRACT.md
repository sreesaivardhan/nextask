# NexTask – API Contract

> Authoritative reference for all REST endpoints and Socket.io events.
> No implementation detail — contracts only.

---

## REST Endpoints

All REST endpoints are prefixed with `/api`.

---

### Health

| Method | Path      | Description              |
|--------|-----------|--------------------------|
| GET    | `/health` | Server health check      |

---

### Session

| Method | Path            | Description                                        |
|--------|-----------------|----------------------------------------------------|
| POST   | `/api/session`  | Create a display-name session and set httpOnly cookie |
| GET    | `/api/session`  | Return the current session user                    |
| DELETE | `/api/session`  | Destroy session and clear cookie                   |

---

### Board

| Method | Path                    | Description                       |
|--------|-------------------------|-----------------------------------|
| GET    | `/api/boards`           | List boards for current user      |
| POST   | `/api/boards`           | Create a new board                |
| GET    | `/api/boards/:boardId`  | Get board details with columns    |
| PATCH  | `/api/boards/:boardId`  | Update board fields               |
| DELETE | `/api/boards/:boardId`  | Delete board and all contents     |

---

### Column

| Method | Path                                       | Description                  |
|--------|--------------------------------------------|------------------------------|
| POST   | `/api/boards/:boardId/columns`             | Create a column on a board   |
| PATCH  | `/api/boards/:boardId/columns/:columnId`   | Update column name/position  |
| DELETE | `/api/boards/:boardId/columns/:columnId`   | Delete column and its cards  |

---

### Card

| Method | Path                                                      | Description                 |
|--------|-----------------------------------------------------------|-----------------------------|
| POST   | `/api/boards/:boardId/columns/:columnId/cards`            | Create a card in a column   |
| GET    | `/api/cards/:cardId`                                      | Get card detail             |
| PATCH  | `/api/cards/:cardId`                                      | Update card fields          |
| DELETE | `/api/cards/:cardId`                                      | Delete card                 |
| PATCH  | `/api/cards/:cardId/move`                                 | Move card to another column |

---

### Comment

| Method | Path                              | Description                 |
|--------|-----------------------------------|-----------------------------|
| GET    | `/api/cards/:cardId/comments`     | List comments on a card     |
| POST   | `/api/cards/:cardId/comments`     | Add a comment to a card     |
| PATCH  | `/api/comments/:commentId`        | Edit a comment              |
| DELETE | `/api/comments/:commentId`        | Delete a comment            |

---

### GitHub

| Method | Path                     | Description                            |
|--------|--------------------------|----------------------------------------|
| GET    | `/api/github/issues`     | Preview GitHub issues for import       |
| POST   | `/api/github/import`     | Import selected GitHub issues as cards |

---

### AI

| Method | Path                          | Description                            |
|--------|-------------------------------|----------------------------------------|
| POST   | `/api/ai/bottleneck`          | Identify column bottlenecks on a board |
| POST   | `/api/ai/sprint-risk`         | Assess sprint risk for a board         |
| GET    | `/api/ai/digest/:boardId`     | Get daily AI digest for a board        |

---

## Socket.io Events

All events operate on active socket connections.

---

### `board:join`

| Field       | Value                      |
|-------------|----------------------------|
| Direction   | Client → Server            |
| Payload     | `{ boardId: string }`      |
| Description | Join a board room to receive real-time events for that board |

---

### `board:leave`

| Field       | Value                      |
|-------------|----------------------------|
| Direction   | Client → Server            |
| Payload     | `{ boardId: string }`      |
| Description | Leave a board room and stop receiving its events |

---

### `card:create`

| Field       | Value                                                          |
|-------------|----------------------------------------------------------------|
| Direction   | Server → Room                                                  |
| Payload     | `{ boardId: string; columnId: string; card: CardPayload }`     |
| Description | Broadcast when a new card is created in a board room |

---

### `card:update`

| Field       | Value                                                                  |
|-------------|------------------------------------------------------------------------|
| Direction   | Server → Room                                                          |
| Payload     | `{ boardId: string; cardId: string; changes: Partial<CardPayload> }`   |
| Description | Broadcast when a card's fields are updated |

---

### `card:typing`

| Field       | Value                                                                       |
|-------------|-----------------------------------------------------------------------------|
| Direction   | Client → Server → Room                                                      |
| Payload     | `{ boardId: string; cardId: string; userId: string; isTyping: boolean }`    |
| Description | Relay typing indicator for collaborative card editing |

---

### `card:move`

| Field       | Value                                                                                              |
|-------------|---------------------------------------------------------------------------------------------------|
| Direction   | Server → Room                                                                                     |
| Payload     | `{ boardId: string; cardId: string; fromColumnId: string; toColumnId: string; newPosition: number }` |
| Description | Broadcast when a card is moved to a different column or position |

---

### `card:delete`

| Field       | Value                                          |
|-------------|------------------------------------------------|
| Direction   | Server → Room                                  |
| Payload     | `{ boardId: string; cardId: string }`          |
| Description | Broadcast when a card is deleted |

---

### `comment:create`

| Field       | Value                                                          |
|-------------|----------------------------------------------------------------|
| Direction   | Server → Room                                                  |
| Payload     | `{ boardId: string; cardId: string; comment: CommentPayload }` |
| Description | Broadcast when a new comment is added to a card |

---

### `activity:create`

| Field       | Value                                                     |
|-------------|-----------------------------------------------------------|
| Direction   | Server → Room                                             |
| Payload     | `{ boardId: string; activity: ActivityPayload }`          |
| Description | Broadcast when a new activity log entry is created |

---

### `ai:bottleneck`

| Field       | Value                                              |
|-------------|---------------------------------------------------|
| Direction   | Server → Room                                     |
| Payload     | `{ boardId: string; insight: AIInsightPayload }`  |
| Description | Push AI bottleneck analysis result to board members |

---

### `ai:sprint_risk`

| Field       | Value                                              |
|-------------|---------------------------------------------------|
| Direction   | Server → Room                                     |
| Payload     | `{ boardId: string; insight: AIInsightPayload }`  |
| Description | Push AI sprint risk assessment to board members |

---

### `ai:digest`

| Field       | Value                                     |
|-------------|-------------------------------------------|
| Direction   | Server → Room                             |
| Payload     | `{ boardId: string; digest: string }`     |
| Description | Push daily AI digest summary to board members |

---

### `github:preview`

| Field       | Value                                  |
|-------------|----------------------------------------|
| Direction   | Server → Client                        |
| Payload     | `{ issues: GitHubIssuePayload[] }`     |
| Description | Return GitHub issue preview results to requesting client |

---

### `github:import`

| Field       | Value                                            |
|-------------|--------------------------------------------------|
| Direction   | Server → Room                                    |
| Payload     | `{ boardId: string; cards: CardPayload[] }`      |
| Description | Broadcast newly imported GitHub cards to board members |

---

## Payload Types Reference

```typescript
interface CardPayload {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  complexity: number | null;
  version: number;
  lastEditedByUserId: string | null;
  githubRepo: string | null;
  githubIssueNumber: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface CommentPayload {
  id: string;
  cardId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityPayload {
  id: string;
  boardId: string;
  userId: string | null;
  type: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AIInsightPayload {
  id: string;
  boardId: string;
  type: 'BOTTLENECK' | 'SPRINT_RISK' | 'DIGEST';
  payload: Record<string, unknown>;
  createdAt: string;
}

interface GitHubIssuePayload {
  id: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  labels: string[];
}
```
