/* ============================================================
   AuditLog — script.js
   Blockchain TX Explorer & Validator (Vanilla JS + localStorage)
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────
const State = {
  parsedData:   null,
  rawInput:     '',
  parseCount:   Number(localStorage.getItem('al_parse_count') || 0),
  theme:        localStorage.getItem('al_theme') || 'dark',
  snippets:     JSON.parse(localStorage.getItem('al_snippets') || '[]'),
};

// ─────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function toast(msg, type = 'success') {
  const t = $('toast');
  const colors = {
    success: 'bg-dark-700 border-brand-500 text-brand-300',
    error:   'bg-dark-700 border-red-500   text-red-300',
    info:    'bg-dark-700 border-blue-500  text-blue-300',
    warn:    'bg-dark-700 border-yellow-500 text-yellow-300',
  };
  t.className = `fixed bottom-6 right-6 z-50 max-w-xs px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${colors[type]}`;
  t.textContent = msg;
  t.classList.remove('hide');
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.classList.add('hide'); }, 2800);
}

function copyToClipboard(text, label = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => toast(`✓ ${label}`, 'success')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast(`✓ ${label}`, 'success');
  });
}

function shortAddr(addr) {
  if (typeof addr !== 'string') return addr;
  if (addr.startsWith('0x') && addr.length === 42) return addr.slice(0,6) + '…' + addr.slice(-4);
  return addr;
}

function weiToEth(wei) {
  if (!wei) return '0';
  const n = BigInt(wei);
  const eth = Number(n) / 1e18;
  return eth.toFixed(6) + ' ETH';
}

function hexToDecimal(hex) {
  try { return BigInt(hex).toString(10); } catch { return hex; }
}

function timestampToHuman(ts) {
  if (!ts) return '—';
  const n = typeof ts === 'string' && ts.startsWith('0x') ? parseInt(ts, 16) : Number(ts);
  return new Date(n * 1000).toLocaleString();
}

function detectInputType(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'JSON';
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return 'HEX';
  return 'UNKNOWN';
}

function saveState() {
  localStorage.setItem('al_parse_count', State.parseCount);
  localStorage.setItem('al_snippets',    JSON.stringify(State.snippets));
  localStorage.setItem('al_theme',       State.theme);
}

// ─────────────────────────────────────────────────────────
// EXAMPLE PAYLOADS  (real-world addresses + calldata)
// ─────────────────────────────────────────────────────────

/* ── Label metadata shown in the sidebar ── */
const EXAMPLE_META = {
  'erc20-transfer': { sub: 'USDC · 2,000 USDC · 1 event',         network: 'Ethereum Mainnet' },
  'uniswap-swap':   { sub: '1 ETH → USDC · V2 Router · 3 events', network: 'Ethereum Mainnet' },
  'nft-mint':       { sub: 'BAYC · 0.01 ETH · tokenId #420',       network: 'Ethereum Mainnet' },
  'hex-calldata':   { sub: 'transfer() · 68 bytes · USDC',         network: 'Raw Calldata' },
  'event-log':      { sub: 'USDC Transfer · 2 indexed topics',     network: 'Ethereum Mainnet' },
};

