package config

import (
	"fmt"
	"github.com/spf13/viper"
)

// Config holds all configuration values for the application loaded from env or .env
type Config struct {
	Port               string `mapstructure:"PORT"`
	GinMode            string `mapstructure:"GIN_MODE"`
	DatabaseURL        string `mapstructure:"DATABASE_URL"`
	RedisURL           string `mapstructure:"REDIS_URL"`
	JWTSecret          string `mapstructure:"JWT_SECRET"`
	GoogleClientID     string `mapstructure:"GOOGLE_CLIENT_ID"`
	GoogleClientSecret string `mapstructure:"GOOGLE_CLIENT_SECRET"`
	ResendAPIKey       string `mapstructure:"RESEND_API_KEY"`
}

// LoadConfig reads configuration from file or environment variables
func LoadConfig(path string) (*Config, error) {
	viper.AddConfigPath(path)
	viper.SetConfigName("") // Set to empty to let Viper search for file with specific name below
	viper.SetConfigFile(path + "/.env")
	viper.SetConfigType("env")

	viper.AutomaticEnv()

	// Set default values
	viper.SetDefault("PORT", "8080")
	viper.SetDefault("GIN_MODE", "debug")

	// Read config file if exists
	if err := viper.ReadInConfig(); err != nil {
		// It is okay if .env is missing, as config can be provided via environment variables directly (e.g. in docker/production)
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate required variables
	if config.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required but not set")
	}
	if config.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required but not set")
	}

	return &config, nil
}
