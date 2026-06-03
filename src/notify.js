import { formatTime, formatNumber, formatCurrency, formatPercent } from './utils.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Send Telegram notification
 */
export async function sendTelegram(botToken, chatId, message, silent = false) {
  if (!botToken || !chatId) {
    console.log('⚠️  Telegram not configured, skipping notification');
    return false;
  }
  
  try {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_notification: silent,
        disable_web_page_preview: true
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('❌ Telegram send failed:', result.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
    return false;
  }
}

/**
 * Format trader discovery message
 */
export function formatDiscoveryMessage(traders) {
  if (!traders || traders.length === 0) return null;
  
  let msg = `🔍 <b>聪明钱发现</b> (${formatTime()})\n\n`;
  
  for (let i = 0; i < Math.min(traders.length, 10); i++) {
    const t = traders[i];
    const rank = i + 1;
    const pnl = formatCurrency(t.pnl);
    const winRate = formatPercent(t.winRate);
    const nickname = t.nickname || t.nickName || `Trader-${t.authorId?.slice(-6)}`;
    
    msg += `${rank}. <b>${nickname}</b>\n`;
    msg += `   💰 PnL: ${pnl} | 胜率: ${winRate}\n`;
    msg += `   🆔 <code>${t.authorId}</code>\n\n`;
  }
  
  if (traders.length > 10) {
    msg += `... 还有 ${traders.length - 10} 位交易员\n`;
  }
  
  return msg;
}

/**
 * Format position change message
 */
export function formatPositionChangeMessage(traderName, authorId, changes) {
  const hasChanges = changes.opened.length > 0 || 
                     changes.closed.length > 0 || 
                     changes.increased.length > 0 || 
                     changes.decreased.length > 0;
  
  if (!hasChanges) return null;
  
  let msg = `📊 <b>持仓变动</b> - ${traderName}\n`;
  msg += `⏰ ${formatTime()}\n\n`;
  
  if (changes.opened.length > 0) {
    msg += `🟢 <b>新开仓</b>\n`;
    for (const pos of changes.opened) {
      const inst = pos.instId || pos.instCcy;
      const side = pos.posSide === 'long' ? '📈' : pos.posSide === 'short' ? '📉' : '↔️';
      const size = formatNumber(Math.abs(Number(pos.sz || pos.pos || 0)));
      const avgPx = pos.avgPx ? `@${formatNumber(pos.avgPx)}` : '';
      msg += `  ${side} ${inst} ${size}张 ${avgPx}\n`;
    }
    msg += '\n';
  }
  
  if (changes.closed.length > 0) {
    msg += `🔴 <b>已平仓</b>\n`;
    for (const pos of changes.closed) {
      const inst = pos.instId || pos.instCcy;
      const side = pos.posSide === 'long' ? '📈' : pos.posSide === 'short' ? '📉' : '↔️';
      const size = formatNumber(Math.abs(Number(pos.sz || pos.pos || 0)));
      msg += `  ${side} ${inst} ${size}张\n`;
    }
    msg += '\n';
  }
  
  if (changes.increased.length > 0) {
    msg += `⬆️ <b>加仓</b>\n`;
    for (const pos of changes.increased) {
      const inst = pos.instId || pos.instCcy;
      const size = formatNumber(Math.abs(Number(pos.change)));
      msg += `  📈 ${inst} +${size}张\n`;
    }
    msg += '\n';
  }
  
  if (changes.decreased.length > 0) {
    msg += `⬇️ <b>减仓</b>\n`;
    for (const pos of changes.decreased) {
      const inst = pos.instId || pos.instCcy;
      const size = formatNumber(Math.abs(Number(pos.change)));
      msg += `  📉 ${inst} -${size}张\n`;
    }
    msg += '\n';
  }
  
  return msg;
}

/**
 * Format signal overview message
 */
export function formatSignalMessage(signals) {
  if (!signals || signals.length === 0) return null;
  
  let msg = `🧠 <b>聪明钱信号</b> (${formatTime()})\n\n`;
  
  for (const sig of signals) {
    const coin = sig.instCcy || '?';
    const longRatio = sig.longRatio != null ? formatPercent(sig.longRatio) : '-';
    const shortRatio = sig.shortRatio != null ? formatPercent(sig.shortRatio) : '-';
    const traders = sig.tradersWithPosition || 0;
    const longNotional = sig.longNotional ? formatCurrency(sig.longNotional) : '-';
    const shortNotional = sig.shortNotional ? formatCurrency(sig.shortNotional) : '-';
    
    // Determine bias
    let bias = '⚖️';
    if (sig.longRatio > 0.6) bias = '🟢 多头偏重';
    else if (sig.shortRatio > 0.6) bias = '🔴 空头偏重';
    else bias = '⚖️ 多空均衡';
    
    msg += `<b>${coin}</b> ${bias}\n`;
    msg += `  👥 持仓人数: ${traders}\n`;
    msg += `  📈 多头: ${longRatio} (${longNotional})\n`;
    msg += `  📉 空头: ${shortRatio} (${shortNotional})\n\n`;
  }
  
  return msg;
}

/**
 * Format error message
 */
export function formatErrorMessage(context, error) {
  return `❌ <b>错误</b>\n⏰ ${formatTime()}\n📋 ${context}\n💬 ${error}`;
}