const EXAMPLES = {
  /* ──────────────────────────────────────────────────────
     ERC-20: 2,000 USDC transfer
     From: Vitalik (0xd8dA…)  →  USDC contract (0xA0b8…)
     Method: transfer(address to, uint256 amount)
     Selector: 0xa9059cbb
  ────────────────────────────────────────────────────── */
  'erc20-transfer': JSON.stringify({
    hash:        '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060',
    blockNumber: '0x11a2b3',
    blockHash:   '0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6',
    from:        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    to:          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    value:       '0x0',
    gas:         '0x186a0',
    gasPrice:    '0x6FC23AC00',
    gasUsed:     '0xEA60',
    nonce:       '0x2a',
    input:       '0xa9059cbb000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000000000077359400',
    status:      '0x1',
    timestamp:   '1709211600',
    logs: [
      {
        address:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          '0x000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b'
        ],
        data:      '0x0000000000000000000000000000000000000000000000000000000077359400',
        logIndex:  '0x0',
        eventName: 'Transfer(address indexed from, address indexed to, uint256 value)',
      }
    ]
  }, null, 2),

  /* ──────────────────────────────────────────────────────
     Uniswap V2: 1 ETH → ~2,000 USDC
     Router: 0x7a25…  (official Uniswap V2 Router)
     Path: WETH (0xC02a…) → USDC (0xA0b8…)
     Events: WETH Deposit, USDC Transfer, Pair Swap
  ────────────────────────────────────────────────────── */
  'uniswap-swap': JSON.stringify({
    hash:        '0x7a250d5630b4cf539739df2c5dacb4c659f2488d000000000000000000000001',
    blockNumber: '0x11a2c0',
    blockHash:   '0x9b8ccc4e6e6cd9cf9b1ce4ecd3d3a91db2e3c3b5e5f6a7b8c9d0e1f2a3b4c5d6',
    from:        '0x742d35Cc6634C0532925a3b8D4C9E4A2B1F3D8E9',
    to:          '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    value:       '0xDE0B6B3A7640000',
    gas:         '0x493e0',
    gasPrice:    '0x9502F9000',
    gasUsed:     '0x2b3f8',
    nonce:       '0x7',
    status:      '0x1',
    timestamp:   '1709215200',
    input:       '0x7ff36ab500000000000000000000000000000000000000000000000000000000773594000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000742d35cc6634c0532925a3b8d4c9e4a2b1f3d8e900000000000000000000000000000000000000000000000000000000660f92a00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decodedInput: {
      amountOutMin: '2000000000',
      path:         ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)'],
      to:           '0x742d35Cc6634C0532925a3b8D4C9E4A2B1F3D8E9',
      deadline:     '1712000672'
    },
    logs: [
      {
        address:   '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        topics: [
          '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
          '0x0000000000000000000000007a250d5630B4cF539739dF2C5dAcb4c659F2488D'
        ],
        data:      '0x0000000000000000000000000000000000000000000000000DE0B6B3A7640000',
        logIndex:  '0x0',
        eventName: 'Deposit(address indexed dst, uint256 wad)',
      },
      {
        address:   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x000000000000000000000000B4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
          '0x000000000000000000000000742d35Cc6634C0532925a3b8D4C9E4A2B1F3D8E9'
        ],
        data:      '0x0000000000000000000000000000000000000000000000000000000077359400',
        logIndex:  '0x1',
        eventName: 'Transfer(address indexed from, address indexed to, uint256 value)',
      },
      {
        address:   '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
        topics: [
          '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
          '0x0000000000000000000000007a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          '0x000000000000000000000000742d35Cc6634C0532925a3b8D4C9E4A2B1F3D8E9'
        ],
        data:      '0x0000000000000000000000000000000000000000000000000DE0B6B3A764000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000077359400',
        logIndex:  '0x2',
        eventName: 'Swap(address,uint256,uint256,uint256,uint256,address)',
      }
    ]
  }, null, 2),

  /* ──────────────────────────────────────────────────────
     NFT Mint: Bored Ape Yacht Club — tokenId #420
     Contract: 0xBC4C… (real BAYC contract address)
     Method: mint(address to)  →  Selector 0x6a627842
     Mint price: 0.01 ETH (demo, original was 0.08 ETH)
     ERC-721 Transfer from address(0) indicates a mint
  ────────────────────────────────────────────────────── */
  'nft-mint': JSON.stringify({
    hash:        '0x3c9229289a9b1f6e8e0a6e9f2d3c1b4a5e8f0d2a4b6c8e1d3f5a7c9b1d3e5f7a',
    blockNumber: '0x10d4f3',
    blockHash:   '0xcafe1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
    from:        '0x1A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b',
    to:          '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    value:       '0x2386F26FC10000',
    gas:         '0x30d40',
    gasPrice:    '0x4A817C800',
    gasUsed:     '0x1d4c0',
    nonce:       '0x15',
    status:      '0x1',
    timestamp:   '1709218800',
    input:       '0x6a6278420000000000000000000000001A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b',
    decodedInput: {
      to: '0x1A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b'
    },
    logs: [
      {
        address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000001A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b',
          '0x00000000000000000000000000000000000000000000000000000000000001A4'
        ],
        data:      '0x',
        logIndex:  '0x0',
        eventName: 'Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
      }
    ]
  }, null, 2),

  /* ──────────────────────────────────────────────────────
     Raw Hex Calldata: USDC transfer(address,uint256)
     Selector  : 0xa9059cbb
     Recipient : 0xab58…9b  (Vitalik's donation addr)
     Amount    : 0x77359400 = 2,000,000,000 = 2,000 USDC
                 (USDC has 6 decimals)
  ────────────────────────────────────────────────────── */
  'hex-calldata': '0xa9059cbb000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000000000077359400',

  /* ──────────────────────────────────────────────────────
     Standalone Event Log: USDC Transfer
     Contract : 0xA0b8… (USDC on Ethereum Mainnet)
     Event    : Transfer(address indexed from, address indexed to, uint256 value)
     topic[0] : keccak256("Transfer(address,address,uint256)")
     topic[1] : from  — Vitalik (0xd8dA…)
     topic[2] : to    — donation address (0xab58…)
     data     : 0x77359400 = 2,000 USDC
  ────────────────────────────────────────────────────── */
  'event-log': JSON.stringify({
    address:          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    blockNumber:      '0x11a2c0',
    blockHash:        '0x9b8ccc4e6e6cd9cf9b1ce4ecd3d3a91db2e3c3b5e5f6a7b8c9d0e1f2a3b4c5d6',
    transactionHash:  '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060',
    transactionIndex: '0x1',
    logIndex:         '0x4',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '0x000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b'
    ],
    data:    '0x0000000000000000000000000000000000000000000000000000000077359400',
    removed: false
  }, null, 2),
};

// ─────────────────────────────────────────────────────────
// KNOWN METHOD / EVENT SIGNATURES
// ─────────────────────────────────────────────────────────
const METHOD_SIGS = {
  'a9059cbb': { name: 'transfer',                 sig: 'transfer(address,uint256)',                    params: ['to','amount'] },
  '23b872dd': { name: 'transferFrom',             sig: 'transferFrom(address,address,uint256)',        params: ['from','to','amount'] },
  '095ea7b3': { name: 'approve',                  sig: 'approve(address,uint256)',                     params: ['spender','amount'] },
  '70a08231': { name: 'balanceOf',                sig: 'balanceOf(address)',                           params: ['account'] },
  '18160ddd': { name: 'totalSupply',              sig: 'totalSupply()',                                params: [] },
  '7ff36ab5': { name: 'swapExactETHForTokens',    sig: 'swapExactETHForTokens(uint256,address[],address,uint256)', params: ['amountOutMin','path','to','deadline'] },
  '38ed1739': { name: 'swapExactTokensForTokens', sig: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)', params: ['amountIn','amountOutMin','path','to','deadline'] },
  '6a627842': { name: 'mint',                     sig: 'mint(address)',                               params: ['to'] },
  'd0e30db0': { name: 'deposit',                  sig: 'deposit()',                                   params: [] },
  '2e1a7d4d': { name: 'withdraw',                 sig: 'withdraw(uint256)',                           params: ['wad'] },
  'a22cb465': { name: 'setApprovalForAll',        sig: 'setApprovalForAll(address,bool)',             params: ['operator','approved'] },
  '42842e0e': { name: 'safeTransferFrom',         sig: 'safeTransferFrom(address,address,uint256)',   params: ['from','to','tokenId'] },
};

const EVENT_SIGS = {
  'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': { name: 'Transfer',        params: ['from (indexed)','to (indexed)','value'] },
  '8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': { name: 'Approval',        params: ['owner (indexed)','spender (indexed)','value'] },
  'e1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c': { name: 'Deposit',         params: ['dst (indexed)','wad'] },
  '7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65': { name: 'Withdrawal',      params: ['src (indexed)','wad'] },
  '1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': { name: 'Sync',            params: ['reserve0','reserve1'] },
  'd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': { name: 'Swap',            params: ['sender (indexed)','amount0In','amount1In','amount0Out','amount1Out','to (indexed)'] },
};

// ─────────────────────────────────────────────────────────
// PARSER ENGINE
// ─────────────────────────────────────────────────────────
function parsePayload(raw) {
  const type = detectInputType(raw);

  if (type === 'HEX') {
    return parseHexCalldata(raw.trim());
  }
  if (type === 'JSON') {
    try {
      const obj = JSON.parse(raw);
      return parseJSON(obj);
    } catch (e) {
      throw new Error('Invalid JSON: ' + e.message);
    }
  }
  throw new Error('Unrecognized format. Paste JSON or a 0x-prefixed hex string.');
}

