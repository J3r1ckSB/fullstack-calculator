FROM node:24.22.1-alpine AS frontend
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
# tsc -b type-checks tests that import ../../../contract/examples.json.
COPY contract /repo/contract
RUN npm run build

FROM golang:1.27.3-alpine AS backend
WORKDIR /repo/backend
COPY backend ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
COPY --from=backend /server /server
COPY --from=frontend /repo/frontend/dist /static
ENV PORT=8080 STATIC_DIR=/static
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
