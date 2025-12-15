# Token Insight & Analytics API

A type-safe Node.js/Express backend API for cryptocurrency token insights and HyperLiquid wallet PnL analytics.

## Features

- **Token Insight API**: Fetch token market data from CoinGecko and generate AI-powered market insights using OpenRouter
- **HyperLiquid Wallet PnL API**: Calculate daily profit/loss for HyperLiquid wallets
- **Supabase Caching**: Automatic caching of API responses for improved performance
- **Type-Safe**: Built with TypeScript with strict type checking
- **Docker Ready**: Containerized for easy deployment

## Tech Stack

- **Runtime**: Node.js with Bun (development) / Node.js (production)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **AI**: Vercel AI SDK with OpenRouter provider
- **Market Data**: CoinGecko API
- **Trading Data**: HyperLiquid API
- **Validation**: Zod

## Prerequisites

- Node.js 20+ or Bun
- Supabase account with a project
- OpenRouter API key

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd crypto-analytics
npm install
# or with bun
bun install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# OpenRouter Configuration (for AI inference)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-5.1

# Cache Configuration (in minutes)
TOKEN_INSIGHT_CACHE_TTL=60
PNL_CACHE_TTL=1440
```

### 3. Set Up Supabase Database

Run the SQL migration in your Supabase SQL Editor:

```sql
-- Copy contents from supabase/migrations/001_initial_schema.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 4. Run the Server

```bash
# Development (with hot reload)
npm run dev
# or
bun --hot src/server.ts

# Production
npm start
# or
bun src/server.ts
```

The server will start at `http://localhost:3000`.

## API Endpoints

### Health Check

```
GET /health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "environment": "development"
}
```

### Token Insight API

```
POST /api/token/:id/insight
```

**Path Parameters:**

- `id` (required): CoinGecko token ID (e.g., "bitcoin", "ethereum", "chainlink")

**Request Body (optional):**

```json
{
  "vs_currency": "usd",
  "history_days": 30
}
```

