# Deland - DeFi Lending & Borrowing Protocol

![Deland Banner](./assets/banner.png)

## 🌟 Overview

Deland is a decentralized finance (DeFi) protocol that enables users to lend and borrow cryptocurrency assets in a trustless, secure, and efficient manner. Built on blockchain technology, Deland empowers users to earn interest on their crypto holdings or access liquidity by borrowing against their collateral.

## ✨ Key Features

- **🏦 Lending**: Deposit your crypto assets and earn competitive interest rates
- **💰 Borrowing**: Access liquidity by borrowing against your collateralized assets
- **📊 Real-time Price Feeds**: Accurate asset pricing powered by decentralized oracles
- **🔒 Secure Smart Contracts**: Audited and battle-tested lending contract architecture
- **💎 Multiple Asset Support**: Support for various tokens including WETH, USDC, USDT, and more
- **📈 Dynamic Interest Rates**: Market-driven interest rates based on supply and demand
- **⚡ Instant Transactions**: Fast and efficient blockchain transactions
- **🎨 Modern UI**: Intuitive and responsive user interface built with Next.js
- **🌐 PushChain Integration**: Deployed on PushChain network for enhanced scalability and low fees

## 🛠️ Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Smart Contracts**: Solidity
- **Blockchain**: PushChain & Ethereum/EVM-compatible chains
- **Web3 Integration**: ethers.js
- **Push Chain**: Push SDK & UI Kit f
- **Price Oracles**: Self-deployed price feeds

## 📦 Project Structure

```
Deland/
├── contracts/              # Smart contract source files
│   ├── LendingAndBorrowing.sol
│   ├── SimplePriceFeed.sol
│   └── test/              # Mock tokens for testing
├── components/            # React components
│   ├── ui/               # UI components
│   ├── hooks/            # Custom React hooks
│   └── providers/        # Context providers
├── pages/                # Next.js pages
├── scripts/              # Deployment and utility scripts
├── abis/                 # Contract ABIs
└── utils/                # Helper functions
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MetaMask or compatible Web3 wallet
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Deland.git
   cd Deland
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address
   NEXT_PUBLIC_NETWORK_ID=your_network_id
   NEXT_PUBLIC_RPC_URL=your_rpc_url
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔗 PushChain Network Integration

Deland is deployed on **PushChain**, a high-performance blockchain network designed for scalability and efficiency.

### What is PushChain?

What is Push Chain?
Push Chain is a shared-state Layer 1 blockchain built to eliminate fragmentation across all chains.

Push enables you to build Universal Apps that can support transactions from any chain (Ethereum, Solana, EVM L2s, L3s) - without requiring users to juggle between multiple wallets, tokens or gas mechanics.

In short, Deploy once, go cross-chain & 10X your user base.

Deland leverages the **Push chain SDK and UI Kit** 


### Connect to PushChain

To connect your wallet to PushChain network:

**Network Details:**
- **Network Name**: Push Chain Testnet
- **RPC URL**: Push Chain Testnet
- **Chain ID**: 42101
- **Currency Symbol**: PC
- **Block Explorer**: donut.push.network

Add these details to your MetaMask or Web3 wallet to interact with Deland on PushChain.

## 📝 Smart Contract Deployment

### Deploy Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# Deploy to testnet
npx hardhat run scripts/deploy.js --network goerli
```

### Setup Price Feeds

```bash
node scripts/setupPriceFeeds.js
```

## 💡 How It Works

### Lending (Supply)

1. Connect your Web3 wallet
2. Select the asset you want to lend
3. Enter the amount to supply
4. Approve the transaction
5. Start earning interest immediately

### Borrowing

1. Supply collateral to the protocol
2. View your borrowing power
3. Select the asset you want to borrow
4. Enter the amount (within your limit)
5. Confirm the transaction
6. Receive borrowed assets instantly

### Repayment

1. Navigate to "Your Borrows"
2. Select the loan to repay
3. Enter repayment amount
4. Confirm transaction
5. Collateral is released proportionally

### Withdrawal

1. Go to "Your Supplies"
2. Select the asset to withdraw
3. Enter withdrawal amount
4. Confirm transaction (if no active borrows against it)

## 🔐 Security Features

- **Collateralization Ratio**: Over-collateralization ensures protocol solvency
- **Liquidation Mechanism**: Automatic liquidation of undercollateralized positions
- **Price Oracle Integration**: Reliable asset pricing from trusted sources
- **Audited Smart Contracts**: Security-first approach to contract development
- **Access Controls**: Role-based permissions for contract management

## 📊 Supported Assets

| Token | Symbol | Network | Collateral Factor |
|-------|--------|---------|-------------------|
| Wrapped Ether | WETH | PushChain/Ethereum | 80% |
| USD Coin | USDC | PushChain/Ethereum | 85% |
| Tether | USDT | PushChain/Ethereum | 85% |




## 🤝 Contributing

We welcome contributions from the community! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.



## ⚠️ Disclaimer

This project is for educational and experimental purposes. Use at your own risk. Always do your own research before interacting with any DeFi protocol. Never invest more than you can afford to lose.



**Built with ❤️ by the Deland Team**

*Empowering financial freedom through decentralized lending*
