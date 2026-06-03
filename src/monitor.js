import { okxCommand, formatCurrency, formatPercent, formatNumber, print, log, sleep, changePercent } from './utils.js';
import { updateTrader, getPositionChanges, saveState } from './state.js';
import { formatPositionChangeMessage, sendTelegram } from './notify.js';

/**
 * Monitor positions for all watched traders
 */
export async function monitorPositions(config, state) {
  const { watchlist, traders } = state;
  
  if (!watchlist || watchlist.length === 0) {
    print('⚠️  监控列表为空，请先运行 discover 命令添加交易员');
    log(config.logFile, '⚠️  Watchlist is empty');
    return null;
  }
  
  print(`👀 正在监控 ${watchlist.length} 位交易员的持仓...`);
  log(config.logFile, `🔄 Monitoring ${watchlist.length} traders`);
  
  const changes = [];
  
  for (const authorId of watchlist) {
    const trader = traders[authorId];
    const nickname = trader?.info?.nickname || trader?.info?.nickName || authorId.slice(-8);
    
    // Get current positions
    const result = okxCommand('smartmoney trader-positions', { authorId });
    
    if (!result || !result.data) {
      print(`  ⚠️  ${nickname}: 获取持仓失败`);
      continue;
    }
    
    const newPositions = Array.isArray(result.data) ? result.data : [result.data];
    const oldPositions = trader?.positions || [];
    
    // Detect changes
    const positionChanges = getPositionChanges(oldPositions, newPositions);
    
    const hasChanges = positionChanges.opened.length > 0 ||
                       positionChanges.closed.length > 0 ||
                       positionChanges.increased.length > 0 ||
                       positionChanges.decreased.length > 0;
    
    if (hasChanges) {
      print(`  🔔 ${nickname}: 检测到持仓变化!`);
      
      if (positionChanges.opened.length > 0) {
        print(`    🟢 新开仓: ${positionChanges.opened.map(p => p.instId || p.instCcy).join(', ')}`);
      }
      if (positionChanges.closed.length > 0) {
        print(`    🔴 已平仓: ${positionChanges.closed.map(p => p.instId || p.instCcy).join(', ')}`);
      }
      if (positionChanges.increased.length > 0) {
        print(`    ⬆️  加仓: ${positionChanges.increased.map(p => p.instId || p.instCcy).join(', ')}`);
      }
      if (positionChanges.decreased.length > 0) {
        print(`    ⬇️  减仓: ${positionChanges.decreased.map(p => p.instId || p.instCcy).join(', ')}`);
      }
      
      changes.push({ authorId, nickname, changes: positionChanges });
      
      // Send notification
      if (config.telegramBotToken && config.telegramChatId) {
        const msg = formatPositionChangeMessage(nickname, authorId, positionChanges);
        if (msg) {
          await sendTelegram(config.telegramBotToken, config.telegramChatId, msg);
        }
      }
      
      log(config.logFile, `🔔 ${nickname}: position changes detected`);
    } else {
      print(`  ✅ ${nickname}: 无变化 (${newPositions.length}个持仓)`);
    }
    
    // Update state
    updateTrader(state, authorId, { 
      positions: newPositions,
      lastMonitor: new Date().toISOString()
    });
  }
  
  // Save state
  state.lastMonitor = new Date().toISOString();
  saveState(state);
  
  if (changes.length > 0) {
    print(`\n📊 共检测到 ${changes.length} 位交易员的持仓变化`);
    log(config.logFile, `📊 Total: ${changes.length} traders with changes`);
  } else {
    print('\n✅ 所有交易员持仓无变化');
  }
  
  return changes;
}

/**
 * Run continuous monitoring loop
 */
export async function startMonitorLoop(config, state) {
  const intervalMs = (config.monitorInterval || 5) * 60 * 1000;
  
  print(`\n🚀 启动持续监控模式`);
  print(`   间隔: ${config.monitorInterval || 5} 分钟`);
  print(`   监控数: ${state.watchlist?.length || 0} 位交易员`);
  print('   按 Ctrl+C 停止\n');
  
  log(config.logFile, '🚀 Monitor loop started');
  
  let round = 0;
  
  while (true) {
    round++;
    print(`\n${'='.repeat(50)}`);
    print(`📍 第 ${round} 轮监控 - ${new Date().toLocaleString('zh-CN')}`);
    print(`${'='.repeat(50)}`);
    
    try {
      await monitorPositions(config, state);
    } catch (error) {
      print(`❌ 监控出错: ${error.message}`);
      log(config.logFile, `❌ Monitor error: ${error.message}`);
    }
    
    // Wait for next round
    print(`\n💤 等待 ${config.monitorInterval || 5} 分钟...`);
    await sleep(intervalMs);
  }
}
