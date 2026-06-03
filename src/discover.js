import { okxCommand, formatCurrency, formatPercent, formatNumber, print, log } from './utils.js';
import { updateTrader, addToWatchlist, saveState } from './state.js';
import { formatDiscoveryMessage, sendTelegram } from './notify.js';

/**
 * Discover top traders based on filters
 */
export async function discoverTraders(config, state) {
  const {
    minPnl = 10000,
    minWinRate = 60,
    maxDrawdown = 50,
    sortBy = 'pnl',
    period = 7,
    limit = 20
  } = config;
  
  print('🔍 正在发现聪明钱交易员...');
  
  const args = {
    period,
    sortBy,
    limit: Math.min(limit, 50)
  };
  
  // Add filters
  if (minPnl > 0) args.minPnl = minPnl;
  if (minWinRate > 0) args.minWinRate = minWinRate / 100;  // API expects 0-1
  if (maxDrawdown < 100) args.maxDrawdown = maxDrawdown / 100;
  
  const result = okxCommand('smartmoney traders-by-filter', args);
  
  if (!result || !result.data) {
    print('❌ 未获取到交易员数据');
    log(config.logFile, '❌ discover failed: no data');
    return null;
  }
  
  const traders = Array.isArray(result.data) ? result.data : [result.data];
  
  if (traders.length === 0) {
    print('⚠️  未找到符合条件的交易员');
    log(config.logFile, '⚠️  No traders found matching criteria');
    return [];
  }
  
  // Process and display traders
  print(`\n📊 发现 ${traders.length} 位聪明钱交易员:\n`);
  print('┌────┬──────────────────┬──────────────┬────────┬──────────┐');
  print('│ #  │ 昵称             │ PnL          │ 胜率   │ AuthorId │');
  print('├────┼──────────────────┼──────────────┼────────┼──────────┤');
  
  const discovered = [];
  
  for (let i = 0; i < traders.length; i++) {
    const t = traders[i];
    const rank = String(i + 1).padStart(2);
    const nickname = (t.nickname || t.nickName || `Trader-${t.authorId?.slice(-6)}`).slice(0, 16).padEnd(16);
    const pnl = formatCurrency(t.pnl).padStart(12);
    const winRate = formatPercent(t.winRate).padStart(6);
    const authorId = t.authorId?.slice(-8) || '-';
    
    print(`│ ${rank} │ ${nickname} │ ${pnl} │ ${winRate} │ ${authorId} │`);
    
    discovered.push(t);
    
    // Update state
    updateTrader(state, t.authorId, { info: t });
    addToWatchlist(state, t.authorId);
  }
  
  print('└────┴──────────────────┴──────────────┴────────┴──────────┘');
  print('');
  
  // Save state
  state.lastDiscovery = new Date().toISOString();
  saveState(state);
  
  // Send notification if configured
  if (config.telegramBotToken && config.telegramChatId) {
    const msg = formatDiscoveryMessage(discovered);
    if (msg) {
      await sendTelegram(config.telegramBotToken, config.telegramChatId, msg);
      print('📱 已发送 Telegram 通知');
    }
  }
  
  log(config.logFile, `✅ Discovered ${discovered.length} traders`);
  
  return discovered;
}

/**
 * Get detailed info for specific traders
 */
export async function getTraderDetails(authorIds, config, state) {
  print('📋 正在获取交易员详情...');
  
  const results = [];
  
  for (const authorId of authorIds) {
    print(`\n👤 交易员: ${authorId}`);
    
    // Get performance
    const perf = okxCommand('smartmoney performance-by-trader', {
      authorIds: authorId,
      period: config.period || 30
    });
    
    if (perf?.data) {
      const p = Array.isArray(perf.data) ? perf.data[0] : perf.data;
      print(`  💰 PnL: ${formatCurrency(p.pnl)}`);
      print(`  📊 胜率: ${formatPercent(p.winRate)}`);
      print(`  📈 收益率: ${formatPercent(p.pnlRatio)}`);
      
      updateTrader(state, authorId, { performance: p });
    }
    
    // Get current positions
    const positions = okxCommand('smartmoney trader-positions', { authorId });
    
    if (positions?.data) {
      const posList = Array.isArray(positions.data) ? positions.data : [positions.data];
      print(`  📦 当前持仓: ${posList.length} 个`);
      
      for (const pos of posList) {
        const inst = pos.instId || pos.instCcy || '?';
        const side = pos.posSide === 'long' ? '📈' : pos.posSide === 'short' ? '📉' : '↔️';
        const size = formatNumber(Math.abs(Number(pos.sz || pos.pos || 0)));
        const upl = pos.upl ? formatCurrency(pos.upl) : '-';
        print(`    ${side} ${inst} ${size}张 未实现盈亏: ${upl}`);
      }
      
      updateTrader(state, authorId, { positions: posList });
    }
    
    results.push({ authorId, performance: perf?.data, positions: positions?.data });
  }
  
  saveState(state);
  return results;
}
