#!/usr/bin/env node

import { config } from 'dotenv';
import { loadState, saveState, removeFromWatchlist, exportWatchlist } from './src/state.js';
import { discoverTraders, getTraderDetails } from './src/discover.js';
import { monitorPositions, startMonitorLoop } from './src/monitor.js';
import { getSignalOverview, getSignalTrend, analyzeSignalChanges } from './src/signal.js';
import { print, log, ensureLogFile, formatTime } from './src/utils.js';

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
  logFile: process.env.LOG_FILE || './logs/smartmoney.log'
};

// Ensure log file
ensureLogFile(appConfig.logFile);

// Parse CLI args
const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  print(`
🧠 OKX Smart Money Monitor - 聪明钱发现与监控工具
${'='.repeat(55)}

用法: node index.js <command> [options]

命令:
  discover                发现聪明钱交易员
  details <id1,id2,...>   查看交易员详情
  monitor                 单次监控持仓变化
  watch                   持续监控模式（循环）
  signal                  聪明钱信号概览
  trend <coin>            单币种信号趋势
  analyze                 分析信号变化
  status                  查看当前状态
  history <id>            查看交易员历史平仓
  list                    查看监控列表
  remove <id>             从监控列表移除
  export                  导出监控列表

示例:
  node index.js discover
  node index.js details 61234567890,98765432101
  node index.js monitor
  node index.js watch
  node index.js signal
  node index.js trend BTC
  node index.js analyze
  node index.js status
  node index.js history 61234567890
  node index.js list
  node index.js remove 61234567890
  node index.js export
`);
}

async function main() {
  const state = loadState();
  
  log(appConfig.logFile, `\n${'='.repeat(50)}`);
  log(appConfig.logFile, `🚀 Command: ${command || 'help'}`);
  
  switch (command) {
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
    
    case 'status': {
      const { watchlist, traders, signals, lastDiscovery, lastMonitor } = state;
      
      print(`\n📊 OKX Smart Money Monitor 状态`);
      print(`${'='.repeat(40)}`);
      print(`👥 监控交易员数: ${watchlist?.length || 0}`);
      print(`📈 已缓存信号: ${Object.keys(signals || {}).length} 个币种`);
      print(`🔍 上次发现: ${lastDiscovery ? formatTime(new Date(lastDiscovery)) : '从未'}`);
      print(`👀 上次监控: ${lastMonitor ? formatTime(new Date(lastMonitor)) : '从未'}`);
      
      if (watchlist?.length > 0) {
        print(`\n📋 监控列表:`);
        for (const id of watchlist) {
          const t = traders?.[id];
          const nickname = t?.info?.nickname || t?.info?.nickName || id.slice(-8);
          const pnl = t?.info?.pnl ? ` ($${Number(t.info.pnl).toLocaleString()})` : '';
          print(`  • ${nickname}${pnl} [${id}]`);
        }
      }
      
      if (Object.keys(signals || {}).length > 0) {
        print(`\n🧠 信号概览:`);
        for (const [coin, sig] of Object.entries(signals)) {
          const bias = sig.longRatio > 0.6 ? '🟢 多头' : sig.shortRatio > 0.6 ? '🔴 空头' : '⚖️ 均衡';
          print(`  • ${coin}: ${bias} (${(sig.longRatio * 100).toFixed(0)}:${(sig.shortRatio * 100).toFixed(0)})`);
        }
      }
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
        print('⚠️  监控列表为空，请先运行 discover 命令');
      } else {
        print(`\n📋 监控列表 (${state.watchlist.length} 位交易员):\n`);
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
    
    case 'remove': {
      if (!args[1]) {
        print('❌ 请提供 authorId，例如: node index.js remove 61234567890');
        process.exit(1);
      }
      removeFromWatchlist(state, args[1]);
      saveState(state);
      print(`✅ 已从监控列表移除: ${args[1]}`);
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
