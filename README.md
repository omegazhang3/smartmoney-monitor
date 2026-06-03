[English](README.md) | [中文](README.zh-CN.md)

# Smart Money Monitor

Discover and monitor smart money wallets. Track top traders' positions, detect changes in real-time, and get signals on what smart money is trading.

## Features

- 🔍 **Smart Money Discovery** — Find top-performing traders by PnL, win rate, drawdown
- 👀 **Position Monitoring** — Track traders' positions in real-time with change detection
- 🧠 **Signal Analysis** — See what coins smart money is long/short on
- 📈 **Trend Tracking** — Historical signal trends for specific coins
- 📱 **Telegram Notifications** — Get alerts on position changes and signals
- 💾 **State Persistence** — Automatic state saving between runs

## Prerequisites

- Node.js 18+
- OKX CLI (`npm install -g @okx_ai/okx-trade-cli`)
- OKX account with live trading access (demo mode not supported for Smart Money)

## Quick Start

```bash
# Clone and setup
cd okx-smartmoney-monitor
cp .env.example .env
# Edit .env with your Telegram credentials (optional)

# Discover top traders
node index.js discover

# Monitor positions
node index.js monitor

# Get signal overview
node index.js signal

# Start continuous monitoring
node index.js watch
```

## Commands

| Command | Description |
|---------|-------------|
| `discover` | Discover top smart money traders |
| `details <id1,id2>` | Get detailed info for specific traders |
| `monitor` | Single round of position monitoring |
| `watch` | Continuous monitoring loop |
| `signal` | Smart money signal overview |
| `trend <coin>` | Signal trend for a specific coin |
| `analyze` | Analyze significant signal changes |
| `status` | Show current monitor status |
| `history <id>` | View trader's closed position history |
| `list` | List all monitored traders |
| `remove <id>` | Remove trader from watchlist |
| `export` | Export watchlist to JSON |

## Configuration (.env)

```bash
# Telegram notifications (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Monitor interval (minutes)
MONITOR_INTERVAL=5

# Smart money filters
MIN_PNL=10000          # Minimum PnL in USD
MIN_WIN_RATE=60        # Minimum win rate (0-100)
MAX_DRAWDOWN=50        # Maximum drawdown (0-100)
SORT_BY=pnl            # Sort: pnl / pnlRatio / winRate
PERIOD=7               # Time period: 3 / 7 / 30 / 90 days

# Watch specific coins (comma-separated, empty = top 20)
WATCH_INSTRUMENTS=BTC,ETH,SOL

# Signal change threshold (%)
SIGNAL_CHANGE_THRESHOLD=10
```

## Architecture

```
okx-smartmoney-monitor/
├── index.js            # CLI entry point
├── src/
│   ├── discover.js     # Trader discovery logic
│   ├── monitor.js      # Position monitoring & change detection
│   ├── signal.js       # Signal overview & trend analysis
│   ├── state.js        # State persistence & position diff
│   ├── notify.js       # Telegram notifications
│   └── utils.js        # Shared utilities & OKX CLI wrapper
├── data/               # Runtime state (gitignored)
├── logs/               # Log files (gitignored)
├── .env.example        # Configuration template
└── .gitignore
```

## License

MIT