function parseHexCalldata(hex) {
  const selector = hex.slice(2, 10).toLowerCase();
  const method   = METHOD_SIGS[selector];
  const result = {
    _type:    'HEX_CALLDATA',
    selector: '0x' + selector,
    method:   method ? method.sig : 'Unknown Method',
    calldataLength: Math.floor((hex.length - 2) / 2) + ' bytes',
    rawData:  hex,
    decoded:  {},
    logs:     [],
    flowSteps: [],
  };

  if (method) {
    const paramData = hex.slice(10);
    const chunks = paramData.match(/.{1,64}/g) || [];
    method.params.forEach((p, i) => {
      const chunk = chunks[i] || '';
      result.decoded[p] = decodeChunk(chunk, p);
    });
    result.flowSteps = buildHexFlow(result);
  } else {
    result.decoded.rawCalldata = hex;
    result.flowSteps = [{
      label: 'Raw Calldata',
      type: 'call',
      detail: hex.slice(0, 66) + (hex.length > 66 ? '…' : ''),
    }];
  }

  return result;
}

function decodeChunk(chunk, paramName) {
  if (!chunk) return '0x';
  const name = paramName.toLowerCase();
  // address-like
  if (name.includes('to') || name.includes('from') || name.includes('address') || name.includes('spender') || name.includes('dst') || name.includes('src')) {
    if (chunk.length === 64 && chunk.startsWith('0'.repeat(24))) {
      return '0x' + chunk.slice(24);
    }
  }
  // uint / amount
  try {
    const n = BigInt('0x' + chunk);
    if (n === 0n) return '0';
    return n.toString();
  } catch { return '0x' + chunk; }
}

function parseJSON(obj) {
  const result = {
    _type:       detectJSONType(obj),
    raw:         obj,
    decoded:     {},
    logs:        [],
    flowSteps:   [],
    summary:     {},
  };

  if (result._type === 'TRANSACTION') {
    result.decoded  = decodeTransaction(obj);
    result.summary  = buildTxSummary(obj);
    result.logs     = decodeEventLogs(obj.logs || []);
    result.flowSteps = buildTxFlow(obj, result.decoded, result.logs);
  } else if (result._type === 'EVENT_LOG') {
    result.decoded  = decodeEventLog(obj);
    result.summary  = buildLogSummary(obj);
    result.logs     = [result.decoded];
    result.flowSteps = buildLogFlow(obj, result.decoded);
  } else {
    // generic
    result.decoded  = flattenObject(obj);
    result.flowSteps = [{ label: 'Generic JSON', type: 'data', detail: 'Custom payload decoded', fields: result.decoded }];
  }

  return result;
}

function detectJSONType(obj) {
  if (obj.hash && (obj.from || obj.to)) return 'TRANSACTION';
  if (obj.topics && obj.data && obj.address)  return 'EVENT_LOG';
  return 'GENERIC';
}

// ── Transaction decoder ──────────────────────────────────
function decodeTransaction(tx) {
  const decoded = {};

  // Core fields
  if (tx.hash)        decoded['Tx Hash']     = { value: tx.hash, type: 'hash' };
  if (tx.blockNumber) decoded['Block']       = { value: hexToDecimal(tx.blockNumber), type: 'number' };
  if (tx.from)        decoded['From']        = { value: tx.from, type: 'address' };
  if (tx.to)          decoded['To']          = { value: tx.to, type: 'address' };

  // Value
  if (tx.value !== undefined) {
    const raw = typeof tx.value === 'string' && tx.value.startsWith('0x')
      ? BigInt(tx.value).toString()
      : String(tx.value);
    decoded['Value']     = { value: weiToEth(raw === '0' ? '0' : BigInt(tx.value).toString()), type: 'value' };
    decoded['Value (Wei)'] = { value: BigInt(tx.value).toString(), type: 'number' };
  }

  // Gas
  if (tx.gas)        decoded['Gas Limit']   = { value: hexToDecimal(tx.gas),     type: 'gas' };
  if (tx.gasUsed)    decoded['Gas Used']    = { value: hexToDecimal(tx.gasUsed), type: 'gas' };
  if (tx.gasPrice) {
    const gp = BigInt(tx.gasPrice);
    decoded['Gas Price']  = { value: (Number(gp) / 1e9).toFixed(2) + ' Gwei', type: 'gas' };
    if (tx.gasUsed) {
      const fee = gp * BigInt(tx.gasUsed);
      decoded['Total Fee']  = { value: weiToEth(fee.toString()), type: 'value' };
    }
  }

  // Nonce / Status
  if (tx.nonce !== undefined) decoded['Nonce']  = { value: hexToDecimal(tx.nonce),  type: 'number' };
  if (tx.status !== undefined) {
    const s = tx.status === '0x1' || tx.status === 1 || tx.status === true;
    decoded['Status'] = { value: s ? '✓ Success' : '✗ Reverted', type: s ? 'success' : 'error' };
  }

  // Timestamp
  if (tx.timestamp) decoded['Timestamp'] = { value: timestampToHuman(tx.timestamp), type: 'timestamp' };

  // Method detection
  const input = tx.input || tx.data || '';
  if (input && input !== '0x') {
    const selector = input.slice(2, 10).toLowerCase();
    const method   = METHOD_SIGS[selector] || (tx.method ? { sig: tx.method } : null);
    decoded['Method Selector'] = { value: '0x' + selector, type: 'method' };
    if (method) decoded['Method']  = { value: method.sig, type: 'method' };
    decoded['Calldata Size']   = { value: Math.floor((input.length - 2) / 2) + ' bytes', type: 'data' };
  }

  // Decoded input params
  if (tx.decodedInput) {
    Object.entries(tx.decodedInput).forEach(([k, v]) => {
      const display = Array.isArray(v) ? v.join(' → ') : String(v);
      decoded['param: ' + k] = { value: display, type: 'param' };
    });
  }

  return decoded;
}

function buildTxSummary(tx) {
  const s = {};
  if (tx.gasUsed && tx.gasPrice) {
    s.totalFee = weiToEth((BigInt(tx.gasUsed) * BigInt(tx.gasPrice)).toString());
  }
  s.status = (tx.status === '0x1' || tx.status === 1) ? 'success' : 'failed';
  s.logCount = (tx.logs || []).length;
  s.value = tx.value ? weiToEth(BigInt(tx.value).toString()) : '0 ETH';
  return s;
}

