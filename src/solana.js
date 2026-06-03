import { execSync } from 'child_process';
import { print, log, formatCurrency, formatNumber } from './utils.js';
import { sendTelegram } from './notify.js';

const SOLANA_SCRIPT = `${process.env.HOME}/.hermes/skills/blockchain/solana/scripts/solana_client.py`;

/**
 * Execute Solana client command
 */
function solanaCommand(args) {
  try {
    const cmd = `python3 ${SOLANA_SCRIPT} ${args}`;
    const output = execSync(cmd, { 
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024
    });
    return output;
  } catch (error) {
    console.error(`❌ Solana command failed: ${error.message}`);
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
    // Look for SOL transfer lines
    const match = line.match(/([0-9,.]+)\s*SOL\s*\(\$?([0-9,.]+)\)/i);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const usdValue = parseFloat(match[2].replace(/,/g, ''));
      
      // Extract addresses (base58)
      const addrMatch = line.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
      const from = addrMatch?.[0] || 'unknown';
      const to = addrMatch?.[1] || 'unknown';
      
      whales.push({
        amount,
        token: 'SOL',
        usdValue,
        from,
        to,
        chain: 'solana',
        raw: line.trim()
      });
    }
  }
  
  return whales;
}

/**
 * Parse wallet portfolio output
 */
function parseWalletOutput(output) {
  if (!output) return null;
  
  const result = {
    address: null,
    solBalance: 0,
    solUsd: 0,
    totalUsd: 0,
    tokens: [],
    nftCount: 0
  };
  
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Extract address
    const addrMatch = line.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (addrMatch && !result.address) {
      result.address = addrMatch[0];
    }
    
    // Extract SOL balance
    const solMatch = line.match(/SOL[:\s]+([0-9,.]+)\s*\(\$?([0-9,.]+)\)/i);
    if (solMatch) {
      result.solBalance = parseFloat(solMatch[1].replace(/,/g, ''));
      result.solUsd = parseFloat(solMatch[2].replace(/,/g, ''));
    }
    
    // Extract total USD value
    const totalMatch = line.match(/Total[:\s]*\$?([0-9,.]+)/i);
    if (totalMatch) {
      result.totalUsd = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
    
    // Extract token holdings
    const tokenMatch = line.match(/([A-Z]+)\s*[:\s]+([0-9,.]+)\s*\(\$?([0-9,.]+)\)/);
    if (tokenMatch && tokenMatch[1] !== 'SOL') {
      result.tokens.push({
        symbol: tokenMatch[1],
        balance: parseFloat(tokenMatch[2].replace(/,/g, '')),
        usdValue: parseFloat(tokenMatch[3].replace(/,/g, ''))
      });
    }
    
    // Extract NFT count
    const nftMatch = line.match(/NFTs?[:\s]+(\d+)/i);
    if (nftMatch) {
      result.nftCount = parseInt(nftMatch[1]);
    }
  }
  
  return result;
}

/**
 * Parse token info output
 */
function parseTokenOutput(output) {
  if (!output) return null;
  
  const result = {
    name: null,
    symbol: null,
    decimals: null,
    supply: null,
    price: null,
    marketCap: null,
    topHolders: []
  };
  
  const lines = output.split('\n');
  
  for (const line of lines) {
    const nameMatch = line.match(/Name[:\s]+(.+)/i);
    if (nameMatch) result.name = nameMatch[1].trim();
    
    const symbolMatch = line.match(/Symbol[:\s]+(.+)/i);
    if (symbolMatch) result.symbol = symbolMatch[1].trim();
    
    const decimalsMatch = line.match(/Decimals[:\s]+(\d+)/i);
    if (decimalsMatch) result.decimals = parseInt(decimalsMatch[1]);
    
    const supplyMatch = line.match(/Supply[:\s]+([0-9,.]+)/i);
    if (supplyMatch) result.supply = parseFloat(supplyMatch[1].replace(/,/g, ''));
    
    const priceMatch = line.match(/Price[:\s]*\$?([0-9,.]+)/i);
    if (priceMatch) result.price = parseFloat(priceMatch[1].replace(/,/g, ''));
    
    const mcapMatch = line.match(/Market Cap[:\s]*\$?([0-9,.]+)/i);
    if (mcapMatch) result.marketCap = parseFloat(mcapMatch[1].replace(/,/g, ''));
    
    // Parse top holders
    const holderMatch = line.match(/([1-9A-HJ-NP-Za-km-z]{32,44})\s*[:\s]+([0-9,.]+)%/);
    if (holderMatch) {
      result.topHolders.push({
        address: holderMatch[1],
        percentage: parseFloat(holderMatch[2])
      });
    }
  }
  
  return result;
}

/**
 * Detect whales on Solana
 */
