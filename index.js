#!/usr/bin/env node

import { config } from 'dotenv';
import { loadState, saveState, removeFromWatchlist, exportWatchlist, addWalletToWatchlist, removeWalletFromWatchlist } from './src/state.js';
import { discoverTraders, getTraderDetails } from './src/discover.js';
import { monitorPositions, startMonitorLoop } from './src/monitor.js';
import { getSignalOverview, getSignalTrend, analyzeSignalChanges } from './src/signal.js';
import { detectEvmWhales, monitorEvmWallet, multichainScan, getSupportedChains } from './src/evm.js';
import { detectSolanaWhales, monitorSolanaWallet, getTokenInfo, getSolanaStats } from './src/solana.js';
import { getAccountState, getFills, generateReview, getSpotBalances, getMarkets, getFundingRates } from './src/hyperliquid.js';
import { print, log, ensureLogFile, formatTime, formatCurrency } from './src/utils.js';
import { sendTelegram, formatEvmWhaleMessage, formatSolanaWhaleMessage, formatHyperliquidAccountMessage, formatHyperliquidReviewMessage } from './src/notify.js';

// Load .env
config();

// Build config from env
const appConfig = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  monitorInterval: parseInt(process.env.MONITOR_INTERVAL || '5'),
  minPnl: parseInt(process.env.MIN_PNL || '10000'),
  minWinRate: parseInt(process.env.MIN_WIN_RATE || '60'),
  maxDrawdown: parseInt(process.env.MAX_DRAWDOWN || '50'),
  sortBy: process.env.SORT_BY || 'pnl',
  period: parseInt(process.env.PERIOD || '7'),
  watchInstruments: process.env.WATCH_INSTRUMENTS ? 
    process.env.WATCH_INSTRUMENTS.split(',').map(s => s.trim()).filter(Boolean) : 
    [],
  signalChangeThreshold: parseInt(process.env.SIGNAL_CHANGE_THRESHOLD || '10'),
  logFile: process.env.LOG_FILE || './logs/smartmoney.log',
  
  // EVM config
  evm: {
    minUsd: parseInt(process.env.EVM_MIN_USD || '100000'),
    blocks: parseInt(process.env.EVM_BLOCKS || '20'),
    chain: process.env.EVM_CHAIN || null
  },
  
  // Solana config
  solana: {
    minSol: parseInt(process.env.SOLANA_MIN_SOL || '1000')
  },
  
  // Hyperliquid config
  hyperliquid: {
    address: process.env.HYPERLIQUID_USER_ADDRESS
  }
};

// Ensure log file
ensureLogFile(appConfig.logFile);

// Parse CLI args
const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  print(`
🧠 Smart Money Monitor - 聪明钱发现与监控工具
${'='.repeat(60)}

用法: node index.js <command> [options]

=== OKX Smart Money (CEX) ===
  discover                发现聪明钱交易员
  details <id1,id2,...>   查看交易员详情
  monitor                 单次监控持仓变化
  watch                   持续监控模式（循环）
  signal                  聪明钱信号概览
  trend <coin>            单币种信号趋势
  analyze                 分析信号变化
  history <id>            查看交易员历史平仓
  list                    查看 OKX 监控列表

=== EVM 链上巨鲸 (8条链) ===
  evm-whale               检测 EVM 链上大额转账
  evm-wallet <address>    查看 EVM 钱包持仓
  evm-multichain <addr>   多链扫描同一地址
  evm-chains              显示支持的 EVM 链

=== Solana 链上巨鲸 ===
  sol-whale               检测 Solana 大额 SOL 转账
  sol-wallet <address>    查看 Solana 钱包持仓
  sol-token <mint>        查看代币信息和大户
  sol-stats               Solana 网络状态

=== Hyperliquid DEX ===
  hl-state <address>      查看账户持仓状态
  hl-fills <address>      查看成交记录
  hl-review <address>     生成交易复盘
  hl-spot <address>       查看现货余额
  hl-markets              查看市场数据
  hl-funding <coin>       查看资金费率

=== 通用 ===
  status                  查看当前状态
  wallet-list             查看钱包监控列表
  wallet-add <addr> <chain> [label]  添加钱包到监控
  wallet-remove <addr> <chain>       移除钱包
  export                  导出监控列表

示例:
  node index.js discover
  node index.js evm-whale --min-usd 500000
  node index.js sol-whale --min-sol 5000
  node index.js hl-state 0xabc...
  node index.js hl-review 0xabc... --hours 168
  node index.js status
`);
}