// ── Event log decoder ────────────────────────────────────
function decodeEventLog(log) {
  const decoded = {};

  if (log.address) decoded['Contract']    = { value: log.address, type: 'address' };
  if (log.blockNumber) decoded['Block']   = { value: hexToDecimal(log.blockNumber), type: 'number' };
  if (log.logIndex) decoded['Log Index']  = { value: hexToDecimal(log.logIndex), type: 'number' };
  if (log.transactionHash) decoded['Tx Hash'] = { value: log.transactionHash, type: 'hash' };
  if (log.removed !== undefined) decoded['Removed'] = { value: String(log.removed), type: 'bool' };

  // Decode topics
  if (log.topics && log.topics.length > 0) {
    const sig = log.topics[0].slice(2).toLowerCase();
    const known = EVENT_SIGS[sig];
    decoded['Event Sig'] = { value: log.topics[0], type: 'method' };
    if (known) {
      decoded['Event Name'] = { value: known.name, type: 'method' };
      known.params.forEach((p, i) => {
        const topic = log.topics[i + 1];
        if (topic) {
          const addr = '0x' + topic.slice(-40);
          decoded['topic[' + i + ']: ' + p] = { value: addr, type: 'address' };
        }
      });
    }
    log.topics.slice(1).forEach((t, i) => {
      decoded['topic[' + (i + 1) + ']'] = { value: t, type: 'data' };
    });
  }

  // Decode data
  if (log.data && log.data !== '0x') {
    try {
      const n = BigInt(log.data);
      decoded['Data (uint256)'] = { value: n.toString(), type: 'value' };
      if (n > 1000000000000000000n) {
        decoded['Data (ETH-like)'] = { value: (Number(n) / 1e18).toFixed(6), type: 'value' };
      }
    } catch {
      decoded['Data'] = { value: log.data, type: 'data' };
    }
  }

  if (log.eventName) decoded['Parsed Name'] = { value: log.eventName, type: 'method' };

  return decoded;
}

function buildLogSummary(log) {
  const sig = (log.topics || [])[0] || '';
  const known = EVENT_SIGS[sig.slice(2).toLowerCase()];
  return {
    status:   'success',
    logCount: 1,
    value:    '—',
    eventName: known ? known.name : 'Unknown Event',
  };
}

function decodeEventLogs(logs) {
  return logs.map(log => {
    const sig    = (log.topics || [])[0] || '';
    const known  = EVENT_SIGS[sig.slice(2).toLowerCase()];
    return {
      address:   log.address || '—',
      name:      log.eventName || (known ? known.name : 'Unknown'),
      signature: sig,
      params:    known ? known.params : [],
      topics:    log.topics || [],
      data:      log.data || '0x',
      raw:       log,
    };
  });
}

