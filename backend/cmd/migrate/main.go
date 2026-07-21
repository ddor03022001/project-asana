package main

import (
	"flag"
	"fmt"
	"log"

	"backend/internal/config"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	var dbURL string
	flag.StringVar(&dbURL, "db", "", "Database URL (e.g. postgres://postgres:postgres@localhost:5432/task_management?sslmode=disable)")
	flag.Parse()

	// If DB URL is not passed via CLI flag, try loading from .env config
	if dbURL == "" {
		cfg, err := config.LoadConfig(".")
		if err == nil {
			dbURL = cfg.DatabaseURL
		}
	}

	// Fallback to default local URL if still empty
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/task_management?sslmode=disable"
	}

	args := flag.Args()
	if len(args) < 1 {
		log.Fatal("Please specify action: 'up' or 'down'")
	}

	action := args[0]

	// Create migrate instance
	m, err := migrate.New("file://migrations", dbURL)
	if err != nil {
		log.Fatalf("Could not create migrate instance: %v", err)
	}
	defer m.Close()

	switch action {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("Migration UP failed: %v", err)
		}
		fmt.Println("Migrations applied successfully (UP)!")
	case "down":
		if err := m.Down(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("Migration DOWN failed: %v", err)
		}
		fmt.Println("Migrations rolled back successfully (DOWN)!")
	default:
		log.Fatalf("Unknown action: %s. Use 'up' or 'down'", action)
	}
}