export async function detectSolanaWhales(config, state) {
  const { minSol = 1000 } = config.solana || {};
  
  print('🐋 正在检测 Solana 链上巨鲸转账...');
  log(config.logFile, '🐋 Solana whale detection started');
  
  const output = solanaCommand(`whales --min-sol ${minSol}`);
  
  if (!output) {
    print('❌ Solana 巨鲸检测失败');
    return [];
  }
  
  const whales = parseWhaleOutput(output);
  
  if (whales.length === 0) {
    print('✅ 未检测到大额 SOL 转账');
    return [];
  }
  
  print(`\n🐋 检测到 ${whales.length} 笔大额 SOL 转账:\n`);
  
  for (const whale of whales.slice(0, 20)) {
    print(`☀️ Solana`);
    print(`  💰 ${formatNumber(whale.amount)} SOL (${formatCurrency(whale.usdValue)})`);
    print(`  📤 ${whale.from.slice(0, 8)}...${whale.from.slice(-6)}`);
    print(`  📥 ${whale.to.slice(0, 8)}...${whale.to.slice(-6)}`);
    print('');
  }
  
  // Save to state
  state.solanaWhales = whales;
  state.lastSolanaScan = new Date().toISOString();
  
  // Send notification for very large transfers
  const alertWhales = whales.filter(w => w.usdValue >= minSol * 5);
  if (alertWhales.length > 0 && config.telegramBotToken && config.telegramChatId) {
    let msg = `🐋 <b>Solana 巨鲸警报</b>\n\n`;
    for (const w of alertWhales.slice(0, 5)) {
      msg += `☀️ <b>Solana</b>\n`;
      msg += `💰 ${formatNumber(w.amount)} SOL (${formatCurrency(w.usdValue)})\n`;
      msg += `📤 <code>${w.from}</code>\n`;
      msg += `📥 <code>${w.to}</code>\n\n`;
    }
    await sendTelegram(config.telegramBotToken, config.telegramChatId, msg);
  }
  
  log(config.logFile, `✅ Solana whale scan: ${whales.length} transfers found`);
  
  return whales;
}

/**
 * Monitor a Solana wallet
 */
export async function monitorSolanaWallet(address, config, state) {
  print(`👀 监控 Solana 钱包: ${address.slice(0, 8)}...${address.slice(-6)}`);
  
  const output = solanaCommand(`wallet ${address}`);
  
  if (!output) {
    print('❌ 获取钱包信息失败');
    return null;
  }
  
  const wallet = parseWalletOutput(output);
  
  if (wallet) {
    print(`💰 SOL 余额: ${formatNumber(wallet.solBalance)} SOL (${formatCurrency(wallet.solUsd)})`);
    print(`💰 总资产: ${formatCurrency(wallet.totalUsd)}`);
    print(`📦 代币数: ${wallet.tokens.length}`);
    print(`🖼️  NFT 数: ${wallet.nftCount}`);
    
    // Update state
    if (!state.solanaWallets) state.solanaWallets = {};
    state.solanaWallets[address] = {
      ...wallet,
      lastUpdate: new Date().toISOString()
    };
  }
  
  return wallet;
}

/**
 * Get Solana token info
 */
export async function getTokenInfo(mintAddress, config) {
  print(`📊 获取代币信息: ${mintAddress.slice(0, 8)}...${mintAddress.slice(-6)}`);
  
  const output = solanaCommand(`token ${mintAddress}`);
  
  if (!output) {
    print('❌ 获取代币信息失败');
    return null;
  }
  
  const token = parseTokenOutput(output);
  
  if (token) {
    print(`📛 名称: ${token.name || '-'}`);
    print(`💎 符号: ${token.symbol || '-'}`);
    print(`💰 价格: ${token.price ? formatCurrency(token.price) : '-'}`);
    print(`📊 市值: ${token.marketCap ? formatCurrency(token.marketCap) : '-'}`);
    
    if (token.topHolders.length > 0) {
      print(`\n👥 Top 持仓者:`);
      for (const holder of token.topHolders.slice(0, 5)) {
        print(`  ${holder.address.slice(0, 8)}...${holder.address.slice(-6)}: ${holder.percentage.toFixed(2)}%`);
      }
    }
  }
  
  return token;
}

/**
 * Get Solana network stats
 */
export async function getSolanaStats(config) {
  print('📊 Solana 网络状态:');
  
  const output = solanaCommand('stats');
  
  if (output) {
    print(output);
  }
  
  return output;
}

/**
 * Get supported Solana tokens
 */
export function getSupportedSolanaTokens() {
  return ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'WETH', 'JTO', 'mSOL', 'stSOL', 
          'PYTH', 'HNT', 'RNDR', 'WEN', 'W', 'TNSR', 'DRIFT', 'bSOL', 'JLP', 'WIF', 'MEW', 'BOME', 'PENGU'];
}
