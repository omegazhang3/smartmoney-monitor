import { execSync } from 'child_process';
import { print, log, formatCurrency, formatNumber } from './utils.js';
import { sendTelegram } from './notify.js';

const EVM_SCRIPT = `${process.env.HOME}/.hermes/skills/blockchain/evm/scripts/evm_client.py`;

/**
 * Execute EVM client command
 */
function evmCommand(args) {
  try {
    const cmd = `python3 ${EVM_SCRIPT} ${args}`;
    const output = execSync(cmd, { 
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024
    });
    return output;
  } catch (error) {
    console.error(`❌ EVM command failed: ${error.message}`);
    return null;
  }
}

/**
 * Parse whale detection output
 */
function parseWhaleOutput(output) {
  if (!output) return [];
  
  const whales = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Look for transfer lines with amounts
    const match = line.match(/([0-9,.]+)\s*(ETH|BNB|POL|AVAX|ETH)\s*\(\$?([0-9,.]+)\)/i);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const token = match[2];
      const usdValue = parseFloat(match[3].replace(/,/g, ''));
      
      // Extract addresses if present
      const addrMatch = line.match(/0x[0-9a-fA-F]{40}/g);
      const from = addrMatch?.[0] || 'unknown';
      const to = addrMatch?.[1] || 'unknown';
      
      whales.push({
        amount,
        token,
        usdValue,
        from,
        to,
        chain: detectChain(line),
        raw: line.trim()
      });
    }
  }
  
  return whales;
}

/**
 * Detect chain from output line
 */
function detectChain(line) {
  const lower = line.toLowerCase();
  if (lower.includes('ethereum') || lower.includes('eth mainnet')) return 'ethereum';
  if (lower.includes('bsc') || lower.includes('bnb')) return 'bsc';
  if (lower.includes('base')) return 'base';
  if (lower.includes('arbitrum') || lower.includes('arb')) return 'arbitrum';
  if (lower.includes('polygon') || lower.includes('pol')) return 'polygon';
  if (lower.includes('optimism') || lower.includes('op')) return 'optimism';
  if (lower.includes('avalanche') || lower.includes('avax')) return 'avalanche';
  if (lower.includes('zksync')) return 'zksync';
  return 'ethereum'; // default
}

/**
 * Parse wallet portfolio output
 */
function parseWalletOutput(output) {
  if (!output) return null;
  
  const result = {
    address: null,
    totalUsd: 0,
    tokens: [],
    chains: {}
  };
  
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Extract address
    const addrMatch = line.match(/0x[0-9a-fA-F]{40}/);
    if (addrMatch && !result.address) {
      result.address = addrMatch[0];
    }
    
    // Extract total USD value
    const totalMatch = line.match(/Total[:\s]*\$?([0-9,.]+)/i);
    if (totalMatch) {
      result.totalUsd = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
    
    // Extract token holdings
    const tokenMatch = line.match(/([A-Z]+)\s*[:\s]+([0-9,.]+)\s*\(\$?([0-9,.]+)\)/);
    if (tokenMatch) {
      result.tokens.push({
        symbol: tokenMatch[1],
        balance: parseFloat(tokenMatch[2].replace(/,/g, '')),
        usdValue: parseFloat(tokenMatch[3].replace(/,/g, ''))
      });
    }
  }
  
  return result;
}

/**
 * Detect whales on EVM chains
 */
