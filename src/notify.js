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
 * Format EVM whale alert message
 */
export function formatEvmWhaleMessage(whales) {
  if (!whales || whales.length === 0) return null;
  
  let msg = `🐋 <b>EVM 巨鲸警报</b>\n⏰ ${formatTime()}\n\n`;
  
  const chainEmojis = {
    ethereum: '⟠',
    bsc: '🔶',
    base: '🔵',
    arbitrum: '🔷',
    polygon: '🟣',
    optimism: '🔴',
    avalanche: '🔺',
    zksync: '⚡'
  };
  
  for (const whale of whales.slice(0, 5)) {
    const emoji = chainEmojis[whale.chain] || '⛓️';
    msg += `${emoji} <b>${whale.chain.toUpperCase()}</b>\n`;
    msg += `💰 ${formatNumber(whale.amount)} ${whale.token} (${formatCurrency(whale.usdValue)})\n`;
    msg += `📤 <code>${whale.from}</code>\n`;
    msg += `📥 <code>${whale.to}</code>\n\n`;
  }
  
  if (whales.length > 5) {
    msg += `... 还有 ${whales.length - 5} 笔转账\n`;
  }
  
  return msg;
}

/**
 * Format Solana whale alert message
 */
export function formatSolanaWhaleMessage(whales) {
  if (!whales || whales.length === 0) return null;
  
  let msg = `🐋 <b>Solana 巨鲸警报</b>\n⏰ ${formatTime()}\n\n`;
  
  for (const whale of whales.slice(0, 5)) {
    msg += `☀️ <b>Solana</b>\n`;
    msg += `💰 ${formatNumber(whale.amount)} SOL (${formatCurrency(whale.usdValue)})\n`;
    msg += `📤 <code>${whale.from}</code>\n`;
    msg += `📥 <code>${whale.to}</code>\n\n`;
  }
  
  if (whales.length > 5) {
    msg += `... 还有 ${whales.length - 5} 笔转账\n`;
  }
  
  return msg;
}

/**
 * Format Hyperliquid account update message
 */
export function formatHyperliquidAccountMessage(address, account) {
  if (!account) return null;
  
  let msg = `📊 <b>Hyperliquid 账户更新</b>\n`;
  msg += `⏰ ${formatTime()}\n`;
  msg += `🆔 <code>${address}</code>\n\n`;
  
  msg += `💰 总名义价值: ${formatCurrency(account.totalNotional)}\n`;
  msg += `📈 未实现盈亏: ${formatCurrency(account.totalUpnl)}\n`;
  msg += `📦 持仓数: ${account.positions.length}\n\n`;
  
  if (account.positions.length > 0) {
    msg += `<b>当前持仓:</b>\n`;
    for (const pos of account.positions) {
      const sideEmoji = pos.side === 'long' ? '📈' : '📉';
      msg += `${sideEmoji} ${pos.coin} ${pos.side.toUpperCase()} ${formatNumber(pos.size)} @ ${formatCurrency(pos.entryPrice)}\n`;
    }
  }
  
  return msg;
}

/**
 * Format Hyperliquid review message
 */
export function formatHyperliquidReviewMessage(address, review) {
  if (!review) return null;
  
  let msg = `📊 <b>Hyperliquid 交易复盘</b>\n`;
  msg += `⏰ ${formatTime()}\n`;
  msg += `🆔 <code>${address}</code>\n\n`;
  
  msg += `📅 周期: ${review.period || '-'}\n`;
  msg += `💰 总盈亏: ${formatCurrency(review.totalPnl)}\n`;
  msg += `💸 总手续费: ${formatCurrency(review.totalFees)}\n`;
  msg += `✅ 胜: ${review.winCount} | ❌ 负: ${review.lossCount}\n`;
  msg += `📈 胜率: ${formatPercent(review.winRate)}\n\n`;
  
  if (review.coins.length > 0) {
    msg += `<b>币种明细:</b>\n`;
    for (const coin of review.coins.sort((a, b) => b.pnl - a.pnl).slice(0, 5)) {
      const emoji = coin.pnl >= 0 ? '✅' : '❌';
      msg += `${emoji} ${coin.coin}: ${formatCurrency(coin.pnl)}\n`;
    }
  }
  
  if (review.insights.length > 0) {
    msg += `\n<b>💡 洞察:</b>\n`;
    for (const insight of review.insights.slice(0, 3)) {
      msg += `${insight}\n`;
    }
  }
  
  return msg;
}

/**
 * Format multi-chain wallet update message
 */
export function formatWalletUpdateMessage(address, chain, oldBalance, newBalance) {
  const change = newBalance - oldBalance;
  const changePercent = oldBalance > 0 ? (change / oldBalance * 100) : 0;
  
  const chainEmojis = {
    ethereum: '⟠',
    bsc: '🔶',
    base: '🔵',
    arbitrum: '🔷',
    polygon: '🟣',
    optimism: '🔴',
    avalanche: '🔺',
    zksync: '⚡',
    solana: '☀️',
    hyperliquid: '⚡'
  };
  
  const emoji = chainEmojis[chain] || '⛓️';
  
  let msg = `👛 <b>钱包余额变化</b>\n`;
  msg += `⏰ ${formatTime()}\n`;
  msg += `${emoji} ${chain.toUpperCase()}\n`;
  msg += `🆔 <code>${address}</code>\n\n`;
  
  msg += `💰 余额: ${formatCurrency(oldBalance)} → ${formatCurrency(newBalance)}\n`;
  msg += `📊 变化: ${change >= 0 ? '+' : ''}${formatCurrency(change)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)\n`;
  
  return msg;
}

/**
 * Format error message
 */
export function formatErrorMessage(context, error) {
  return `❌ <b>错误</b>\n⏰ ${formatTime()}\n📋 ${context}\n💬 ${error}`;
}