function flattenObject(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenObject(v, key));
    } else if (Array.isArray(v)) {
      out[key] = { value: JSON.stringify(v), type: 'data' };
    } else {
      const type = typeof k === 'string' && (k.toLowerCase().includes('address') || (typeof v === 'string' && v.startsWith('0x') && v.length === 42)) ? 'address' : 'data';
      out[key] = { value: String(v), type };
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// FLOW STEP BUILDERS
// ─────────────────────────────────────────────────────────
function buildTxFlow(tx, decoded, logs) {
  const steps = [];
  const success = (tx.status === '0x1' || tx.status === 1);

  steps.push({
    label:  'Transaction Initiated',
    type:   'origin',
    detail: `From: ${shortAddr(tx.from)} → To: ${shortAddr(tx.to)}`,
    icon:   '🚀',
    fields: { 'From': tx.from, 'To': tx.to, 'Nonce': hexToDecimal(tx.nonce || '0x0') },
  });

  if (tx.input && tx.input !== '0x') {
    const selector = tx.input.slice(2, 10).toLowerCase();
    const method   = METHOD_SIGS[selector];
    steps.push({
      label:  'Method Call',
      type:   'call',
      detail: method ? method.sig : ('Selector: 0x' + selector),
      icon:   '⚡',
      fields: { 'Selector': '0x' + selector, 'Method': method ? method.sig : 'Unknown', 'Calldata': (tx.input.length - 2) / 2 + ' bytes' },
    });
  }

  if (tx.value && BigInt(tx.value) > 0n) {
    steps.push({
      label:  'ETH Transfer',
      type:   'transfer',
      detail: weiToEth(BigInt(tx.value).toString()),
      icon:   '💎',
      fields: { 'Amount': weiToEth(BigInt(tx.value).toString()), 'From': tx.from, 'To': tx.to },
    });
  }

  if (logs.length > 0) {
    logs.forEach(log => {
      steps.push({
        label:  'Event Emitted',
        type:   'event',
        detail: log.name + ' @ ' + shortAddr(log.address),
        icon:   '📡',
        fields: { 'Event': log.name, 'Contract': log.address },
      });
    });
  }

  if (tx.gasUsed) {
    steps.push({
      label:  'Gas Settlement',
      type:   'gas',
      detail: `Used ${hexToDecimal(tx.gasUsed)} / ${hexToDecimal(tx.gas || '0x0')} gas`,
      icon:   '⛽',
      fields: { 'Gas Used': hexToDecimal(tx.gasUsed), 'Gas Limit': hexToDecimal(tx.gas || '0x0'), 'Gas Price': tx.gasPrice ? (Number(BigInt(tx.gasPrice)) / 1e9).toFixed(2) + ' Gwei' : '—' },
    });
  }

  steps.push({
    label:  success ? 'Transaction Succeeded' : 'Transaction Reverted',
    type:   success ? 'success' : 'error',
    detail: success ? 'State changes committed to chain' : 'All changes rolled back',
    icon:   success ? '✅' : '❌',
    fields: { 'Status': success ? 'Success' : 'Reverted', 'Block': hexToDecimal(tx.blockNumber || '0x0') },
  });

  return steps;
}

function buildLogFlow(log, decoded) {
  const sig   = (log.topics || [])[0] || '';
  const known = EVENT_SIGS[sig.slice(2).toLowerCase()];
  return [
    { label: 'Event Detected', type: 'origin', icon: '📝', detail: `Contract: ${shortAddr(log.address)}`, fields: { 'Contract': log.address, 'Block': hexToDecimal(log.blockNumber || '0x0') } },
    { label: 'Signature Match', type: 'call',  icon: '🔍', detail: known ? `Matched: ${known.name}` : 'Unknown signature', fields: { 'Sig Hash': sig.slice(0, 10), 'Name': known ? known.name : 'Unknown' } },
    { label: 'Topic Decoding', type: 'data',   icon: '📊', detail: `${(log.topics || []).length} topics decoded`, fields: Object.fromEntries((log.topics || []).map((t, i) => ['topic[' + i + ']', t])) },
    { label: 'Data Decoding',  type: 'event',  icon: '🔓', detail: log.data || '0x', fields: { 'Raw Data': log.data } },
    { label: 'Log Indexed',    type: 'success', icon: '✅', detail: `Log #${hexToDecimal(log.logIndex || '0x0')}`, fields: { 'Log Index': hexToDecimal(log.logIndex || '0x0'), 'Tx Hash': shortAddr(log.transactionHash || '') } },
  ];
}

function buildHexFlow(result) {
  return [
    { label: 'Raw Input',      type: 'origin', icon: '🔐', detail: result.rawData.slice(0, 18) + '…', fields: { 'Length': result.calldataLength } },
    { label: 'Selector Parse', type: 'call',   icon: '⚡', detail: result.selector, fields: { 'Selector': result.selector, 'Method': result.method } },
    { label: 'Param Decode',   type: 'data',   icon: '📊', detail: Object.keys(result.decoded).length + ' params', fields: result.decoded },
    { label: 'Complete',       type: 'success', icon: '✅', detail: 'Calldata decoded', fields: {} },
  ];
}

// ─────────────────────────────────────────────────────────
// RENDER HELPERS
// ─────────────────────────────────────────────────────────
const TYPE_STYLES = {
  address:   { dot: 'bg-brand-400',  text: 'text-brand-300',  badge: 'bg-brand-900/40 text-brand-300' },
  value:     { dot: 'bg-yellow-400', text: 'text-yellow-300', badge: 'bg-yellow-900/40 text-yellow-300' },
  method:    { dot: 'bg-blue-400',   text: 'text-blue-300',   badge: 'bg-blue-900/40 text-blue-300' },
  gas:       { dot: 'bg-red-400',    text: 'text-red-300',    badge: 'bg-red-900/40 text-red-300' },
  data:      { dot: 'bg-purple-400', text: 'text-purple-300', badge: 'bg-purple-900/40 text-purple-300' },
  hash:      { dot: 'bg-slate-400',  text: 'text-slate-300',  badge: 'bg-slate-700 text-slate-300' },
  number:    { dot: 'bg-orange-400', text: 'text-orange-300', badge: 'bg-orange-900/40 text-orange-300' },
  param:     { dot: 'bg-pink-400',   text: 'text-pink-300',   badge: 'bg-pink-900/40 text-pink-300' },
  success:   { dot: 'bg-green-400',  text: 'text-green-300',  badge: 'bg-green-900/40 text-green-300' },
  error:     { dot: 'bg-red-500',    text: 'text-red-400',    badge: 'bg-red-900/40 text-red-400' },
  timestamp: { dot: 'bg-cyan-400',   text: 'text-cyan-300',   badge: 'bg-cyan-900/40 text-cyan-300' },
  bool:      { dot: 'bg-lime-400',   text: 'text-lime-300',   badge: 'bg-lime-900/40 text-lime-300' },
  transfer:  { dot: 'bg-yellow-400', text: 'text-yellow-300', badge: 'bg-yellow-900/40 text-yellow-300' },
};

const FLOW_STYLES = {
  origin:   { bg: 'bg-dark-600',          border: 'border-brand-500/40', header: 'bg-brand-900/30',  icon: 'text-brand-400' },
  call:     { bg: 'bg-dark-600',          border: 'border-blue-500/40',  header: 'bg-blue-900/30',   icon: 'text-blue-400' },
  transfer: { bg: 'bg-dark-600',          border: 'border-yellow-500/40',header: 'bg-yellow-900/20', icon: 'text-yellow-400' },
  event:    { bg: 'bg-dark-600',          border: 'border-purple-500/40',header: 'bg-purple-900/20', icon: 'text-purple-400' },
  gas:      { bg: 'bg-dark-600',          border: 'border-red-500/40',   header: 'bg-red-900/20',    icon: 'text-red-400' },
  data:     { bg: 'bg-dark-600',          border: 'border-slate-500/40', header: 'bg-slate-700/30',  icon: 'text-slate-400' },
  success:  { bg: 'bg-green-950/30',      border: 'border-green-500/40', header: 'bg-green-900/20',  icon: 'text-green-400' },
  error:    { bg: 'bg-red-950/30',        border: 'border-red-500/40',   header: 'bg-red-900/20',    icon: 'text-red-400' },
};

function getStyle(type) {
  return TYPE_STYLES[type] || TYPE_STYLES['data'];
}

function renderDecodedTree(decoded) {
  const el = $('decoded-tree');
  el.innerHTML = '';
  if (!decoded || Object.keys(decoded).length === 0) {
    el.innerHTML = '<p class="text-xs text-slate-500 italic">No fields decoded.</p>';
    return;
  }
  Object.entries(decoded).forEach(([key, field]) => {
    const s = getStyle(field.type || 'data');
    const val = field.value !== undefined ? field.value : field;
    const isLong = String(val).length > 40;
    const div = document.createElement('div');
    div.className = 'flex items-start gap-3 py-2 border-b border-dark-600 last:border-0 group';
    div.innerHTML = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <div class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${s.dot}"></div>
        <div class="min-w-0 flex-1">
          <div class="text-xs text-slate-500 font-medium mb-0.5">${escHtml(key)}</div>
          <div class="mono text-xs ${s.text} break-all ${isLong ? 'cursor-pointer' : ''}" ${isLong ? 'title="Click to copy"' : ''} data-copy="${escHtml(String(val))}">${escHtml(String(val))}</div>
        </div>
      </div>
      <span class="badge ${s.badge} shrink-0 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">${escHtml(field.type || 'data')}</span>
    `;
    if (isLong) {
      div.querySelector('.mono').addEventListener('click', e => {
        copyToClipboard(e.target.dataset.copy, 'Field value copied!');
      });
    }
    el.appendChild(div);
  });
}

function renderEventLogs(logs) {
  const el     = $('events-panel');
  const countEl = $('event-count');
  el.innerHTML  = '';
  countEl.textContent = logs.length + ' event' + (logs.length !== 1 ? 's' : '');

  if (logs.length === 0) {
    el.innerHTML = '<p class="text-xs text-slate-500 italic">No events emitted.</p>';
    return;
  }

  logs.forEach((log, i) => {
    const sigColor = log.name !== 'Unknown' ? 'bg-blue-900/40 text-blue-300' : 'bg-dark-600 text-slate-400';
    const div = document.createElement('div');
    div.className = 'rounded-xl border border-dark-500 overflow-hidden';
    div.innerHTML = `
      <div class="flex items-center justify-between px-4 py-2.5 bg-dark-700">
        <div class="flex items-center gap-2">
          <span class="badge ${sigColor}">${escHtml(log.name)}</span>
          <span class="text-xs text-slate-500 mono">${shortAddr(log.address)}</span>
        </div>
        <span class="text-xs text-slate-600">#${i}</span>
      </div>
      <div class="px-4 py-3 space-y-1.5">
        ${(log.topics || []).map((t, ti) => `
          <div class="flex items-start gap-2">
            <span class="text-xs text-slate-600 shrink-0 w-16">topic[${ti}]</span>
            <span class="mono text-xs text-purple-300 break-all">${escHtml(t)}</span>
          </div>
        `).join('')}
        ${log.data && log.data !== '0x' ? `
          <div class="flex items-start gap-2">
            <span class="text-xs text-slate-600 shrink-0 w-16">data</span>
            <span class="mono text-xs text-yellow-300 break-all">${escHtml(log.data)}</span>
          </div>` : ''}
        ${log.params && log.params.length ? `
          <div class="mt-2 pt-2 border-t border-dark-600">
            <p class="text-xs text-slate-500 mb-1">Decoded params: <span class="text-brand-400">${escHtml(log.params.join(', '))}</span></p>
          </div>` : ''}
      </div>
    `;
    el.appendChild(div);
  });
}

function renderSummaryCards(result) {
  const el = $('summary-cards');
  el.innerHTML = '';
  const s = result.summary || {};
  const txType = result._type;

  const cards = [];

  if (txType === 'TRANSACTION') {
    const statusOk = s.status === 'success';
    cards.push({ label: 'Status',    value: statusOk ? '✓ Success' : '✗ Reverted', color: statusOk ? 'text-green-400' : 'text-red-400', icon: statusOk ? '✅' : '❌' });
    cards.push({ label: 'Value',     value: s.value || '0 ETH', color: 'text-yellow-400', icon: '💎' });
    cards.push({ label: 'Gas Fee',   value: s.totalFee || '—',  color: 'text-red-400',    icon: '⛽' });
    cards.push({ label: 'Events',    value: (s.logCount || 0) + ' emitted', color: 'text-purple-400', icon: '📡' });
  } else if (txType === 'EVENT_LOG') {
    cards.push({ label: 'Event',     value: s.eventName || 'Unknown', color: 'text-blue-400',  icon: '📝' });
    cards.push({ label: 'Topics',    value: result.raw.topics?.length + ' topics', color: 'text-purple-400', icon: '🔍' });
    cards.push({ label: 'Data',      value: result.raw.data === '0x' ? 'empty' : ((result.raw.data?.length - 2) / 2) + ' bytes', color: 'text-yellow-400', icon: '📊' });
    cards.push({ label: 'Contract',  value: shortAddr(result.raw.address), color: 'text-brand-400', icon: '📄' });
  } else if (txType === 'HEX_CALLDATA') {
    cards.push({ label: 'Type',      value: 'Hex Calldata', color: 'text-brand-400', icon: '🔐' });
    cards.push({ label: 'Selector',  value: result.selector, color: 'text-blue-400',  icon: '⚡' });
    cards.push({ label: 'Method',    value: result.method.split('(')[0], color: 'text-purple-400', icon: '🔧' });
    cards.push({ label: 'Size',      value: result.calldataLength, color: 'text-yellow-400', icon: '📦' });
  } else {
    cards.push({ label: 'Type',   value: 'Generic JSON', color: 'text-slate-400', icon: '📋' });
    cards.push({ label: 'Fields', value: Object.keys(result.decoded).length + ' fields', color: 'text-brand-400', icon: '🗂️' });
  }

  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'grad-border rounded-xl p-4 flex items-start gap-3';
    div.innerHTML = `
      <div class="text-2xl">${card.icon}</div>
      <div class="min-w-0">
        <div class="text-xs text-slate-500 font-medium">${card.label}</div>
        <div class="mono text-sm font-semibold ${card.color} truncate mt-0.5">${escHtml(String(card.value))}</div>
      </div>
    `;
    el.appendChild(div);
  });
}

function renderFormattedJSON(obj) {
  const el = $('json-output');
  if (typeof obj !== 'object') {
    el.innerHTML = `<span class="text-purple-300">${escHtml(String(obj))}</span>`;
    return;
  }
  el.innerHTML = syntaxHighlight(JSON.stringify(obj.raw || obj, null, 2));
}

function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-string';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
}

function renderStateFlow(steps) {
  const container = $('flow-steps');
  const empty     = $('flow-empty');
  container.innerHTML = '';

  if (!steps || steps.length === 0) {
    container.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.classList.remove('hidden');

  steps.forEach((step, i) => {
    const s = FLOW_STYLES[step.type] || FLOW_STYLES['data'];
    const isLast = i === steps.length - 1;
    const fields = step.fields || {};
    const fieldKeys = Object.keys(fields);

    const wrapper = document.createElement('div');
    wrapper.className = 'flow-step' + (isLast ? '' : '');

    wrapper.innerHTML = `
      <div class="flex items-start gap-4">
        <!-- Step number + connector -->
        <div class="flex flex-col items-center gap-0 shrink-0">
          <div class="w-10 h-10 rounded-xl ${s.header} border ${s.border} flex items-center justify-center text-xl shadow-lg">
            ${step.icon || String(i + 1)}
          </div>
          ${!isLast ? `<div class="w-0.5 flex-1 min-h-8 mt-1" style="background: linear-gradient(to bottom, rgba(20,184,166,0.4), rgba(20,184,166,0.05))"></div>` : ''}
        </div>

        <!-- Card -->
        <div class="flex-1 min-w-0 mb-8">
          <div class="rounded-xl border ${s.border} ${s.bg} overflow-hidden">
            <div class="${s.header} px-4 py-3 flex items-center justify-between">
              <div>
                <div class="font-semibold text-sm text-slate-200">${escHtml(step.label)}</div>
                <div class="text-xs text-slate-400 mt-0.5 mono">${escHtml(step.detail || '')}</div>
              </div>
              <span class="badge bg-dark-800/60 text-slate-400 text-xs">Step ${i + 1}</span>
            </div>
            ${fieldKeys.length > 0 ? `
              <div class="px-4 py-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                ${fieldKeys.map(k => {
                  const v = fields[k];
                  const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
                  return `
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs text-slate-500">${escHtml(k)}</span>
                      <span class="mono text-xs text-slate-300 truncate" title="${escHtml(display)}">${escHtml(display)}</span>
                    </div>`;
                }).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    container.appendChild(wrapper);
  });
}

// ─────────────────────────────────────────────────────────
// SNIPPETS
// ─────────────────────────────────────────────────────────
function renderSnippets(filter = '') {
  const grid  = $('snippets-grid');
  const empty = $('snippets-empty');
  grid.innerHTML = '';

  const filtered = filter
    ? State.snippets.filter(s =>
        s.name.toLowerCase().includes(filter) ||
        (s.tags || []).some(t => t.includes(filter)) ||
        (s.notes || '').toLowerCase().includes(filter)
      )
    : State.snippets;

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach((snippet, idx) => {
    const card = document.createElement('div');
    card.className = 'snippet-card grad-border rounded-xl overflow-hidden group cursor-pointer hover:glow-teal transition-all';
    const tags = (snippet.tags || []).map(t => `<span class="badge bg-dark-600 text-slate-400">${escHtml(t)}</span>`).join('');
    const preview = typeof snippet.payload === 'string'
      ? snippet.payload.slice(0, 80) + (snippet.payload.length > 80 ? '…' : '')
      : JSON.stringify(snippet.payload).slice(0, 80) + '…';

    card.innerHTML = `
      <div class="px-4 py-3 border-b border-dark-600 bg-dark-800 flex items-start justify-between gap-2">
        <div>
          <div class="font-semibold text-sm text-slate-200">${escHtml(snippet.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${new Date(snippet.savedAt).toLocaleString()}</div>
        </div>
        <div class="snippet-actions flex items-center gap-1">
          <button class="load-snippet p-1.5 rounded-lg hover:bg-dark-500 text-slate-500 hover:text-brand-400 transition-colors" data-idx="${idx}" title="Load">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          </button>
          <button class="copy-snippet p-1.5 rounded-lg hover:bg-dark-500 text-slate-500 hover:text-blue-400 transition-colors" data-idx="${idx}" title="Copy">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </button>
          <button class="delete-snippet p-1.5 rounded-lg hover:bg-dark-500 text-slate-500 hover:text-red-400 transition-colors" data-idx="${idx}" title="Delete">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
      <div class="p-4">
        ${tags ? `<div class="flex flex-wrap gap-1 mb-3">${tags}</div>` : ''}
        ${snippet.notes ? `<p class="text-xs text-slate-400 mb-2 italic">${escHtml(snippet.notes)}</p>` : ''}
        <div class="mono text-xs text-slate-600 bg-dark-900 rounded-lg px-3 py-2 truncate">${escHtml(preview)}</div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Bind actions
  grid.querySelectorAll('.load-snippet').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const s = State.snippets[btn.dataset.idx];
      $('payload-input').value = typeof s.payload === 'string' ? s.payload : JSON.stringify(s.payload, null, 2);
      updateCharCount();
      switchTab('parser');
      runParse();
      toast('Snippet loaded → parsing…', 'info');
    });
  });

  grid.querySelectorAll('.copy-snippet').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const s = State.snippets[btn.dataset.idx];
      copyToClipboard(typeof s.payload === 'string' ? s.payload : JSON.stringify(s.payload, null, 2), 'Snippet payload copied!');
    });
  });

  grid.querySelectorAll('.delete-snippet').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      State.snippets.splice(idx, 1);
      saveState();
      updateSnippetBadge();
      renderSnippets($('snippet-search').value.toLowerCase());
      toast('Snippet deleted', 'warn');
    });
  });
}

