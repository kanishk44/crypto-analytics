# Crypto Analytics API

A TypeScript/Express backend providing Token Insight & Analytics API and HyperLiquid Wallet Daily PnL API.

## Features

- **Token Insight API**: Fetches token data from CoinGecko and generates AI-powered insights using OpenRouter
- **HyperLiquid PnL API**: Calculates daily wallet PnL from HyperLiquid trading activity with event-based data reconstruction

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Validation**: Zod
- **AI**: OpenRouter (via direct HTTP API)
- **Market Data**: CoinGecko API
- **Trading Data**: HyperLiquid API

## Project Structure

```
src/
├── config/          # Environment configuration
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── routes/          # Route definitions
├── schemas/         # Zod validation schemas
├── services/        # Business logic services
└── utils/           # Utility functions
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
   docker run -p 3000:3000 --env-file .env crypto-analytics
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
    "notes": "PnL calculated using event-based data from HyperLiquid APIs. Equity is reconstructed, not historical snapshots.",
    "unrealized_policy": "Unrealized PnL is only available for the current/last day from clearinghouseState. Historical days show 0 unrealized PnL. Equity is reconstructed backwards from the current equity snapshot."
  }
}
```

**Example**:
```bash
curl "http://localhost:3000/api/hyperliquid/0xabc123.../pnl?start=2025-08-01&end=2025-08-03"
```

## Data Provenance & Calculations

### Real vs Derived Data

#### Real Data (Direct from APIs)
- **CoinGecko**: All token market data (prices, market cap, volume, 24h changes) are fetched directly from CoinGecko API
- **HyperLiquid Fills**: All trade fills with realized PnL (`closedPnl`), fees, and timestamps come directly from HyperLiquid `userFills` endpoint
- **HyperLiquid Funding**: Funding payments come directly from HyperLiquid funding endpoint
- **Current Equity & Unrealized PnL**: Available only for the current/last day via `clearinghouseState` endpoint

#### Derived Data (Computed by This Service)
- **Daily Aggregations**: Realized PnL, fees, and funding are aggregated per day from event-based data
- **Historical Unrealized PnL**: Set to `0` for all historical days (prior to the current snapshot date) because HyperLiquid does not provide historical unrealized PnL data
- **Equity Series**: Equity values are **reconstructed**, not historical snapshots:
  - When `clearinghouseState` is available: Equity is anchored to the current equity value and reconstructed backwards using: `equity_{d-1} = equity_d - net_pnl_d`
  - When `clearinghouseState` is unavailable: Equity is computed as relative values starting from 0 on the last requested day
- **Spot Trading PnL**: If spot fills are detected, realized PnL includes spot PnL computed using average-cost method (optional, only if spot data exists)

### HyperLiquid API Limitations

1. **Unrealized PnL**: Only available for the current/last day via `clearinghouseState`. Historical unrealized PnL cannot be reconstructed without historical position snapshots, which HyperLiquid does not provide.

2. **Historical Equity**: Historical equity snapshots are not available. Equity must be reconstructed from current equity and daily PnL.

3. **Event-Based Model**: HyperLiquid provides event-based data (fills, funding payments) rather than daily snapshots. Daily aggregations are computed by grouping events by date.

### Daily PnL Calculation

For each day in the requested range:

```
realized_pnl = sum(closedPnl from all fills closed on that day)
fees = sum(fees from all fills on that day)
funding = sum(funding payments on that day)
unrealized_pnl = 
  - If day is current/last day AND clearinghouseState available: use unrealized PnL from clearinghouseState
  - Otherwise: 0

net_pnl = realized_pnl + unrealized_pnl - fees + funding
```

### Equity Reconstruction

Equity is always reconstructed (never a historical snapshot):

1. **With Clearinghouse State** (preferred):
   - Anchor: `equity_snapshot_date = current_equity_usd` (from `clearinghouseState`)
   - Backwards reconstruction: For each prior day `d-1`: `equity_{d-1} = equity_d - net_pnl_d`
   - Forward reconstruction: For days after snapshot (if any): `equity_{d+1} = equity_d + net_pnl_{d+1}`

2. **Without Clearinghouse State** (fallback):
   - Anchor: `equity_end_date = 0` (relative baseline)
   - Backwards reconstruction: Same formula as above
   - Note: Equity values are relative, not absolute USD amounts

### Spot Trading (Optional)

If HyperLiquid returns spot fills (non-perpetual trades), spot realized PnL is computed using a **simple average-cost method**:

- **Buy**: Update position size and average cost
- **Sell**: `realized_spot_pnl = (sell_price - avg_cost) * quantity_sold`

Spot PnL is merged into the `realized_pnl_usd` field. The API contract remains unchanged regardless of whether spot data exists.

## Deployment to AWS EC2

### Option 1: Docker Deployment (Recommended)

1. **SSH into your EC2 instance**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

2. **Install Docker**
   ```bash
   sudo yum update -y
   sudo yum install docker -y
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   ```

3. **Clone and build**
   ```bash
   git clone <repository-url>
   cd crypto-analytics
   docker build -t crypto-analytics .
   ```

4. **Create `.env` file**
   ```bash
   nano .env
   # Add your environment variables
   ```

5. **Run the container**
   ```bash
   docker run -d \
     --name crypto-analytics \
     --restart unless-stopped \
     -p 3000:3000 \
     --env-file .env \
     crypto-analytics
   ```

6. **Configure security group**
   - Open port 3000 (or your chosen port) in EC2 security group

### Option 2: Direct Node.js Deployment

1. **Install Node.js 20+**
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   ```

2. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd crypto-analytics
   npm ci
   npm run build
   ```

3. **Use PM2 for process management**
   ```bash
   sudo npm install -g pm2
   pm2 start dist/index.js --name crypto-analytics
   pm2 save
   pm2 startup
   ```

4. **Configure environment variables**
   ```bash
   nano .env
   # Add your environment variables
   ```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `OPENROUTER_API_KEY` | OpenRouter API key | **Required** |
| `OPENROUTER_MODEL` | AI model identifier | `openai/gpt-4o-mini` |
| `COINGECKO_BASE_URL` | CoinGecko API base URL | `https://api.coingecko.com/api/v3` |
| `HYPERLIQUID_BASE_URL` | HyperLiquid API base URL | `https://api.hyperliquid.xyz/info` |

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

## Notes

- **AI Response Validation**: AI responses are strictly validated using Zod schemas. If validation fails, a fallback deterministic response is returned.
- **Type Safety**: The entire codebase uses TypeScript in strict mode with no `any` types.
- **API Rate Limits**: Be mindful of CoinGecko and HyperLiquid API rate limits. The service includes basic retry logic for transient failures.
- **Date Handling**: All dates are handled in UTC. Date ranges are inclusive of both start and end dates.

## License

MIT

