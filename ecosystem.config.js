const fs = require("fs");
const path = require("path");

// Ensure logs directory exists before PM2 starts
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure data directory exists for SQLite
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  apps: [
    {
      name: "crypto-analytics",
      script: "dist/index.js",
      cwd: __dirname, // Ensure working directory is project root
      instances: 1, // SQLite works best with single instance
      exec_mode: "fork", // Use fork mode for SQLite (not cluster)
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_file: ".env",
      // Logging - use absolute paths to avoid issues
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: path.join(__dirname, "logs", "error.log"),
      out_file: path.join(__dirname, "logs", "out.log"),
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