function updateSnippetBadge() {
  const count = State.snippets.length;
  const badge = $('snippet-count-badge');
  $('stat-snippets').textContent = count;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ─────────────────────────────────────────────────────────
// VALIDATION / PARSE RUNNER
// ─────────────────────────────────────────────────────────
function runParse() {
  const raw = $('payload-input').value.trim();
  if (!raw) { toast('Paste a payload first!', 'warn'); return; }

  const banner  = $('validation-banner');
  const results = $('results-container');
  const empty   = $('empty-state');
  const typeBadge = $('input-type-badge');

  try {
    // Detect + show badge
    const type = detectInputType(raw);
    typeBadge.textContent = type;
    typeBadge.className = type === 'JSON' ? 'badge bg-green-900/40 text-green-300' :
                          type === 'HEX'  ? 'badge bg-purple-900/40 text-purple-300' :
                                            'badge bg-dark-600 text-slate-400';

    // Parse
    const parsed = parsePayload(raw);
    State.parsedData = parsed;
    State.rawInput   = raw;
    State.parseCount++;
    State.lastParsed = new Date().toLocaleTimeString();
    saveState();

    // Update stats
    $('stat-parsed').textContent = State.parseCount;
    $('stat-last').textContent   = State.lastParsed;

    // Validation banner
    banner.className   = 'rounded-xl px-4 py-3 border text-sm font-medium animate-slide-up bg-green-900/20 border-green-500/40 text-green-300';
    banner.textContent = '✓ Payload parsed successfully — ' + (parsed._type || 'GENERIC') + ' detected';
    banner.classList.remove('hidden');

    // Show results
    results.classList.remove('hidden');
    empty.classList.add('hidden');

    // Render components
    renderSummaryCards(parsed);
    renderDecodedTree(parsed.decoded);
    renderEventLogs(parsed.logs || []);
    renderFormattedJSON(parsed);
    renderStateFlow(parsed.flowSteps || []);

    toast('✓ Parsed!', 'success');
  } catch (err) {
    banner.className   = 'rounded-xl px-4 py-3 border text-sm font-medium animate-slide-up bg-red-900/20 border-red-500/40 text-red-300';
    banner.textContent = '✗ ' + err.message;
    banner.classList.remove('hidden');
    results.classList.add('hidden');
    empty.classList.remove('hidden');
    toast('Parse error: ' + err.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────
function switchTab(name) {
  $$('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === name) {
      btn.classList.add('tab-active');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('tab-active');
      btn.classList.add('text-slate-400');
    }
  });
  $$('.tab-content').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== 'tab-' + name);
  });
  if (name === 'snippets') renderSnippets($('snippet-search').value.toLowerCase());
}

