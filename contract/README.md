# HTTP contract

`examples.json` lists request and response pairs for the calculator API. Both test suites run against it:

- `backend/internal/httpapi` sends every example through the real handler and checks the status, the required headers and the body.
- `frontend/src/api/client.test.ts` replays every example the client can produce, checking the request it sends and how it reads the response.

A change to the API starts in this file. Both suites fail until each side matches it again.

Each example has a `request` and a `response`:

- `request.method` and `request.path`.
- `request.body`: a JSON value, sent with `Content-Type: application/json`. `request.rawBody` replaces it when the bytes matter (malformed JSON, number literals out of range).
- `request.headers` (optional): headers that replace the defaults.
- `response.status` and `response.body`.
- `response.headers` (optional): headers the response must include.
