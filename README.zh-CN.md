[English](README.md) | [中文](README.zh-CN.md)

# 聪明钱监控器

跨链发现和监控聪明钱钱包。追踪顶级交易员持仓，检测巨鲸动向，获取聪明钱交易信号。

## 功能特性

### OKX CEX 聪明钱（需要认证）
- 🔍 **交易员发现** — 按 PnL、胜率、回撤筛选顶级交易员
- 👀 **持仓监控** — 实时追踪交易员持仓，自动检测变化
- 🧠 **信号分析** — 查看聪明钱在哪些币上做多/做空
- 📈 **趋势追踪** — 特定币种的历史信号趋势

### EVM 链上巨鲸（8条链）— 无需认证
- 🐋 **巨鲸检测** — 监控 Ethereum、BSC、Base、Arbitrum、Polygon、Optimism、Avalanche、zkSync 大额转账
- 👛 **钱包监控** — 追踪钱包持仓和余额变化
- 🌐 **多链扫描** — 同时扫描 8 条链的同一地址

### Solana 巨鲸 — 无需认证
- 🐋 **巨鲸检测** — 监控大额 SOL 转账
- 👛 **钱包监控** — 追踪 SPL 代币持仓
- 📊 **代币分析** — 查看代币信息和大户持仓

### Hyperliquid DEX — 无需认证
- 📊 **账户监控** — 追踪交易员持仓和盈亏
- 📜 **交易历史** — 查看成交记录和生成交易复盘
- 💰 **市场数据** — 获取市场行情、资金费率、现货余额

### 通用功能
- 📱 **Telegram 通知** — 巨鲸动向和持仓变化时推送通知
- 💾 **状态持久化** — 自动保存运行状态
- 🔗 **多链钱包监控** — 统一监控所有链的钱包

## 前置要求

- Node.js 18+
- Python 3.8+ — 区块链 skills（EVM、Solana、Hyperliquid）需要
- OKX CLI (`npm install -g @okx_ai/okx-trade-cli`) — **可选**，仅 OKX 聪明钱功能需要
- OKX 真实账户 — **可选**，Smart Money 不支持模拟盘

> **💡 提示**: EVM、Solana、Hyperliquid 功能无需 OKX 认证。只有 OKX 聪明钱功能需要认证。

## 快速开始

```bash
# 克隆并配置
cd smartmoney-monitor
cp .env.example .env
# 编辑 .env 填入 Telegram 配置（可选）

# EVM 巨鲸（无需认证）
node index.js evm-whale
node index.js evm-wallet 0xd8dA...96045

# Solana 巨鲸（无需认证）
node index.js sol-whale
node index.js sol-wallet 9WzDX...

# Hyperliquid（无需认证）
node index.js hl-state 0xabc...
node index.js hl-review 0xabc...

# OKX 聪明钱（需要认证）
node index.js discover
node index.js signal

# 查看状态
node index.js status
```

## 命令列表

### OKX 聪明钱（CEX）— 需要认证

| 命令 | 说明 |
|------|------|
| `discover` | 发现聪明钱交易员 |
| `details <id1,id2>` | 查看交易员详情 |
| `monitor` | 单次监控持仓变化 |
| `watch` | 持续监控模式（循环） |
| `signal` | 聪明钱信号概览 |
| `trend <coin>` | 单币种信号趋势 |
| `analyze` | 分析显著信号变化 |
| `history <id>` | 查看交易员历史平仓 |
| `list` | 查看 OKX 监控列表 |

### EVM 链上巨鲸 — 无需认证

| 命令 | 说明 |
|------|------|
| `evm-whale [--min-usd N] [--chain X]` | 检测大额转账（默认 $100K） |
| `evm-wallet <address>` | 查看钱包持仓 |
| `evm-multichain <address>` | 多链扫描同一地址 |
| `evm-chains` | 显示支持的 EVM 链 |

### Solana 巨鲸 — 无需认证

| 命令 | 说明 |
|------|------|
| `sol-whale [--min-sol N]` | 检测大额 SOL 转账（默认 1000 SOL） |
| `sol-wallet <address>` | 查看钱包持仓 |
| `sol-token <mint>` | 查看代币信息和大户 |
| `sol-stats` | Solana 网络状态 |

### Hyperliquid DEX — 无需认证