// ─────────────────────────────────────────────────────────
// FORMAT (pretty-print JSON)
// ─────────────────────────────────────────────────────────
function formatInput() {
  const ta  = $('payload-input');
  const raw = ta.value.trim();
  if (!raw) return;
  if (detectInputType(raw) === 'JSON') {
    try {
      ta.value = JSON.stringify(JSON.parse(raw), null, 2);
      updateCharCount();
      toast('Formatted JSON', 'info');
    } catch { toast('Invalid JSON', 'error'); }
  } else {
    toast('Formatting only applies to JSON input', 'warn');
  }
}

// ─────────────────────────────────────────────────────────
// SAVE SNIPPET MODAL
// ─────────────────────────────────────────────────────────
function openSaveModal() {
  if (!State.parsedData) { toast('Nothing parsed yet', 'warn'); return; }
  $('save-modal').classList.remove('hidden');
  $('save-modal').classList.add('flex');
  $('snippet-name').value  = '';
  $('snippet-tags').value  = '';
  $('snippet-notes').value = '';
  setTimeout(() => $('snippet-name').focus(), 100);
}

function closeSaveModal() {
  $('save-modal').classList.add('hidden');
  $('save-modal').classList.remove('flex');
}

function saveSnippet() {
  const name = $('snippet-name').value.trim();
  if (!name) { toast('Please enter a snippet name', 'warn'); $('snippet-name').focus(); return; }

  const tags = $('snippet-tags').value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

  State.snippets.unshift({
    id:       Date.now(),
    name,
    tags,
    notes:    $('snippet-notes').value.trim(),
    payload:  State.rawInput,
    type:     State.parsedData._type,
    savedAt:  new Date().toISOString(),
  });

  saveState();
  updateSnippetBadge();
  closeSaveModal();
  toast('✓ Snippet saved!', 'success');
}

