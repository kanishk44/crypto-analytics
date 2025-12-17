# Crypto Analytics API

A TypeScript/Express backend providing Token Insight & Analytics API and HyperLiquid Wallet Daily PnL API with persistent equity snapshot storage.

## Features

- **Token Insight API**: Fetches token data from CoinGecko and generates AI-powered insights using OpenRouter
- **HyperLiquid PnL API**: Calculates daily wallet PnL from HyperLiquid trading activity with event-based data reconstruction
- **Equity Snapshot System**: Stores daily equity snapshots in SQLite for accurate historical tracking

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Validation**: Zod
- **Database**: SQLite (better-sqlite3)
- **Scheduling**: node-cron
- **AI**: OpenRouter (via direct HTTP API)
- **Market Data**: CoinGecko API
- **Trading Data**: HyperLiquid API

## Project Structure

```
src/
├── config/          # Environment configuration
├── controllers/     # Request handlers
├── database/        # SQLite database setup
├── jobs/            # Cron jobs (equity snapshots)
├── middleware/      # Express middleware
├── routes/          # Route definitions
├── schemas/         # Zod validation schemas
├── services/        # Business logic services
└── utils/           # Utility functions

data/                # SQLite database storage (created automatically)
```

## Setup

### Prerequisites

- Node.js 20+ and npm
- Docker (optional, for containerized deployment)
- OpenRouter API key ([get one here](https://openrouter.ai/))

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-analytics
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_MODEL=openai/gpt-4o-mini
   COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
   HYPERLIQUID_BASE_URL=https://api.hyperliquid.xyz/info
   DB_PATH=./data/crypto-analytics.db
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t crypto-analytics .
   ```

2. **Run with docker-compose**
   ```bash
   docker-compose up -d
   ```

3. **Run standalone container**
   ```bash
   docker run -p 3000:3000 \
     -v $(pwd)/data:/app/data \
     --env-file .env \
     crypto-analytics
   ```

   Note: Mount the `/app/data` volume to persist the SQLite database.

### AWS EC2 Deployment with PM2

This is the recommended approach for production deployment on EC2.

#### 1. Launch EC2 Instance

- **AMI**: Amazon Linux 2023 or Ubuntu 22.04
- **Instance Type**: t3.small or larger (SQLite benefits from good I/O)
- **Storage**: At least 20GB EBS (gp3 recommended for better I/O)
- **Security Group**: Open port 3000 (or 80/443 with nginx reverse proxy)

#### 2. Connect and Install Dependencies

```bash
# SSH into your instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Update system
sudo yum update -y  # Amazon Linux
# or: sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs  # Amazon Linux
# or: sudo apt install -y nodejs  # Ubuntu

# Install build tools (required for better-sqlite3)
sudo yum groupinstall -y "Development Tools"  # Amazon Linux
# or: sudo apt install -y build-essential python3  # Ubuntu

# Install PM2 globally
sudo npm install -g pm2
```

#### 3. Deploy Application

```bash
# Clone repository
git clone <repository-url>
cd crypto-analytics

# Install dependencies
npm ci

# Build TypeScript
npm run build

# Create data and logs directories
mkdir -p data logs
```

#### 4. Configure Environment

```bash
# Create .env file
nano .env
```

Add your environment variables:
```env
PORT=3000
NODE_ENV=production
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
HYPERLIQUID_BASE_URL=https://api.hyperliquid.xyz/info
DB_PATH=./data/crypto-analytics.db
```

#### 5. Start with PM2

```bash
# Start using the ecosystem config file
pm2 start ecosystem.config.js

# Or start directly
pm2 start dist/index.js --name crypto-analytics

# Save PM2 process list (survives reboot)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions printed by the command
```

#### 6. PM2 Commands Reference

```bash
# View running processes
pm2 list

# View logs
pm2 logs crypto-analytics

# View real-time logs
pm2 logs crypto-analytics --lines 100

# Monitor CPU/Memory
pm2 monit

# Restart application
pm2 restart crypto-analytics

# Stop application
pm2 stop crypto-analytics

# Delete from PM2
pm2 delete crypto-analytics

# Reload with zero downtime
pm2 reload crypto-analytics
```

#### 7. Setup Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install nginx
sudo yum install -y nginx  # Amazon Linux
# or: sudo apt install -y nginx  # Ubuntu

# Create nginx config
sudo nano /etc/nginx/conf.d/crypto-analytics.conf
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or use EC2 public IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### 8. Database Backup (Important!)

The SQLite database contains your equity snapshots. Set up regular backups:

```bash
# Manual backup
cp data/crypto-analytics.db data/crypto-analytics-backup-$(date +%Y%m%d).db

# Automated backup with cron (daily at 2 AM)
crontab -e
```

Add:
```
0 2 * * * cp /home/ec2-user/crypto-analytics/data/crypto-analytics.db /home/ec2-user/crypto-analytics/data/backups/crypto-analytics-$(date +\%Y\%m\%d).db
```

#### Important Notes for PM2 with SQLite

1. **Single Instance Only**: SQLite doesn't support multiple writers. The `ecosystem.config.js` is configured with `instances: 1` and `exec_mode: "fork"` to prevent issues.

2. **Don't Use Cluster Mode**: PM2's cluster mode spawns multiple processes that would conflict with SQLite. Always use fork mode.

3. **Database Location**: Ensure `DB_PATH` points to a persistent location. The default `./data/crypto-analytics.db` works if you're always running from the project directory.

4. **Backup Before Updates**: Always backup the database before deploying updates:
   ```bash
   cp data/crypto-analytics.db data/crypto-analytics-pre-deploy.db
   git pull
   npm ci
   npm run build
   pm2 restart crypto-analytics
   ```

## API Endpoints

### 1. Token Insight API

**Endpoint**: `POST /api/token/:id/insight`

Fetches token market data from CoinGecko and generates AI-based insights.

**Path Parameters**:
- `id` (string, required): CoinGecko token ID (e.g., `chainlink`, `bitcoin`)

**Request Body** (optional):
```json
{
  "vs_currency": "usd",
  "history_days": 30
}
```

**Response**:
```json
{
  "source": "coingecko",
  "token": {
    "id": "chainlink",
    "symbol": "link",
    "name": "Chainlink",
    "market_data": {
      "current_price_usd": 7.23,
      "market_cap_usd": 3500000000,
      "total_volume_usd": 120000000,
      "price_change_percentage_24h": -1.2
    }
  },
  "insight": {
    "reasoning": "Brief market analysis...",
    "sentiment": "Neutral",
    "risk_level": "Medium",
    "time_horizon": "Medium"
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/token/chainlink/insight \
  -H "Content-Type: application/json" \
  -d '{"vs_currency": "usd", "history_days": 30}'
```

### 2. HyperLiquid Wallet Daily PnL API

**Endpoint**: `GET /api/hyperliquid/:wallet/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD`

Calculates daily wallet PnL from HyperLiquid trading activity.

**Path Parameters**:
- `wallet` (string, required): Wallet address

**Query Parameters**:
- `start` (string, required): Start date in `YYYY-MM-DD` format
- `end` (string, required): End date in `YYYY-MM-DD` format

**Response**:
```json
{
  "wallet": "0xabc123...",
  "start": "2025-12-11",
  "end": "2025-12-17",
  "daily": [
    {
      "date": "2025-12-11",
      "realized_pnl_usd": 120.5,
      "unrealized_pnl_usd": 0,
      "fees_usd": 2.1,
      "funding_usd": -0.5,
      "net_pnl_usd": 117.9,
      "equity_usd": 10102.6
    }
  ],
  "summary": {
    "total_realized_usd": 120.5,
    "total_unrealized_usd": 0,
    "total_fees_usd": 3.3,
    "total_funding_usd": -0.8,
    "net_pnl_usd": 116.4
  },
  "diagnostics": {
    "data_source": "hyperliquid_api",
    "last_api_call": "2025-12-17T12:00:00Z",
    "notes": "PnL calculated using event-based data from HyperLiquid APIs. 5/7 days have stored equity snapshots. 2 days are reconstructed.",
    "unrealized_policy": "Unrealized PnL is only available for the current/last day from clearinghouseState."
  }
}
```

**Example**:
```bash
curl "http://localhost:3000/api/hyperliquid/0xabc123.../pnl?start=2025-12-11&end=2025-12-17"
```

### 3. Equity Snapshot API

The Equity Snapshot system stores daily equity values in a SQLite database, enabling accurate historical equity tracking.

#### Track a Wallet

**Endpoint**: `POST /api/snapshots/track/:wallet`

Add a wallet to the tracking list for automatic daily snapshots.

**Request Body** (optional):
```json
{
  "name": "My Trading Wallet"
}
```

**Response**:
```json
{
  "message": "Wallet added to tracking",
  "trackedWallet": {
    "id": 1,
    "wallet": "0xabc123...",
    "name": "My Trading Wallet",
    "active": 1,
    "created_at": "2025-12-17T12:00:00Z"
  },
  "initialSnapshot": {
    "id": 1,
    "wallet": "0xabc123...",
    "date": "2025-12-17",
    "equity_usd": 10250.50,
    "unrealized_pnl_usd": 125.30,
    "account_value": 10250.50,
    "total_margin_used": 2500.00,
    "positions_count": 3,
    "snapshot_time": "2025-12-17T12:00:00Z"
  }
}
```

#### Untrack a Wallet

**Endpoint**: `DELETE /api/snapshots/track/:wallet`

Remove a wallet from tracking (historical snapshots are preserved).

#### List Tracked Wallets

**Endpoint**: `GET /api/snapshots/tracked/list`

**Response**:
```json
{
  "wallets": [
    {
      "id": 1,
      "wallet": "0xabc123...",
      "name": "My Trading Wallet",
      "active": 1,
      "created_at": "2025-12-17T12:00:00Z"
    }
  ],
  "count": 1
}
```

#### Capture Snapshot (Manual)

**Endpoint**: `POST /api/snapshots/capture/:wallet`

Manually capture an equity snapshot for a wallet.

**Response**:
```json
{
  "message": "Snapshot captured successfully",
  "snapshot": {
    "id": 5,
    "wallet": "0xabc123...",
    "date": "2025-12-17",
    "equity_usd": 10250.50,
    "unrealized_pnl_usd": 125.30,
    "account_value": 10250.50,
    "total_margin_used": 2500.00,
    "positions_count": 3,
    "snapshot_time": "2025-12-17T14:30:00Z"
  }
}
```

#### Capture All Snapshots

**Endpoint**: `POST /api/snapshots/capture-all`

Trigger snapshot capture for all tracked wallets.

**Response**:
```json
{
  "message": "Snapshot capture complete",
  "success": 5,
  "failed": 0,
  "wallets": ["0xabc...", "0xdef...", "0x123...", "0x456...", "0x789..."]
}
```

#### Get Stored Snapshots

**Endpoint**: `GET /api/snapshots/:wallet?start=YYYY-MM-DD&end=YYYY-MM-DD`

Retrieve stored equity snapshots for a wallet.

**Response**:
```json
{
  "wallet": "0xabc123...",
  "start": "2025-12-11",
  "end": "2025-12-17",
  "snapshots": [
    {
      "id": 1,
      "wallet": "0xabc123...",
      "date": "2025-12-11",
      "equity_usd": 10000.00,
      "unrealized_pnl_usd": 0,
      "account_value": 10000.00,
      "total_margin_used": 0,
      "positions_count": 0,
      "snapshot_time": "2025-12-11T23:55:00Z"
    }
  ],
  "count": 7
}
```

## Testing the Equity Snapshot System

### Step 1: Start the Server

```bash
npm run dev
```

You should see:
```
Server running on port 3000 in development mode
[Cron] Equity snapshot cron job scheduled (daily at 23:55 UTC)
[Cron] Hourly equity update cron job scheduled
```

### Step 2: Track a Wallet

```bash
curl -X POST http://localhost:3000/api/snapshots/track/0xb13114bdBd4803526483384cB99B6c0aa48A30f7 \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Wallet"}'
```

This will:
1. Add the wallet to the tracking list
2. Capture an initial equity snapshot
3. Return the tracked wallet and snapshot data

### Step 3: Verify Tracking

```bash
curl http://localhost:3000/api/snapshots/tracked/list
```

### Step 4: Manually Capture a Snapshot

```bash
curl -X POST http://localhost:3000/api/snapshots/capture/0xb13114bdBd4803526483384cB99B6c0aa48A30f7
```

### Step 5: Get PnL with Stored Equity

```bash
curl "http://localhost:3000/api/hyperliquid/0xb13114bdBd4803526483384cB99B6c0aa48A30f7/pnl?start=2025-12-11&end=2025-12-17"
```

The `diagnostics.notes` field will show how many days have stored snapshots vs reconstructed equity.

### Step 6: View Stored Snapshots

```bash
curl "http://localhost:3000/api/snapshots/0xb13114bdBd4803526483384cB99B6c0aa48A30f7?start=2025-12-01&end=2025-12-31"
```

## Automated Snapshot Capture

The system includes two cron jobs:

1. **Daily at 23:55 UTC**: Captures end-of-day equity for all tracked wallets
2. **Hourly**: Updates the current day's equity snapshot with the latest value

These run automatically when the server is running. No manual intervention needed after tracking wallets.

## Data Provenance & Calculations

### Real vs Derived Data

#### Real Data (Direct from APIs)
- **CoinGecko**: All token market data (prices, market cap, volume, 24h changes)
- **HyperLiquid Fills**: Trade fills with realized PnL (`closedPnl`), fees, and timestamps
- **HyperLiquid Funding**: Funding payments from the funding endpoint
- **Current Equity & Unrealized PnL**: Available only for today via `clearinghouseState`
- **Stored Equity Snapshots**: Historical equity values captured and stored in SQLite

#### Derived Data (Computed by This Service)
- **Daily Aggregations**: Realized PnL, fees, and funding aggregated per day
- **Historical Unrealized PnL**: Set to `0` for historical days (HyperLiquid doesn't provide this)
- **Reconstructed Equity**: For days without stored snapshots, equity is reconstructed using: `equity_{d-1} = equity_d - net_pnl_d`

### Equity Source Priority

When calculating equity for each day:

1. **Stored Snapshot** (highest priority): Use the equity value from the database
2. **Live Anchor** (today only): Use current equity from `clearinghouseState`
3. **Reconstruction** (fallback): Calculate from nearest known equity using PnL

### HyperLiquid API Limitations

1. **Unrealized PnL**: Only available for today via `clearinghouseState`
2. **Historical Equity**: Not provided - must be stored locally or reconstructed
3. **Event-Based Model**: Provides fills and funding events, not daily snapshots

### Daily PnL Calculation

```
realized_pnl = sum(closedPnl from all fills on that day)
fees = sum(fees from all fills on that day)
funding = sum(funding payments on that day)
unrealized_pnl = (today only, from clearinghouseState) or 0

net_pnl = realized_pnl + unrealized_pnl - fees + funding
```

## Postman Collection

A Postman collection is included: `Crypto_Analytics_API.postman_collection.json`

**To import:**
1. Open Postman
2. Click "Import" button
3. Select the `Crypto_Analytics_API.postman_collection.json` file
4. Update collection variables as needed

**Collection Variables:**
- `base_url`: API base URL (default: `http://localhost:3000`)
- `wallet`: HyperLiquid wallet address to test with
- `start_date`: Default start date for queries
- `end_date`: Default end date for queries

The collection includes:
- Health check endpoint
- Token Insight API examples
- HyperLiquid PnL API examples
- **Equity Snapshot API examples** (new)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `OPENROUTER_API_KEY` | OpenRouter API key | **Required** |
| `OPENROUTER_MODEL` | AI model identifier | `openai/gpt-4o-mini` |
| `COINGECKO_BASE_URL` | CoinGecko API base URL | `https://api.coingecko.com/api/v3` |
| `HYPERLIQUID_BASE_URL` | HyperLiquid API base URL | `https://api.hyperliquid.xyz/info` |
| `DB_PATH` | SQLite database path | `./data/crypto-analytics.db` |

## Database

The SQLite database is stored at `./data/crypto-analytics.db` (configurable via `DB_PATH`).

**Tables:**
- `equity_snapshots`: Stores daily equity snapshots per wallet
- `tracked_wallets`: Stores wallets being tracked for automatic snapshots

The database is created automatically on first run.

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Error Handling

The API returns standardized error responses:

```json
{
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "details": {}
  }
}
```

Common error codes:
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (resource not found)
- `502`: Bad Gateway (upstream API error)
- `504`: Gateway Timeout (request timeout)
- `500`: Internal Server Error

## License

MIT
