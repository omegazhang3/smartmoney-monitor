import fs from 'fs';
import path from 'path';

const STATE_DIR = './data';
const STATE_FILE = path.join(STATE_DIR, 'state.json');

/**
 * Load persisted state
 */
export function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('⚠️  Failed to load state:', error.message);
  }
  
  return {
    // OKX Smart Money
    traders: {},        // { authorId: { info, positions, lastUpdate } }
    signals: {},        // { instCcy: { overview, trend, lastUpdate } }
    watchlist: [],      // [ authorId, ... ]
    lastDiscovery: null,
    lastMonitor: null,
    
    // EVM
    evmWhales: [],
    evmWallets: {},     // { address: { portfolio, lastUpdate } }
    lastEvmScan: null,
    
    // Solana
    solanaWhales: [],
    solanaWallets: {},  // { address: { portfolio, lastUpdate } }
    lastSolanaScan: null,
    
    // Hyperliquid
    hyperliquidAccounts: {},  // { address: { state, lastUpdate } }
    hyperliquidFills: {},     // { address: { fills, lastUpdate } }
    hyperliquidReviews: {},   // { address: { review, lastUpdate } }
    hyperliquidSpot: {},      // { address: { balances, lastUpdate } }
    
    // Wallet watchlist (multi-chain)
    walletWatchlist: []  // { address, chain, label }
  };
}

/**
 * Save state to file
 */
export function saveState(state) {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('❌ Failed to save state:', error.message);
  }
}

/**
 * Update trader data in state
 */
export function updateTrader(state, authorId, data) {
  if (!state.traders[authorId]) {
    state.traders[authorId] = {
      info: {},
      positions: [],
      positionHistory: [],
      lastUpdate: null
    };
  }
  
  Object.assign(state.traders[authorId], data, {
    lastUpdate: new Date().toISOString()
  });
  
  return state;
}

/**
 * Add trader to watchlist
 */
export function addToWatchlist(state, authorId) {
  if (!state.watchlist.includes(authorId)) {
    state.watchlist.push(authorId);
  }
  return state;
}

/**
 * Remove trader from watchlist
 */
export function removeFromWatchlist(state, authorId) {
  state.watchlist = state.watchlist.filter(id => id !== authorId);
  return state;
}

/**
 * Add wallet to watchlist (multi-chain)
 */
export function addWalletToWatchlist(state, address, chain, label = '') {
  if (!state.walletWatchlist) state.walletWatchlist = [];
  
  const exists = state.walletWatchlist.find(w => w.address === address && w.chain === chain);
  if (!exists) {
    state.walletWatchlist.push({
      address,
      chain,
      label: label || `${address.slice(0, 8)}...${address.slice(-6)}`,
      addedAt: new Date().toISOString()
    });
  }
  return state;
}

/**
 * Remove wallet from watchlist
 */
export function removeWalletFromWatchlist(state, address, chain) {
  if (!state.walletWatchlist) state.walletWatchlist = [];
  state.walletWatchlist = state.walletWatchlist.filter(w => !(w.address === address && w.chain === chain));
  return state;
}

/**
 * Get position changes between old and new
 */
export function getPositionChanges(oldPositions, newPositions) {
  const changes = {
    opened: [],     // 新开仓
    closed: [],     // 已平仓
    increased: [],  // 加仓
    decreased: [],  // 减仓
    unchanged: []   // 未变化
  };
  
  const oldMap = new Map();
  if (oldPositions) {
    for (const pos of oldPositions) {
      const key = pos.instId || pos.instCcy;
      oldMap.set(key, pos);
    }
  }
  
  const newMap = new Map();
  if (newPositions) {
    for (const pos of newPositions) {
      const key = pos.instId || pos.instCcy;
      newMap.set(key, pos);
    }
  }
  
  // Check for closed positions
  for (const [key, oldPos] of oldMap) {
    if (!newMap.has(key)) {
      changes.closed.push(oldPos);
    }
  }
  
  // Check for new and changed positions
  for (const [key, newPos] of newMap) {
    if (!oldMap.has(key)) {
      changes.opened.push(newPos);
    } else {
      const oldPos = oldMap.get(key);
      const oldSize = Math.abs(Number(oldPos.sz || oldPos.pos || 0));
      const newSize = Math.abs(Number(newPos.sz || newPos.pos || 0));
      
      if (newSize > oldSize) {
        changes.increased.push({ ...newPos, prevSize: oldSize, change: newSize - oldSize });
      } else if (newSize < oldSize) {
        changes.decreased.push({ ...newPos, prevSize: oldSize, change: newSize - oldSize });
      } else {
        changes.unchanged.push(newPos);
      }
    }
  }
  
  return changes;
}

/**
 * Export watchlist to file
 */
export function exportWatchlist(state, filePath) {
  const data = state.watchlist.map(id => {
    const trader = state.traders[id];
    return {
      authorId: id,
      nickname: trader?.info?.nickname || trader?.info?.nickName || '-',
      pnl: trader?.info?.pnl || '-',
      winRate: trader?.info?.winRate || '-',
      addedAt: trader?.lastUpdate || '-'
    };
  });
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}