// ─────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────
function exportAllSnippets() {
  if (State.snippets.length === 0) { toast('No snippets to export', 'warn'); return; }
  const blob = new Blob([JSON.stringify(State.snippets, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'auditlog-snippets-' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Snippets exported!', 'success');
}

// ─────────────────────────────────────────────────────────
// THEME TOGGLE
// ─────────────────────────────────────────────────────────
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    $('theme-icon-dark').classList.add('hidden');
    $('theme-icon-light').classList.remove('hidden');
  } else {
    document.documentElement.classList.add('dark');
    $('theme-icon-dark').classList.remove('hidden');
    $('theme-icon-light').classList.add('hidden');
  }
}

// ─────────────────────────────────────────────────────────
// MISC UTILS
// ─────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function updateCharCount() {
  const ta = $('payload-input');
  $('char-count').textContent = ta.value.length.toLocaleString() + ' chars';

  // Auto-detect type badge
  const raw  = ta.value.trim();
  const type = raw ? detectInputType(raw) : 'AUTO-DETECT';
  const b    = $('input-type-badge');
  b.textContent = type;
  b.className   = type === 'JSON' ? 'badge bg-green-900/40 text-green-300' :
                  type === 'HEX'  ? 'badge bg-purple-900/40 text-purple-300' :
                                    'badge bg-dark-600 text-slate-400';
}

// ─────────────────────────────────────────────────────────
// INIT + EVENT LISTENERS
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Restore theme
  applyTheme(State.theme);
  $('stat-parsed').textContent  = State.parseCount;
  $('stat-snippets').textContent = State.snippets.length;
  $('stat-last').textContent    = '—';
  updateSnippetBadge();

  // Payload input
  $('payload-input').addEventListener('input', updateCharCount);
  $('payload-input').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runParse(); }
  });

  // Buttons
  $('parse-btn').addEventListener('click', runParse);
  $('parse-btn-mobile')?.addEventListener('click', runParse);
  $('format-btn').addEventListener('click', formatInput);
  $('clear-btn').addEventListener('click', () => {
    $('payload-input').value = '';
    updateCharCount();
    $('validation-banner').classList.add('hidden');
    $('results-container').classList.add('hidden');
    $('empty-state').classList.remove('hidden');
    State.parsedData = null;
    toast('Input cleared', 'info');
  });

  // Copy buttons
  $('copy-decoded-btn').addEventListener('click', () => {
    if (!State.parsedData) return;
    copyToClipboard(JSON.stringify(State.parsedData.decoded, null, 2), 'Decoded fields copied!');
  });
  $('copy-raw-btn').addEventListener('click', () => {
    if (!State.parsedData) return;
    copyToClipboard(JSON.stringify(State.parsedData.raw || State.parsedData, null, 2), 'Payload copied!');
  });

  // Save snippet
  $('save-snippet-btn').addEventListener('click', openSaveModal);
  $('modal-save-btn').addEventListener('click', saveSnippet);
  $('modal-cancel-btn').addEventListener('click', closeSaveModal);
  $('modal-backdrop').addEventListener('click', closeSaveModal);
  $('snippet-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveSnippet(); });

  // Export
  $('export-all-btn').addEventListener('click', exportAllSnippets);

  // Theme
  $('theme-toggle').addEventListener('click', () => {
    State.theme = State.theme === 'dark' ? 'light' : 'dark';
    applyTheme(State.theme);
    saveState();
  });

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Sidebar (mobile)
  const sidebar = $('sidebar');
  const overlay = $('sidebar-overlay');
  $('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // Examples
  $$('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key     = btn.dataset.example;
      const payload = EXAMPLES[key];
      const meta    = EXAMPLE_META[key] || {};
      if (payload) {
        $('payload-input').value = payload;
        updateCharCount();
        // Close mobile sidebar
        $('sidebar').classList.remove('open');
        $('sidebar-overlay').classList.remove('open');
        switchTab('parser');
        runParse();
        toast('Loaded: ' + (meta.sub || key), 'info');
      }
    });
  });

  // Snippet search
  $('snippet-search').addEventListener('input', e => {
    renderSnippets(e.target.value.toLowerCase().trim());
  });

  // Initial render
  renderSnippets();
});