**Response:**

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
    "reasoning": "LINK shows moderate trading activity with slight bearish pressure in the last 24 hours.",
    "sentiment": "Neutral"
  },
  "model": {
    "provider": "openrouter",
    "model": "openai/gpt-5.1"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/token/bitcoin/insight \
  -H "Content-Type: application/json" \
  -d '{"vs_currency": "usd"}'
```

### HyperLiquid Wallet Daily PnL API

```
GET /api/hyperliquid/:wallet/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD
```

**Path Parameters:**

- `wallet` (required): Ethereum wallet address (0x...)

**Query Parameters:**

- `start` (required): Start date in YYYY-MM-DD format
- `end` (required): End date in YYYY-MM-DD format

**Response:**

```json
{
  "wallet": "0xabc123...",
  "start": "2025-08-01",
  "end": "2025-08-03",
  "daily": [
    {
      "date": "2025-08-01",
      "realized_pnl_usd": 120.5,
      "unrealized_pnl_usd": -15.3,
      "fees_usd": 2.1,
      "funding_usd": -0.5,
      "net_pnl_usd": 102.6,
      "equity_usd": 10102.6
    }
  ],
  "summary": {
    "total_realized_usd": 120.5,
    "total_unrealized_usd": -25.3,
    "total_fees_usd": 3.3,
    "total_funding_usd": -0.8,
    "net_pnl_usd": 91.1
  },
  "diagnostics": {
    "data_source": "hyperliquid_api",
    "last_api_call": "2025-09-22T12:00:00Z",
    "notes": "PnL calculated using daily close prices"
  }
}
```

**Example:**

```bash
curl "http://localhost:3000/api/hyperliquid/0x1234567890abcdef1234567890abcdef12345678/pnl?start=2025-01-01&end=2025-01-07"
```

## Error Handling

All errors return a consistent JSON structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {} // Optional additional context
}
```

**Error Codes:**

- `VALIDATION_ERROR` (400): Invalid request parameters
- `TOKEN_NOT_FOUND` (404): Token not found on CoinGecko
- `WALLET_NOT_FOUND` (404): Wallet not found
- `EXTERNAL_API_ERROR` (502): External API (CoinGecko/HyperLiquid) error
- `AI_SERVICE_ERROR` (503): AI service unavailable or returned invalid response
- `DATABASE_ERROR` (500): Database operation failed
- `INTERNAL_ERROR` (500): Unexpected server error

## Docker Deployment

### Build and Run Locally

```bash
# Build the image
docker build -t crypto-analytics .

# Run with environment variables
docker run -p 3000:3000 \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_ANON_KEY=your-key \
  -e OPENROUTER_API_KEY=your-key \
  crypto-analytics
```

### Using Docker Compose

```bash
# Create .env file with your configuration
cp .env.example .env
# Edit .env with your values

# Start the service
docker compose up -d

# View logs
docker compose logs -f

# Stop the service
docker compose down
```

## AWS EC2 Deployment

### Step 1: Launch EC2 Instance

1. Go to AWS EC2 Console
2. Launch a new instance:
   - **AMI**: Amazon Linux 2023 or Ubuntu 22.04
   - **Instance Type**: t3.micro (free tier) or t3.small for production
   - **Storage**: 20GB gp3
3. Configure Security Group:
   - Allow SSH (port 22) from your IP
   - Allow HTTP (port 80) from anywhere
   - Allow Custom TCP (port 3000) from anywhere (or use a reverse proxy)

### Step 2: Connect and Install Docker

```bash
# Connect to your instance
ssh -i your-key.pem ec2-user@your-instance-ip

# Install Docker (Amazon Linux 2023)
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes
exit
ssh -i your-key.pem ec2-user@your-instance-ip
```

### Step 3: Deploy the Application

```bash
# Clone the repository
git clone <your-repo-url> crypto-analytics
cd crypto-analytics

# Create environment file
cat > .env << 'EOF'
PORT=3000
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-5.1
TOKEN_INSIGHT_CACHE_TTL=60
PNL_CACHE_TTL=1440
EOF

# Build and start the container
docker compose up -d --build

# Verify it's running
docker compose ps
curl http://localhost:3000/health
```

### Step 4: Set Up Reverse Proxy (Optional)

For production, use Nginx as a reverse proxy:

```bash
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Configure Nginx
sudo tee /etc/nginx/conf.d/crypto-analytics.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Enable HTTPS with Let's Encrypt (Recommended)

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## OpenRouter Configuration

### Getting an API Key

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Go to API Keys section
3. Create a new API key
4. Add credits to your account

### Supported Models

You can use any model available on OpenRouter by setting `OPENROUTER_MODEL`:

- `openai/gpt-5.1` (default, cost-effective)
- `google/gemini-3-pro-preview` (more capable)
- `anthropic/claude-3-haiku` (fast)
- `anthropic/claude-3-sonnet` (balanced)
- `meta-llama/llama-3-70b-instruct` (open source)

## Project Structure

```
crypto-analytics/
├── src/
│   ├── config/
│   │   └── env.ts              # Environment configuration
│   ├── lib/
│   │   └── supabase.ts         # Supabase client
│   ├── middleware/
│   │   ├── errorHandler.ts     # Error handling middleware
│   │   └── validateRequest.ts  # Request validation
│   ├── routes/
│   │   ├── tokenInsight.routes.ts
│   │   └── hyperliquid.routes.ts
│   ├── services/
│   │   ├── aiInsight.service.ts
│   │   ├── coingecko.service.ts
│   │   ├── hyperliquid.service.ts
│   │   ├── pnlCalculation.service.ts
│   │   ├── supabaseCache.service.ts
│   │   ├── tokenInsight.service.ts
│   │   └── walletPnl.service.ts
│   ├── types/
│   │   ├── database.ts
│   │   ├── errors.ts
│   │   ├── hyperliquid.ts
│   │   ├── pnl.ts
│   │   └── token.ts
│   ├── utils/
│   │   ├── dateRange.ts
│   │   └── logger.ts
│   └── server.ts               # Application entry point
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## Running Tests

```bash
npm test
# or
bun test
```

## License

MIT
