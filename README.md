# Webhook Receiver

A Cloudflare Worker service that acts as the entry point for TradingView alerts and other trading signals. This worker validates incoming webhooks and forwards them to the appropriate worker services.

## Features

- TradingView webhook integration
- Request validation and sanitization
- Secure communication with other workers
- Error handling and logging
- Rate limiting support

## Prerequisites

- Node.js >= 16
- Bun (for package management)
- Wrangler CLI
- Cloudflare Workers account

## Setup

1. Install dependencies:
```bash
bun install
```

2. Configure environment variables in `.dev.vars` for local development:
```env
INTERNAL_SERVICE_KEY=your_internal_key
TRADINGVIEW_KEY=your_tradingview_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TRADE_WORKER_URL=http://localhost:8788
TELEGRAM_WORKER_URL=http://localhost:8790
```

3. Configure production secrets:
```bash
wrangler secret put INTERNAL_SERVICE_KEY
wrangler secret put TRADINGVIEW_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
```

## Development

### Local Development

For local development, this worker should run on port 8789:

```bash
bun run dev -- --port 8789
```

The worker uses environment variables from `.dev.vars` during local development instead of the values in `wrangler.toml` or Cloudflare secrets.

For inter-worker communication during development, update the worker URLs in your `.dev.vars` to point to the local workers:

```
TRADE_WORKER_URL=http://localhost:8788
TELEGRAM_WORKER_URL=http://localhost:8790
```

### Production Deployment

Deploy to production:
```bash
bun run deploy
```

## Webhook Configuration

### TradingView Alert Message Format

```json
{
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "action": "LONG",
  "quantity": 0.001,
  "price": 65000,
  "key": "your_tradingview_key"
}
```

### Supported Actions
- `LONG`: Open a long position
- `SHORT`: Open a short position
- `CLOSE_LONG`: Close a long position
- `CLOSE_SHORT`: Close a short position

## Worker Communication

The webhook receiver communicates with:
- Trade Worker: For executing trades
- Telegram Worker: For sending notifications
- D1 Worker: For logging (if enabled)

## Security

- Webhook authentication using `TRADINGVIEW_KEY`
- Internal service authentication for worker communication
- Request validation and sanitization
- Rate limiting per IP address
- Error messages don't expose sensitive information

## Error Handling

The worker includes comprehensive error handling for:
- Invalid webhook payloads
- Authentication failures
- Rate limiting
- Worker communication errors
- Network issues

## Response Format

Success:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Rate Limiting

- Default: 60 requests per minute per IP
- Configurable through worker settings
- Response includes rate limit headers:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 