import { okxCommand, formatCurrency, formatPercent, formatNumber, print, log, sleep, changePercent } from './utils.js';
import { saveState } from './state.js';
import { formatSignalMessage, sendTelegram } from './notify.js';

/**
 * Get smart money signal overview for specific coins or top instruments
 */
export async function getSignalOverview(config, state) {
  const { watchInstruments, topInstruments = 20 } = config;
  
  print('🧠 正在获取聪明钱信号概览...');
  
  const args = {};
  
  if (watchInstruments && watchInstruments.length > 0) {
    args.instCcyList = watchInstruments.join(',');
  } else {
    args.topInstruments = topInstruments;
  }
  
  const result = okxCommand('smartmoney signal-overview-by-filter', args);
  
  if (!result || !result.data) {
    print('❌ 未获取到信号数据');
    log(config.logFile, '❌ Signal overview failed: no data');
    return null;
  }
  
  const signals = Array.isArray(result.data) ? result.data : [result.data];
  
  if (signals.length === 0) {
    print('⚠️  当前无聪明钱信号');
    return [];
  }
  
  print(`\n🧠 聪明钱信号概览 (${signals.length} 个币种):\n`);
  
  // Table header
  print('┌────────┬────────┬──────────────┬──────────────┬────────┬─────────────────┐');
  print('│ 币种   │ 偏向   │ 多头金额     │ 空头金额     │ 人数   │ 多空比          │');
  print('├────────┼────────┼──────────────┼──────────────┼────────┼─────────────────┤');
  
  const processedSignals = [];
  
  for (const sig of signals) {
    const coin = (sig.instCcy || '?').padEnd(6);
    const traders = String(sig.tradersWithPosition || 0).padStart(4);
    const longNotional = sig.longNotional ? formatCurrency(sig.longNotional).padStart(12) : '-'.padStart(12);
    const shortNotional = sig.shortNotional ? formatCurrency(sig.shortNotional).padStart(12) : '-'.padStart(12);
    
    // Calculate ratio
    const total = (sig.longNotional || 0) + (sig.shortNotional || 0);
    const longRatio = total > 0 ? sig.longNotional / total : 0.5;
    const shortRatio = total > 0 ? sig.shortNotional / total : 0.5;
    
    let bias = '⚖️ 均衡';
    if (longRatio > 0.6) bias = '🟢 多头';
    else if (shortRatio > 0.6) bias = '🔴 空头';
    
    const ratioStr = `${formatPercent(longRatio)}:${formatPercent(shortRatio)}`.padStart(15);
    
    print(`│ ${coin} │ ${bias.padEnd(6)} │ ${longNotional} │ ${shortNotional} │ ${traders} │ ${ratioStr} │`);
    
    processedSignals.push({
      ...sig,
      longRatio,
      shortRatio,
      bias: longRatio > 0.6 ? 'long' : shortRatio > 0.6 ? 'short' : 'neutral'
    });
    
    // Update state
    state.signals[sig.instCcy] = {
      ...sig,
      longRatio,
      shortRatio,
      lastUpdate: new Date().toISOString()
    };
  }
  
  print('└────────┴────────┴──────────────┴──────────────┴────────┴─────────────────┘');
  
  // Save state
  saveState(state);
  
  // Send notification if configured
  if (config.telegramBotToken && config.telegramChatId) {
    const msg = formatSignalMessage(processedSignals);
    if (msg) {
      await sendTelegram(config.telegramBotToken, config.telegramChatId, msg);
      print('\n📱 已发送 Telegram 通知');
    }
  }
  
  log(config.logFile, `✅ Signal overview: ${processedSignals.length} instruments`);
  
  return processedSignals;
}

/**
 * Get signal trend for a specific coin
 */
