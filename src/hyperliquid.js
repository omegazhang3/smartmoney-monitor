import { execSync } from 'child_process';
import { print, log, formatCurrency, formatNumber, formatPercent } from './utils.js';
import { sendTelegram } from './notify.js';

const HYPERLIQUID_SCRIPT = `${process.env.HOME}/.hermes/skills/blockchain/hyperliquid/scripts/hyperliquid_client.py`;

/**
 * Execute Hyperliquid client command
 */
function hyperliquidCommand(args) {
  try {
    const cmd = `python3 ${HYPERLIQUID_SCRIPT} ${args}`;
    const output = execSync(cmd, { 
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024
    });
    return output;
  } catch (error) {
    console.error(`❌ Hyperliquid command failed: ${error.message}`);
    return null;
  }
}

/**
 * Parse account state output
 */
function parseStateOutput(output) {
  if (!output) return null;
  
  const result = {
    address: null,
    positions: [],
    totalNotional: 0,
    totalUpnl: 0
  };
  
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Extract address
    const addrMatch = line.match(/0x[0-9a-fA-F]{40}/);
    if (addrMatch && !result.address) {
      result.address = addrMatch[0];
    }
    
    // Extract positions
    const posMatch = line.match(/([A-Z]+)\s+([Long|Short]+)\s+([0-9,.]+)\s+@\s+\$?([0-9,.]+)/i);
    if (posMatch) {
      result.positions.push({
        coin: posMatch[1],
        side: posMatch[2].toLowerCase(),
        size: parseFloat(posMatch[3].replace(/,/g, '')),
        entryPrice: parseFloat(posMatch[4].replace(/,/g, ''))
      });
    }
    
    // Extract total notional
    const notionalMatch = line.match(/Notional[:\s]*\$?([0-9,.]+)/i);
    if (notionalMatch) {
      result.totalNotional = parseFloat(notionalMatch[1].replace(/,/g, ''));
    }
    
    // Extract unrealized PnL
    const upnlMatch = line.match(/UPnL[:\s]*[-+]?\$?([0-9,.]+)/i);
    if (upnlMatch) {
      result.totalUpnl = parseFloat(upnlMatch[1].replace(/,/g, ''));
    }
  }
  
  return result;
}

/**
 * Parse fills output
 */
function parseFillsOutput(output) {
  if (!output) return [];
  
  const fills = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Parse fill lines
    const fillMatch = line.match(/([A-Z]+)\s+(Buy|Sell)\s+([0-9,.]+)\s+@\s+\$?([0-9,.]+)\s+Fee:\s*\$?([0-9,.]+)/i);
    if (fillMatch) {
      fills.push({
        coin: fillMatch[1],
        side: fillMatch[2].toLowerCase(),
        size: parseFloat(fillMatch[3].replace(/,/g, '')),
        price: parseFloat(fillMatch[4].replace(/,/g, '')),
        fee: parseFloat(fillMatch[5].replace(/,/g, '')),
        time: extractTime(line)
      });
    }
  }
  
  return fills;
}

/**
 * Parse review output
 */
function parseReviewOutput(output) {
  if (!output) return null;
  
  const result = {
    address: null,
    period: null,
    totalPnl: 0,
    totalFees: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    coins: [],
    insights: []
  };
  
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Extract address
    const addrMatch = line.match(/0x[0-9a-fA-F]{40}/);
    if (addrMatch && !result.address) {
      result.address = addrMatch[0];
    }
    
    // Extract period
    const periodMatch = line.match(/Period[:\s]+(.+)/i);
    if (periodMatch) result.period = periodMatch[1].trim();
    
    // Extract total PnL
    const pnlMatch = line.match(/Total PnL[:\s]*[-+]?\$?([0-9,.]+)/i);
    if (pnlMatch) result.totalPnl = parseFloat(pnlMatch[1].replace(/,/g, ''));
    
    // Extract total fees
    const feeMatch = line.match(/Total Fees[:\s]*\$?([0-9,.]+)/i);
    if (feeMatch) result.totalFees = parseFloat(feeMatch[1].replace(/,/g, ''));
    
    // Extract win/loss counts
    const winMatch = line.match(/Wins[:\s]+(\d+)/i);
    if (winMatch) result.winCount = parseInt(winMatch[1]);
    
    const lossMatch = line.match(/Losses[:\s]+(\d+)/i);
    if (lossMatch) result.lossCount = parseInt(lossMatch[1]);
    
    // Calculate win rate
    if (result.winCount + result.lossCount > 0) {
      result.winRate = result.winCount / (result.winCount + result.lossCount);
    }
    
    // Extract coin breakdown
    const coinMatch = line.match(/([A-Z]+)[:\s]+PnL\s*[-+]?\$?([0-9,.]+)/i);
    if (coinMatch) {
      result.coins.push({
        coin: coinMatch[1],
        pnl: parseFloat(coinMatch[2].replace(/,/g, ''))
      });
    }
    
    // Extract insights
    if (line.includes('⚠️') || line.includes('💡') || line.includes('🔴')) {
      result.insights.push(line.trim());
    }
  }
  
  return result;
}

/**
 * Extract time from line
 */
function extractTime(line) {
  const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (timeMatch) return timeMatch[1];
  
  const agoMatch = line.match(/(\d+)\s*(min|hour|day)s?\s*ago/i);
  if (agoMatch) {
    const num = parseInt(agoMatch[1]);
    const unit = agoMatch[2].toLowerCase();
    const now = new Date();
    if (unit === 'min') return new Date(now - num * 60000).toISOString();
    if (unit === 'hour') return new Date(now - num * 3600000).toISOString();
    if (unit === 'day') return new Date(now - num * 86400000).toISOString();
  }
  
  return null;
}

