// Environment configuration for SentimentLens frontend
// This file contains environment-specific settings

const ENV = {
    // API Configuration
    API_BASE: "https://deeplearning-backend.onrender.com",

    // Development settings
    DEBUG: true,

    // UI Settings
    MAX_TEXT_LENGTH: 5000,
    MIN_TEXT_LENGTH: 10,

    // Request timeout (ms)
    REQUEST_TIMEOUT: 30000,

    // Health check timeout (ms) - shorter for quick checks
    HEALTH_CHECK_TIMEOUT: 5000
};

// For production, you can override these values
// Example: ENV.API_BASE = "https://your-api-domain.com";