export async function getSignalTrend(instCcy, config, state, options = {}) {
  const { granularity = '1h', limit = 24 } = options;
  
  print(`📈 正在获取 ${instCcy} 的信号趋势...`);
  
  const result = okxCommand('smartmoney signal-trend-by-filter', {
    instCcy,
    granularity,
    limit
  });
  
  if (!result || !result.data) {
    print(`❌ 未获取到 ${instCcy} 的趋势数据`);
    log(config.logFile, `❌ Signal trend failed for ${instCcy}`);
    return null;
  }
  
  const trend = Array.isArray(result.data) ? result.data : [result.data];
  
  if (trend.length === 0) {
    print(`⚠️  ${instCcy} 无趋势数据`);
    return [];
  }
  
  print(`\n📈 ${instCcy} 信号趋势 (最近 ${trend.length} 个${granularity === '1h' ? '小时' : '天'}):\n`);
  
  // Display trend as ASCII chart
  print('时间                 │ 多头占比     │ 持仓人数');
  print('─────────────────────┼──────────────┼─────────');
  
  for (const point of trend) {
    const time = point.ts ? new Date(Number(point.ts)).toLocaleString('zh-CN').padEnd(18) : '-';
    const total = (point.longNotional || 0) + (point.shortNotional || 0);
    const longRatio = total > 0 ? point.longNotional / total : 0.5;
    const traders = point.tradersWithPosition || 0;
    
    // Create bar chart
    const barLength = Math.round(longRatio * 20);
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    
    print(`${time} │ ${bar} ${formatPercent(longRatio).padStart(6)} │ ${String(traders).padStart(5)}`);
  }
  
  log(config.logFile, `✅ Signal trend for ${instCcy}: ${trend.length} points`);
  
  return trend;
}

/**
 * Analyze signal changes and detect significant moves
 */
export async function analyzeSignalChanges(config, state) {
  print('🔍 正在分析信号变化...');
  
  const previousSignals = state.signals || {};
  
  // Get current signals
  const current = await getSignalOverview(config, state);
  if (!current) return null;
  
  const significantChanges = [];
  const threshold = config.signalChangeThreshold || 10;  // 10% change threshold
  
  for (const sig of current) {
    const coin = sig.instCcy;
    const prev = previousSignals[coin];
    
    if (prev) {
      const longRatioChange = changePercent(sig.longRatio, prev.longRatio);
      const shortRatioChange = changePercent(sig.shortRatio, prev.shortRatio);
      
      if (Math.abs(longRatioChange) > threshold || Math.abs(shortRatioChange) > threshold) {
        significantChanges.push({
          coin,
          longRatio: sig.longRatio,
          shortRatio: sig.shortRatio,
          prevLongRatio: prev.longRatio,
          prevShortRatio: prev.shortRatio,
          longRatioChange,
          shortRatioChange,
          traders: sig.tradersWithPosition,
          bias: sig.bias
        });
        
        print(`  🔔 ${coin}: 多头变化 ${longRatioChange > 0 ? '+' : ''}${longRatioChange.toFixed(1)}%`);
      }
    }
  }
  
  if (significantChanges.length > 0) {
    print(`\n📊 检测到 ${significantChanges.length} 个显著信号变化`);
    
    // Build notification message
    if (config.telegramBotToken && config.telegramChatId) {
      let msg = `🚨 <b>聪明钱信号变化</b>\n\n`;
      
      for (const change of significantChanges) {
        const direction = change.longRatioChange > 0 ? '📈 多头增加' : '📉 空头增加';
        msg += `<b>${change.coin}</b> ${direction}\n`;
        msg += `  多头: ${formatPercent(change.prevLongRatio)} → ${formatPercent(change.longRatio)} (${change.longRatioChange > 0 ? '+' : ''}${change.longRatioChange.toFixed(1)}%)\n`;
        msg += `  持仓人数: ${change.traders}\n\n`;
      }
      
      await sendTelegram(config.telegramBotToken, config.telegramChatId, msg);
      print('📱 已发送信号变化通知');
    }
  } else {
    print('✅ 无显著信号变化');
  }
  
  return significantChanges;
}