| 命令 | 说明 |
|------|------|
| `hl-state <address>` | 查看账户持仓状态 |
| `hl-fills <address> [--hours N]` | 查看成交记录 |
| `hl-review <address> [--hours N]` | 生成交易复盘 |
| `hl-spot <address>` | 查看现货余额 |
| `hl-markets [--limit N]` | 查看市场数据 |
| `hl-funding <coin> [--hours N]` | 查看资金费率 |

### 钱包监控列表 — 无需认证

| 命令 | 说明 |
|------|------|
| `wallet-list` | 查看所有监控钱包 |
| `wallet-add <addr> <chain> [label]` | 添加钱包到监控 |
| `wallet-remove <addr> <chain>` | 从监控移除钱包 |

### 通用

| 命令 | 说明 |
|------|------|
| `status` | 查看当前状态 |
| `export` | 导出监控列表为 JSON |

## 配置说明 (.env)

```bash
# Telegram 通知（可选）
TELEGRAM_BOT_TOKEN=*** OKX 聪明钱筛选条件（仅使用 OKX 功能时需要）
MIN_PNL=10000
MIN_WIN_RATE=60
MAX_DRAWDOWN=50
SORT_BY=pnl
PERIOD=7
WATCH_INSTRUMENTS=BTC,ETH,SOL
SIGNAL_CHANGE_THRESHOLD=10

# EVM 巨鲸检测
EVM_MIN_USD=100000
EVM_BLOCKS=20
EVM_CHAIN=               # 留空=所有链

# Solana 巨鲸检测
SOLANA_MIN_SOL=1000

# Hyperliquid（可选默认地址）
HYPERLIQUID_USER_ADDRESS=

# 日志
LOG_FILE=./logs/smartmoney.log
```

## 支持的链

### EVM（8条链）
| Key | 名称 | 符号 |
|-----|------|------|
| ethereum | Ethereum | ETH |
| bsc | BNB Chain | BNB |
| base | Base | ETH |
| arbitrum | Arbitrum One | ETH |
| polygon | Polygon | POL |
| optimism | Optimism | ETH |
| avalanche | Avalanche C | AVAX |
| zksync | zkSync Era | ETH |

### Solana
- 原生 SOL + SPL 代币
- NFT 检测
- 代币大户分析

### Hyperliquid
- 永续合约
- 现货交易
- 资金费率

## 项目结构

```
smartmoney-monitor/
├── index.js              # CLI 入口（30+ 命令）
├── src/
│   ├── discover.js       # OKX 交易员发现
│   ├── monitor.js        # OKX 持仓监控
│   ├── signal.js         # OKX 信号分析
│   ├── evm.js            # EVM 巨鲸检测 & 钱包监控
│   ├── solana.js         # Solana 巨鲸检测 & 钱包监控
│   ├── hyperliquid.js    # Hyperliquid 账户 & 市场监控
│   ├── state.js          # 状态持久化（多链）
│   ├── notify.js         # Telegram 通知（多链）
│   └── utils.js          # 工具函数 & OKX CLI 封装
├── data/                 # 运行时状态（gitignore）
├── logs/                 # 日志文件（gitignore）
├── .env.example          # 配置模板
└── .gitignore
```

## 区块链 Skills

本工具集成了 Hermes Agent 区块链 skills：

- **EVM Skill** — 8 链 EVM 数据 + 巨鲸检测
- **Solana Skill** — Solana 区块链数据 + USD 定价
- **Hyperliquid Skill** — Hyperliquid DEX 市场和账户数据

Skills 位于 `~/.hermes/skills/blockchain/`

## 使用场景

### 1. 发现聪明钱
```bash
# EVM 巨鲸（无需认证）
node index.js evm-whale --min-usd 500000

# Solana 巨鲸（无需认证）
node index.js sol-whale --min-sol 5000

# OKX CEX 交易员（需要认证）
node index.js discover --limit 10
```

### 2. 监控特定钱包
```bash
# 添加到监控列表
node index.js wallet-add 0xd8dA...96045 ethereum "Vitalik"
node index.js wallet-add 9WzDX... solana "Whale-1"

# 查看监控列表
node index.js wallet-list

# 查看钱包详情
node index.js evm-wallet 0xd8dA...96045
node index.js sol-wallet 9WzDX...
```

### 3. Hyperliquid 交易员分析
```bash
# 查看账户持仓
node index.js hl-state 0xabc...

# 生成交易复盘（最近7天）
node index.js hl-review 0xabc... --hours 168

# 查看成交记录
node index.js hl-fills 0xabc... --hours 72
```

### 4. 综合状态查看
```bash
node index.js status
```

## 许可证

MIT
