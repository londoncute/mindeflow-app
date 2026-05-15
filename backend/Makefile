
include .env
export

DB_URL = postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}
		
run:
	go run ./cmd/app/main.go

migrate-up:
	migrate -path migrations -database "${DB_URL}" up

migrate-down:
	migrate -path migrations -database "${DB_URL} down"