export async function detectEvmWhales(config, state) {
  const { 
    minUsd = 100000, 
    blocks = 20, 
    chain = null 
  } = config.evm || {};
  
  print('🐋 正在检测 EVM 链上巨鲸转账...');
  log(config.logFile, '🐋 EVM whale detection started');
  
  let args = `whale --blocks ${blocks} --min-usd ${minUsd}`;
  if (chain) args += ` --chain ${chain}`;
  
  const output = evmCommand(args);
  
  if (!output) {
    print('❌ EVM 巨鲸检测失败');
    return [];
  }
  
  const whales = parseWhaleOutput(output);
  
  if (whales.length === 0) {
    print('✅ 未检测到大额转账');
    return [];
  }
  
  print(`\n🐋 检测到 ${whales.length} 笔大额转账:\n`);
  
  for (const whale of whales.slice(0, 20)) {
    const chainEmoji = getChainEmoji(whale.chain);
    print(`${chainEmoji} ${whale.chain.toUpperCase()}`);
    print(`  💰 ${formatNumber(whale.amount)} ${whale.token} (${formatCurrency(whale.usdValue)})`);
    print(`  📤 ${whale.from.slice(0, 8)}...${whale.from.slice(-6)}`);
    print(`  📥 ${whale.to.slice(0, 8)}...${whale.to.slice(-6)}`);
    print('');
  }
  
  // Save to state
  state.evmWhales = whales;
  state.lastEvmScan = new Date().toISOString();
  
  // Send notification for very large transfers
  const alertWhales = whales.filter(w => w.usdValue >= minUsd * 5);
  if (alertWhales.length > 0 && config.telegramBotToken && config.telegramChatId) {
    let msg = `🐋 <b>EVM 巨鲸警报</b>\n\n`;
    for (const w of alertWhales.slice(0, 5)) {
      msg += `${getChainEmoji(w.chain)} <b>${w.chain.toUpperCase()}</b>\n`;
      msg += `💰 ${formatNumber(w.amount)} ${w.token} (${formatCurrency(w.usdValue)})\n`;
      msg += `📤 <code>${w.from}</code>\n`;
      msg += `📥 <code>${w.to}</code>\n\n`;
    }
    await sendTelegram(config.telegramBotToken, config.telegramChatId, msg);
  }
  
  log(config.logFile, `✅ EVM whale scan: ${whales.length} transfers found`);
  
  return whales;
}

/**
 * Monitor an EVM wallet
 */
export async function monitorEvmWallet(address, config, state) {
  print(`👀 监控 EVM 钱包: ${address.slice(0, 8)}...${address.slice(-6)}`);
  
  const output = evmCommand(`wallet ${address}`);
  
  if (!output) {
    print('❌ 获取钱包信息失败');
    return null;
  }
  
  const wallet = parseWalletOutput(output);
  
  if (wallet) {
    print(`💰 总资产: ${formatCurrency(wallet.totalUsd)}`);
    print(`📦 代币数: ${wallet.tokens.length}`);
    
    // Update state
    if (!state.evmWallets) state.evmWallets = {};
    state.evmWallets[address] = {
      ...wallet,
      lastUpdate: new Date().toISOString()
    };
  }
  
  return wallet;
}

/**
 * Scan wallet across all chains
 */
export async function multichainScan(address, config, state) {
  print(`🌐 多链扫描: ${address.slice(0, 8)}...${address.slice(-6)}`);
  
  const output = evmCommand(`multichain ${address}`);
  
  if (!output) {
    print('❌ 多链扫描失败');
    return null;
  }
  
  print(output);
  
  // Update state
  if (!state.evmWallets) state.evmWallets = {};
  state.evmWallets[address] = {
    address,
    lastMultichain: new Date().toISOString(),
    raw: output
  };
  
  return output;
}

/**
 * Get chain emoji
 */
function getChainEmoji(chain) {
  const emojis = {
    ethereum: '⟠',
    bsc: '🔶',
    base: '🔵',
    arbitrum: '🔷',
    polygon: '🟣',
    optimism: '🔴',
    avalanche: '🔺',
    zksync: '⚡'
  };
  return emojis[chain] || '⛓️';
}

/**
 * Get supported chains info
 */
export function getSupportedChains() {
  return [
    { key: 'ethereum', name: 'Ethereum', symbol: 'ETH', chainId: 1 },
    { key: 'bsc', name: 'BNB Chain', symbol: 'BNB', chainId: 56 },
    { key: 'base', name: 'Base', symbol: 'ETH', chainId: 8453 },
    { key: 'arbitrum', name: 'Arbitrum One', symbol: 'ETH', chainId: 42161 },
    { key: 'polygon', name: 'Polygon', symbol: 'POL', chainId: 137 },
    { key: 'optimism', name: 'Optimism', symbol: 'ETH', chainId: 10 },
    { key: 'avalanche', name: 'Avalanche C', symbol: 'AVAX', chainId: 43114 },
    { key: 'zksync', name: 'zkSync Era', symbol: 'ETH', chainId: 324 }
  ];
}
