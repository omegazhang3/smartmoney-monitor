[English](README.md) | [中文](README.zh-CN.md)

# Smart Money Monitor

Discover and monitor smart money wallets across multiple chains. Track top traders' positions, detect whale movements, and get signals on what smart money is trading.

## Features

### OKX CEX Smart Money
- 🔍 **Trader Discovery** — Find top-performing traders by PnL, win rate, drawdown
- 👀 **Position Monitoring** — Track traders' positions in real-time with change detection
- 🧠 **Signal Analysis** — See what coins smart money is long/short on
- 📈 **Trend Tracking** — Historical signal trends for specific coins

### EVM Chain Whales (8 chains)
- 🐋 **Whale Detection** — Monitor large transfers across Ethereum, BSC, Base, Arbitrum, Polygon, Optimism, Avalanche, zkSync
- 👛 **Wallet Monitoring** — Track wallet portfolios and balance changes
- 🌐 **Multi-Chain Scan** — Scan same address across all 8 chains

### Solana Whales
- 🐋 **Whale Detection** — Monitor large SOL transfers
- 👛 **Wallet Monitoring** — Track SPL token portfolios
- 📊 **Token Analysis** — View token info and top holders

### Hyperliquid DEX
- 📊 **Account Monitoring** — Track trader positions and PnL
- 📜 **Trade History** — View fill history and generate trade reviews
- 💰 **Market Data** — Access markets, funding rates, and spot balances

### General
- 📱 **Telegram Notifications** — Get alerts on whale movements and position changes
- 💾 **State Persistence** — Automatic state saving between runs
- 🔗 **Multi-Chain Wallet Watchlist** — Unified wallet monitoring across all chains

## Prerequisites

- Node.js 18+
- OKX CLI (`npm install -g @okx_ai/okx-trade-cli`) — for OKX Smart Money features
- Python 3.8+ — for blockchain skills (EVM, Solana, Hyperliquid)
- OKX account with live trading access (demo mode not supported for Smart Money)

## Quick Start

```bash
# Clone and setup
cd smartmoney-monitor
cp .env.example .env
# Edit .env with your Telegram credentials (optional)

# OKX Smart Money
node index.js discover
node index.js signal

# EVM Whales
node index.js evm-whale
node index.js evm-wallet 0xd8dA...96045

# Solana Whales
node index.js sol-whale
node index.js sol-wallet 9WzDX...

# Hyperliquid
node index.js hl-state 0xabc...
node index.js hl-review 0xabc...

# Check status
node index.js status
```

## Command Reference

### OKX Smart Money (CEX)

| Command | Description |
|---------|-------------|
| `discover` | Discover top smart money traders |
| `details <id1,id2>` | Get detailed info for specific traders |
| `monitor` | Single round of position monitoring |
| `watch` | Continuous monitoring loop |
| `signal` | Smart money signal overview |
| `trend <coin>` | Signal trend for a specific coin |
| `analyze` | Analyze significant signal changes |
| `history <id>` | View trader's closed position history |
| `list` | List all monitored traders |

### EVM Chain Whales

| Command | Description |
|---------|-------------|
| `evm-whale [--min-usd N] [--chain X]` | Detect large transfers (default: $100K) |
| `evm-wallet <address>` | View wallet portfolio |
| `evm-multichain <address>` | Scan address across all 8 chains |
| `evm-chains` | List supported EVM chains |

### Solana Whales

| Command | Description |
|---------|-------------|
| `sol-whale [--min-sol N]` | Detect large SOL transfers (default: 1000 SOL) |
| `sol-wallet <address>` | View wallet portfolio |
| `sol-token <mint>` | View token info and top holders |
| `sol-stats` | Solana network stats |

### Hyperliquid DEX

| Command | Description |
|---------|-------------|
| `hl-state <address>` | View account positions |
| `hl-fills <address> [--hours N]` | View fill history |
| `hl-review <address> [--hours N]` | Generate trade review |
| `hl-spot <address>` | View spot balances |
| `hl-markets [--limit N]` | View market data |
| `hl-funding <coin> [--hours N]` | View funding rates |

### Wallet Watchlist

| Command | Description |
|---------|-------------|
| `wallet-list` | List all monitored wallets |
| `wallet-add <addr> <chain> [label]` | Add wallet to watchlist |
| `wallet-remove <addr> <chain>` | Remove wallet from watchlist |

### General

| Command | Description |
|---------|-------------|
| `status` | Show current monitor status |
| `export` | Export watchlist to JSON |

## Configuration (.env)

```bash
# Telegram notifications (optional)
TELEGRAM_BOT_TOKEN=
TELE...n

# Monitor interval (minutes)
MONITOR_INTERVAL=5

# OKX Smart Money filters
MIN_PNL=10000
MIN_WIN_RATE=60
MAX_DRAWDOWN=50
SORT_BY=pnl
PERIOD=7
WATCH_INSTRUMENTS=BTC,ETH,SOL
SIGNAL_CHANGE_THRESHOLD=10

# EVM whale detection
EVM_MIN_USD=100000
EVM_BLOCKS=20
EVM_CHAIN=               # Leave empty for all chains

# Solana whale detection
SOLANA_MIN_SOL=1000

# Hyperliquid (optional default address)
HYPERLIQUID_USER_ADDRESS=

# Logging
LOG_FILE=./logs/smartmoney.log
```

## Supported Chains

### EVM (8 chains)
| Key | Name | Symbol |
|-----|------|--------|
| ethereum | Ethereum | ETH |
| bsc | BNB Chain | BNB |
| base | Base | ETH |
| arbitrum | Arbitrum One | ETH |
| polygon | Polygon | POL |
| optimism | Optimism | ETH |
| avalanche | Avalanche C | AVAX |
| zksync | zkSync Era | ETH |

### Solana
- Native SOL + SPL tokens
- NFT detection
- Token top holders analysis

### Hyperliquid
- Perpetual contracts
- Spot trading
- Funding rates

## Architecture

```
smartmoney-monitor/
├── index.js              # CLI entry point (30+ commands)
├── src/
│   ├── discover.js       # OKX trader discovery
│   ├── monitor.js        # OKX position monitoring
│   ├── signal.js         # OKX signal analysis
│   ├── evm.js            # EVM whale detection & wallet monitoring
│   ├── solana.js         # Solana whale detection & wallet monitoring
│   ├── hyperliquid.js    # Hyperliquid account & market monitoring
│   ├── state.js          # State persistence (multi-chain)
│   ├── notify.js         # Telegram notifications (multi-chain)
│   └── utils.js          # Shared utilities & OKX CLI wrapper
├── data/                 # Runtime state (gitignored)
├── logs/                 # Log files (gitignored)
├── .env.example          # Configuration template
└── .gitignore
```

## Blockchain Skills

This tool integrates with Hermes Agent blockchain skills:

- **EVM Skill** — 8-chain EVM data with whale detection
- **Solana Skill** — Solana blockchain data with USD pricing
- **Hyperliquid Skill** — Hyperliquid DEX market and account data

Skills are located at `~/.hermes/skills/blockchain/`

## License

MIT