/**
 * Get Hyperliquid account state
 */
export async function getAccountState(address, config, state) {
  print(`📊 获取 Hyperliquid 账户状态: ${address.slice(0, 8)}...${address.slice(-6)}`);
  
  const output = hyperliquidCommand(`state ${address}`);
  
  if (!output) {
    print('❌ 获取账户状态失败');
    return null;
  }
  
  const account = parseStateOutput(output);
  
  if (account) {
    print(`💰 总名义价值: ${formatCurrency(account.totalNotional)}`);
    print(`📈 未实现盈亏: ${formatCurrency(account.totalUpnl)}`);
    print(`📦 持仓数: ${account.positions.length}`);
    
    if (account.positions.length > 0) {
      print('\n📋 当前持仓:');
      for (const pos of account.positions) {
        const sideEmoji = pos.side === 'long' ? '📈' : '📉';
        print(`  ${sideEmoji} ${pos.coin} ${pos.side.toUpperCase()} ${formatNumber(pos.size)} @ ${formatCurrency(pos.entryPrice)}`);
      }
    }
    
    // Update state
    if (!state.hyperliquidAccounts) state.hyperliquidAccounts = {};
    state.hyperliquidAccounts[address] = {
      ...account,
      lastUpdate: new Date().toISOString()
    };
  }
  
  return account;
}

/**
 * Get Hyperliquid fills
 */
export async function getFills(address, config, state, hours = 72) {
  print(`📜 获取 Hyperliquid 成交记录 (最近 ${hours} 小时)...`);
  
  const output = hyperliquidCommand(`fills ${address} --hours ${hours}`);
  
  if (!output) {
    print('❌ 获取成交记录失败');
    return [];
  }
  
  const fills = parseFillsOutput(output);
  
  if (fills.length > 0) {
    print(`\n📜 成交记录 (${fills.length} 笔):`);
    for (const fill of fills.slice(0, 20)) {
      const sideEmoji = fill.side === 'buy' ? '📈' : '📉';
      print(`  ${sideEmoji} ${fill.coin} ${fill.side.toUpperCase()} ${formatNumber(fill.size)} @ ${formatCurrency(fill.price)} (Fee: ${formatCurrency(fill.fee)})`);
    }
    
    if (fills.length > 20) {
      print(`  ... 还有 ${fills.length - 20} 笔`);
    }
    
    // Update state
    if (!state.hyperliquidFills) state.hyperliquidFills = {};
    state.hyperliquidFills[address] = {
      fills,
      lastUpdate: new Date().toISOString()
    };
  } else {
    print('✅ 无成交记录');
  }
  
  return fills;
}

/**
 * Generate trade review
 */
export async function generateReview(address, config, state, hours = 168) {
  print(`📊 生成 Hyperliquid 交易复盘 (最近 ${hours} 小时)...`);
  
  const output = hyperliquidCommand(`review ${address} --hours ${hours}`);
  
  if (!output) {
    print('❌ 生成复盘失败');
    return null;
  }
  
  const review = parseReviewOutput(output);
  
  if (review) {
    print(`\n📊 交易复盘:`);
    print(`  📅 周期: ${review.period || `${hours} 小时`}`);
    print(`  💰 总盈亏: ${formatCurrency(review.totalPnl)}`);
    print(`  💸 总手续费: ${formatCurrency(review.totalFees)}`);
    print(`  ✅ 胜: ${review.winCount} | ❌ 负: ${review.lossCount}`);
    print(`  📈 胜率: ${formatPercent(review.winRate)}`);
    
    if (review.coins.length > 0) {
      print(`\n📋 币种明细:`);
      for (const coin of review.coins.sort((a, b) => b.pnl - a.pnl)) {
        const emoji = coin.pnl >= 0 ? '✅' : '❌';
        print(`  ${emoji} ${coin.coin}: ${formatCurrency(coin.pnl)}`);
      }
    }
    
    if (review.insights.length > 0) {
      print(`\n💡 洞察:`);
      for (const insight of review.insights) {
        print(`  ${insight}`);
      }
    }
    
    // Update state
    if (!state.hyperliquidReviews) state.hyperliquidReviews = {};
    state.hyperliquidReviews[address] = {
      ...review,
      lastUpdate: new Date().toISOString()
    };
  }
  
  return review;
}

/**
 * Get spot balances
 */
export async function getSpotBalances(address, config, state) {
  print(`💰 获取 Hyperliquid 现货余额...`);
  
  const output = hyperliquidCommand(`spot-balances ${address}`);
  
  if (!output) {
    print('❌ 获取现货余额失败');
    return null;
  }
  
  print(output);
  
  // Update state
  if (!state.hyperliquidSpot) state.hyperliquidSpot = {};
  state.hyperliquidSpot[address] = {
    raw: output,
    lastUpdate: new Date().toISOString()
  };
  
  return output;
}

/**
 * Get market data
 */
export async function getMarkets(config, limit = 20) {
  print(`📊 获取 Hyperliquid 市场数据...`);
  
  const output = hyperliquidCommand(`markets --limit ${limit} --sort volume`);
  
  if (output) {
    print(output);
  }
  
  return output;
}

/**
 * Get funding rates
 */
export async function getFundingRates(coin, config, hours = 72) {
  print(`💰 获取 ${coin} 资金费率...`);
  
  const output = hyperliquidCommand(`funding ${coin} --hours ${hours}`);
  
  if (output) {
    print(output);
  }
  
  return output;
}