async function main() {
  const state = loadState();
  
  log(appConfig.logFile, `\n${'='.repeat(50)}`);
  log(appConfig.logFile, `🚀 Command: ${command || 'help'}`);
  
  switch (command) {
    // ==================== OKX Smart Money ====================
    case 'discover': {
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 20;
      await discoverTraders({ ...appConfig, limit }, state);
      break;
    }
    
    case 'details': {
      if (!args[1]) {
        print('❌ 请提供 authorId，例如: node index.js details 61234567890,98765432101');
        process.exit(1);
      }
      const ids = args[1].split(',').map(s => s.trim());
      await getTraderDetails(ids, appConfig, state);
      break;
    }
    
    case 'monitor': {
      await monitorPositions(appConfig, state);
      break;
    }
    
    case 'watch': {
      await startMonitorLoop(appConfig, state);
      break;
    }
    
    case 'signal': {
      await getSignalOverview(appConfig, state);
      break;
    }
    
    case 'trend': {
      if (!args[1]) {
        print('❌ 请提供币种，例如: node index.js trend BTC');
        process.exit(1);
      }
      const granularity = args.includes('--daily') ? '1d' : '1h';
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 24;
      await getSignalTrend(args[1].toUpperCase(), appConfig, state, { granularity, limit });
      break;
    }
    
    case 'analyze': {
      await analyzeSignalChanges(appConfig, state);
      break;
    }
    
    case 'history': {
      if (!args[1]) {
        print('❌ 请提供 authorId，例如: node index.js history 61234567890');
        process.exit(1);
      }
      print(`📜 正在获取 ${args[1]} 的历史平仓...`);
      const { okxCommand } = await import('./src/utils.js');
      const result = okxCommand('smartmoney trader-positions-history', { authorId: args[1] });
      
      if (result?.data) {
        const history = Array.isArray(result.data) ? result.data : [result.data];
        print(`\n📜 历史平仓记录 (${history.length} 条):\n`);
        
        for (const pos of history.slice(0, 20)) {
          const inst = pos.instId || pos.instCcy || '?';
          const side = pos.posSide === 'long' ? '📈 多' : pos.posSide === 'short' ? '📉 空' : '↔️';
          const pnl = pos.realizedPnl ? `盈亏: ${Number(pos.realizedPnl) >= 0 ? '+' : ''}$${Number(pos.realizedPnl).toLocaleString()}` : '';
          const time = pos.cTime ? new Date(Number(pos.cTime)).toLocaleString('zh-CN') : '-';
          print(`  ${side} ${inst}  ${pnl}  ${time}`);
        }
        
        if (history.length > 20) {
          print(`\n  ... 还有 ${history.length - 20} 条记录`);
        }
      } else {
        print('⚠️  无历史平仓记录');
      }
      break;
    }
    
    case 'list': {
      if (!state.watchlist || state.watchlist.length === 0) {
        print('⚠️  OKX 监控列表为空，请先运行 discover 命令');
      } else {
        print(`\n📋 OKX 监控列表 (${state.watchlist.length} 位交易员):\n`);
        for (const id of state.watchlist) {
          const t = state.traders?.[id];
          const nickname = t?.info?.nickname || t?.info?.nickName || '-';
          const pnl = t?.info?.pnl ? `$${Number(t.info.pnl).toLocaleString()}` : '-';
          const winRate = t?.info?.winRate ? `${(Number(t.info.winRate) * 100).toFixed(1)}%` : '-';
          print(`  ${nickname.padEnd(20)} PnL: ${pnl.padStart(12)} 胜率: ${winRate.padStart(6)}  [${id}]`);
        }
      }
      break;
    }
    
    // ==================== EVM ====================
    case 'evm-whale': {
      const minUsdIdx = args.indexOf('--min-usd');
      if (minUsdIdx >= 0) appConfig.evm.minUsd = parseInt(args[minUsdIdx + 1]);
      
      const chainIdx = args.indexOf('--chain');
      if (chainIdx >= 0) appConfig.evm.chain = args[chainIdx + 1];
      
      await detectEvmWhales(appConfig, state);
      saveState(state);
      break;
    }
    
    case 'evm-wallet': {
      if (!args[1]) {
        print('❌ 请提供钱包地址，例如: node index.js evm-wallet 0xd8dA...96045');
        process.exit(1);
      }
      await monitorEvmWallet(args[1], appConfig, state);
      saveState(state);
      break;
    }
    
    case 'evm-multichain': {
      if (!args[1]) {
        print('❌ 请提供钱包地址，例如: node index.js evm-multichain 0xd8dA...96045');
        process.exit(1);
      }
      await multichainScan(args[1], appConfig, state);
      saveState(state);
      break;
    }
    
    case 'evm-chains': {
      const chains = getSupportedChains();
      print('\n⛓️  支持的 EVM 链:\n');
      print('┌─────────────┬──────────────┬────────┬───────────┐');
      print('│ Key         │ Name         │ Symbol │ Chain ID  │');
      print('├─────────────┼──────────────┼────────┼───────────┤');
      for (const c of chains) {
        print(`│ ${c.key.padEnd(11)} │ ${c.name.padEnd(12)} │ ${c.symbol.padEnd(6)} │ ${String(c.chainId).padEnd(9)} │`);
      }
      print('└─────────────┴──────────────┴────────┴───────────┘');
      break;
    }
    
    // ==================== Solana ====================
    case 'sol-whale': {
      const minSolIdx = args.indexOf('--min-sol');
      if (minSolIdx >= 0) appConfig.solana.minSol = parseInt(args[minSolIdx + 1]);
      
      await detectSolanaWhales(appConfig, state);
      saveState(state);
      break;
    }
    
    case 'sol-wallet': {
      if (!args[1]) {
        print('❌ 请提供钱包地址，例如: node index.js sol-wallet 9WzDX...');
        process.exit(1);
      }
      await monitorSolanaWallet(args[1], appConfig, state);
      saveState(state);
      break;
    }
    
    case 'sol-token': {
      if (!args[1]) {
        print('❌ 请提供代币 mint 地址，例如: node index.js sol-token DezXAZ...');
        process.exit(1);
      }
      await getTokenInfo(args[1], appConfig);
      break;
    }
    
    case 'sol-stats': {
      await getSolanaStats(appConfig);
      break;
    }
    
    // ==================== Hyperliquid ====================
    case 'hl-state': {
      const address = args[1] || appConfig.hyperliquid.address;
      if (!address) {
        print('❌ 请提供地址或在 .env 设置 HYPERLIQUID_USER_ADDRESS');
        process.exit(1);
      }
      await getAccountState(address, appConfig, state);
      saveState(state);
      break;
    }
    
    case 'hl-fills': {
      const address = args[1] || appConfig.hyperliquid.address;
      if (!address) {
        print('❌ 请提供地址或在 .env 设置 HYPERLIQUID_USER_ADDRESS');
        process.exit(1);
      }
      const hoursIdx = args.indexOf('--hours');
      const hours = hoursIdx >= 0 ? parseInt(args[hoursIdx + 1]) : 72;
      await getFills(address, appConfig, state, hours);
      saveState(state);
      break;
    }
    
    case 'hl-review': {
      const address = args[1] || appConfig.hyperliquid.address;
      if (!address) {
        print('❌ 请提供地址或在 .env 设置 HYPERLIQUID_USER_ADDRESS');
        process.exit(1);
      }
      const hoursIdx = args.indexOf('--hours');
      const hours = hoursIdx >= 0 ? parseInt(args[hoursIdx + 1]) : 168;
      await generateReview(address, appConfig, state, hours);
      saveState(state);
      break;
    }
    
    case 'hl-spot': {
      const address = args[1] || appConfig.hyperliquid.address;
      if (!address) {
        print('❌ 请提供地址或在 .env 设置 HYPERLIQUID_USER_ADDRESS');
        process.exit(1);
      }
      await getSpotBalances(address, appConfig, state);
      saveState(state);
      break;
    }
    
    case 'hl-markets': {
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 20;
      await getMarkets(appConfig, limit);
      break;
    }
    
    case 'hl-funding': {
      if (!args[1]) {
        print('❌ 请提供币种，例如: node index.js hl-funding BTC');
        process.exit(1);
      }
      const hoursIdx = args.indexOf('--hours');
      const hours = hoursIdx >= 0 ? parseInt(args[hoursIdx + 1]) : 72;
      await getFundingRates(args[1].toUpperCase(), appConfig, hours);
      break;
    }
    
    // ==================== Wallet Watchlist ====================
    case 'wallet-list': {
      if (!state.walletWatchlist || state.walletWatchlist.length === 0) {
        print('⚠️  钱包监控列表为空');
      } else {
        print(`\n📋 钱包监控列表 (${state.walletWatchlist.length} 个):\n`);
        for (const w of state.walletWatchlist) {
          print(`  ${w.chain.padEnd(12)} ${w.label.padEnd(20)} ${w.address}`);
        }
      }
      break;
    }
    
    case 'wallet-add': {
      if (!args[1] || !args[2]) {
        print('❌ 用法: node index.js wallet-add <address> <chain> [label]');
        print('   chain: ethereum, bsc, base, arbitrum, polygon, optimism, avalanche, zksync, solana, hyperliquid');
        process.exit(1);
      }
      addWalletToWatchlist(state, args[1], args[2], args[3] || '');
      saveState(state);
      print(`✅ 已添加到监控: ${args[1]} (${args[2]})`);
      break;
    }
    
    case 'wallet-remove': {
      if (!args[1] || !args[2]) {
        print('❌ 用法: node index.js wallet-remove <address> <chain>');
        process.exit(1);
      }
      removeWalletFromWatchlist(state, args[1], args[2]);
      saveState(state);
      print(`✅ 已从监控移除: ${args[1]} (${args[2]})`);
      break;
    }
    
    // ==================== General ====================
    case 'status': {
      const { watchlist, traders, signals, lastDiscovery, lastMonitor } = state;
      
      print(`\n📊 Smart Money Monitor 状态`);
      print(`${'='.repeat(50)}`);
      
      print(`\n🔷 OKX Smart Money:`);
      print(`  👥 监控交易员数: ${watchlist?.length || 0}`);
      print(`  📈 已缓存信号: ${Object.keys(signals || {}).length} 个币种`);
      print(`  🔍 上次发现: ${lastDiscovery ? formatTime(new Date(lastDiscovery)) : '从未'}`);
      print(`  👀 上次监控: ${lastMonitor ? formatTime(new Date(lastMonitor)) : '从未'}`);
      
      print(`\n⟠ EVM 链上:`);
      print(`  🐋 巨鲸记录: ${state.evmWhales?.length || 0} 条`);
      print(`  👛 监控钱包: ${Object.keys(state.evmWallets || {}).length} 个`);
      print(`  🔍 上次扫描: ${state.lastEvmScan ? formatTime(new Date(state.lastEvmScan)) : '从未'}`);
      
      print(`\n☀️ Solana:`);
      print(`  🐋 巨鲸记录: ${state.solanaWhales?.length || 0} 条`);
      print(`  👛 监控钱包: ${Object.keys(state.solanaWallets || {}).length} 个`);
      print(`  🔍 上次扫描: ${state.lastSolanaScan ? formatTime(new Date(state.lastSolanaScan)) : '从未'}`);
      
      print(`\n⚡ Hyperliquid:`);
      print(`  📊 监控账户: ${Object.keys(state.hyperliquidAccounts || {}).length} 个`);
      print(`  📜 成交记录: ${Object.keys(state.hyperliquidFills || {}).length} 个账户`);
      print(`  📈 交易复盘: ${Object.keys(state.hyperliquidReviews || {}).length} 个账户`);
      
      print(`\n👛 钱包监控列表: ${state.walletWatchlist?.length || 0} 个`);
      break;
    }
    
    case 'export': {
      if (!state.watchlist || state.watchlist.length === 0) {
        print('⚠️  监控列表为空');
      } else {
        const filePath = exportWatchlist(state, './data/watchlist.json');
        print(`✅ 已导出监控列表到: ${filePath}`);
      }
      break;
    }
    
    default:
      printHelp();
  }
  
  log(appConfig.logFile, `✅ Command completed: ${command || 'help'}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  log(appConfig.logFile, `❌ Fatal: ${error.message}`);
  process.exit(1);
});
