module.exports = {
  apps: [
    {
      name: "crypto-analytics",
      script: "dist/index.js",
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
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

