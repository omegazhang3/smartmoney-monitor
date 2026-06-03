[English](README.md) | [中文](README.zh-CN.md)

# 聪明钱监控器

发现和监控聪明钱钱包。追踪顶级交易员的持仓，实时检测变化，获取聪明钱交易信号。

## 功能特性

- 🔍 **聪明钱发现** — 按 PnL、胜率、回撤筛选顶级交易员
- 👀 **持仓监控** — 实时追踪交易员持仓，自动检测变化
- 🧠 **信号分析** — 查看聪明钱在哪些币上做多/做空
- 📈 **趋势追踪** — 特定币种的历史信号趋势
- 📱 **Telegram 通知** — 持仓变化和信号变化时推送通知
- 💾 **状态持久化** — 自动保存运行状态

## 前置要求

- Node.js 18+
- OKX CLI (`npm install -g @okx_ai/okx-trade-cli`)
- OKX 真实账户（Smart Money 不支持模拟盘）

## 快速开始

```bash
# 克隆并配置
cd okx-smartmoney-monitor
cp .env.example .env
# 编辑 .env 填入 Telegram 配置（可选）

# 发现顶级交易员
node index.js discover

# 监控持仓变化
node index.js monitor

# 查看信号概览
node index.js signal

# 启动持续监控
node index.js watch
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `discover` | 发现聪明钱交易员 |
| `details <id1,id2>` | 查看交易员详情 |
| `monitor` | 单次监控持仓变化 |
| `watch` | 持续监控模式（循环） |
| `signal` | 聪明钱信号概览 |
| `trend <coin>` | 单币种信号趋势 |
| `analyze` | 分析显著信号变化 |
| `status` | 查看当前状态 |
| `history <id>` | 查看交易员历史平仓 |
| `list` | 查看监控列表 |
| `remove <id>` | 从监控列表移除 |
| `export` | 导出监控列表为 JSON |

## 配置说明 (.env)

```bash
# Telegram 通知（可选）
TELEGRAM_BOT_TOKEN=你的Bot Token
TELEGR...N
# 监控间隔（分钟）
MONITOR_INTERVAL=5

# 聪明钱筛选条件
MIN_PNL=10000          # 最小 PnL（美元）
MIN_WIN_RATE=60        # 最小胜率（0-100）
MAX_DRAWDOWN=50        # 最大回撤（0-100）
SORT_BY=pnl            # 排序方式：pnl / pnlRatio / winRate
PERIOD=7               # 时间周期：3 / 7 / 30 / 90 天

# 监控的币种（逗号分隔，留空=自动发现top20热门币）
WATCH_INSTRUMENTS=BTC,ETH,SOL

# 信号变化阈值（%）
SIGNAL_CHANGE_THRESHOLD=10
```

## 项目结构

```
okx-smartmoney-monitor/
├── index.js            # CLI 入口
├── src/
│   ├── discover.js     # 交易员发现逻辑
│   ├── monitor.js      # 持仓监控 & 变化检测
│   ├── signal.js       # 信号概览 & 趋势分析
│   ├── state.js        # 状态持久化 & 持仓差异
│   ├── notify.js       # Telegram 通知
│   └── utils.js        # 工具函数 & OKX CLI 封装
├── data/               # 运行时状态（gitignore）
├── logs/               # 日志文件（gitignore）
├── .env.example        # 配置模板
└── .gitignore
```

## 使用场景

### 1. 快速发现聪明钱
```bash
node index.js discover --limit 10
```

### 2. 追踪特定交易员
```bash
# 查看详情
node index.js details 61234567890

# 查看历史平仓
node index.js history 61234567890
```

### 3. 监控持仓变化
```bash
# 单次检查
node index.js monitor

# 持续监控（每5分钟检查一次）
node index.js watch
```

### 4. 分析聪明钱信号
```bash
# 全部热门币信号
node index.js signal

# 特定币种趋势
node index.js trend BTC
node index.js trend ETH --daily --limit 7

# 检测信号变化
node index.js analyze
```

## 许可证

MIT
