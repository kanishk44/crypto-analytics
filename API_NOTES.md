# API Implementation Notes

## HyperLiquid API Endpoints

The HyperLiquid API endpoints used in this implementation are:

- `/userFills` - Fetches user trade fills
- `/fundingHistory` - Fetches funding payment history
- `/clearinghouseState` - Fetches current clearinghouse state (positions, equity, unrealized PnL)

**Note**: The actual HyperLiquid API structure may differ. If you encounter validation errors, you may need to:

1. Check the actual API response structure from HyperLiquid documentation
2. Update the Zod schemas in `src/schemas/hyperliquid.ts` to match the actual response format
3. Adjust the service methods in `src/services/hyperliquid.service.ts` if endpoint URLs or request formats differ

## CoinGecko API

The CoinGecko API is well-documented and stable. The implementation uses:

- `/coins/{id}` - Token details
- `/coins/{id}/market_chart` - Historical price data

These endpoints are public and do not require authentication.

## OpenRouter API

The implementation uses OpenRouter's chat completions API:

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Authentication: Bearer token via `Authorization` header
- Model: Configurable via `OPENROUTER_MODEL` environment variable

## Testing the APIs

To test the implementation:

1. **Token Insight API**:
   ```bash
   curl -X POST http://localhost:3000/api/token/bitcoin/insight \
     -H "Content-Type: application/json" \
     -d '{"vs_currency": "usd", "history_days": 7}'
   ```

2. **HyperLiquid PnL API**:
   ```bash
   curl "http://localhost:3000/api/hyperliquid/0xYourWalletAddress/pnl?start=2025-01-01&end=2025-01-07"
   ```

   Replace `0xYourWalletAddress` with an actual HyperLiquid wallet address.

## Common Issues

### HyperLiquid API Validation Errors

If you see Zod validation errors when calling HyperLiquid endpoints:

1. Check the actual API response by adding logging in `hyperliquid.service.ts`
2. Compare the response structure with the schemas in `src/schemas/hyperliquid.ts`
3. Update the schemas to match the actual API response

### OpenRouter API Errors

- Ensure `OPENROUTER_API_KEY` is set correctly
- Check that the model identifier in `OPENROUTER_MODEL` is valid
- Verify your OpenRouter account has sufficient credits

### CoinGecko Rate Limits

CoinGecko has rate limits on their free tier. If you hit rate limits:

- Add delays between requests
- Consider caching responses
- Upgrade to a paid CoinGecko plan if needed

