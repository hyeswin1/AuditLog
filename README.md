# AuditLog — Blockchain TX Explorer & Validator

> A clean, minimal browser tool for parsing raw transaction payloads and smart contract event logs into human-readable summaries and visual state trees. No backend. No build step. Just open and use.

![Stack](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![Stack](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Stack](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Storage](https://img.shields.io/badge/localStorage-persisted-green?style=flat)

---

## Screenshot

```
┌─────────────────────────────────────────────────────────┐
│  🛡 AuditLog  │ Parser │ State Flow │ Snippets          │
├──────────────┬──────────────────────────────────────────┤
│ Session Stats│  ┌─ Payload Input ──────────────────┐   │
│ Parsed:  12  │  │ Paste JSON / hex calldata…        │   │
│ Snippets: 3  │  └───────────────────────────────────┘   │
│              │  ┌─ Summary ──┐  ┌─ Decoded Fields ─┐   │
│ Quick Load   │  │ ✓ Success  │  │ From  0xd8dA…    │   │
│ ERC-20 …     │  │ 1 ETH      │  │ To    0xA0b8…    │   │
│ Uniswap …    │  │ 2 Events   │  │ Gas   60,000     │   │
│ NFT Mint …   │  └────────────┘  └──────────────────┘   │
└──────────────┴──────────────────────────────────────────┘
```

---

## Features

### 🔍 Payload Parser
- Paste raw **JSON transactions**, **event logs**, or **hex calldata** (`0x…`)
- Auto-detects input format (JSON / HEX)
- Decodes:
  - Gas limit, gas used, gas price → total fee in ETH
  - ETH value in both Wei and ETH
  - Method selector lookup (15+ built-in: ERC-20, ERC-721, Uniswap V2, WETH…)
  - Nonce, status, block number, timestamp
  - Decoded input parameters
- Event log decoding with topic-to-name resolution (10+ known signatures)
- Colour-coded field tree with type badges (address / value / method / gas / data…)
- Syntax-highlighted formatted JSON output
- `Ctrl + Enter` keyboard shortcut to parse instantly

### ⚡ Visual State Flow
- Step-by-step graphical breakdown of how data moves through a transaction:
  1. Transaction Initiated
  2. Method Call
  3. ETH Transfer (if value > 0)
  4. Event Emissions (one card per log)
  5. Gas Settlement
  6. Success / Revert outcome
- Each step shows icon, label, detail line, and a field grid
- Animated connector lines between steps

### 🔖 Saved Snippets
- Save any parsed payload with a **name**, **tags**, and **notes**
- Persisted in `localStorage` — survives page refreshes and browser restarts
- Search / filter snippets by name, tag, or note text
- **Load** a snippet straight back into the parser with one click
- **Copy** the raw payload to clipboard
- **Delete** individual snippets
- **Export All** as a `.json` file for sharing with teammates

### 📦 Quick Examples (sidebar)
Load pre-built examples instantly — no copy-pasting needed:

| Example | Description |
|---|---|
| ERC-20 Transfer | `transfer(address,uint256)` with Transfer event |
| Uniswap Swap | `swapExactETHForTokens` with Deposit + Transfer events |
| NFT Mint | `mint(uint256)` with ERC-721 Transfer from zero address |
| Raw Hex Calldata | Bare `0x`-prefixed calldata string |
| Event Log | Standalone event log object |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Markup | HTML5 |
| Styling | [Tailwind CSS v3](https://tailwindcss.com/) via CDN (no install) |
| Logic | Vanilla JavaScript (ES2020+) |
| Persistence | `localStorage` |
| Fonts | JetBrains Mono + Inter via Google Fonts |

Zero dependencies. Zero build tools. Zero config.

---

## Getting Started

```bash
# Clone or download — then just open the file
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux
```

No `npm install`. No server. Works from the filesystem directly in any modern browser (Chrome, Edge, Firefox, Safari).

---

## Project Structure

```
AuditLog/
├── index.html   # Full UI — layout, Tailwind config, markup
└── script.js    # Parser engine, renderers, localStorage logic
```

---

## Supported Decoding

### Method Selectors (hex calldata)

| Selector | Method |
|---|---|
| `a9059cbb` | `transfer(address,uint256)` |
| `23b872dd` | `transferFrom(address,address,uint256)` |
| `095ea7b3` | `approve(address,uint256)` |
| `7ff36ab5` | `swapExactETHForTokens(…)` |
| `38ed1739` | `swapExactTokensForTokens(…)` |
| `6a627842` | `mint(address)` |
| `d0e30db0` | `deposit()` |
| `2e1a7d4d` | `withdraw(uint256)` |
| `a22cb465` | `setApprovalForAll(address,bool)` |
| `42842e0e` | `safeTransferFrom(address,address,uint256)` |

### Event Signatures (topic[0])

| Topic hash (prefix) | Event |
|---|---|
| `ddf252ad…` | `Transfer(address,address,uint256)` |
| `8c5be1e5…` | `Approval(address,address,uint256)` |
| `e1fffcc4…` | `Deposit(address,uint256)` |
| `7fcf532c…` | `Withdrawal(address,uint256)` |
| `d78ad95f…` | `Swap(address,uint256,uint256,uint256,uint256,address)` |
| `1c411e9a…` | `Sync(uint112,uint112)` |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Parse the current payload |

---

## localStorage Keys

| Key | Content |
|---|---|
| `al_snippets` | JSON array of saved snippets |
| `al_parse_count` | Total number of parses this session |
| `al_theme` | `"dark"` or `"light"` |

---

## Roadmap / Ideas

- [ ] ABI-aware decoding (paste a contract ABI to decode any custom method)
- [ ] Foundry / Hardhat trace format support (`forge test -vvvv` output)
- [ ] Multi-transaction diff view
- [ ] Share snippet via URL (base64 payload in query param)
- [ ] Gas estimation comparisons
- [ ] ENS name resolution

---

## License

MIT — free to use, modify, and share.
