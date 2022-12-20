# Escrow Contract Example for NEAR in JavaScript

[![](https://img.shields.io/badge/⋈%20Examples-Basics-green)](https://docs.near.org/tutorials/welcome)
[![](https://img.shields.io/badge/Gitpod-Ready-orange)](https://gitpod.io/#/https://github.com/near-examples/escrow-js)
[![](https://img.shields.io/badge/Contract-JS-yellow)](https://docs.near.org/develop/contracts/anatomy)
[![](https://img.shields.io/github/workflow/status/near-examples/escrow-js/Tests/master?color=green&label=Tests)](https://github.com/near-examples/escrow-js/actions/workflows/tests.yml)

This is an example of an escrow contract written in JavaScript for the NEAR blockchain.

## Requirements

- [Node.js](https://nodejs.org/en/download/) ~= 16.16.0

## Running the Example

1. Install dependencies

```bash
npm install
```

2. Build the contract

```bash
npm run build
```

3. Run the tests

```bash
npm test
```

## What this Example Covers

1. How to write a smart contract in JavaScript

   a. How to perform cross-contract calls and pass data among them in JavaScript

2. How to write integration tests for a smart contract in JavaScript

## Flows Covered in the Example

1. User A purchases a product in-escrow from User B
2. User A purchases a product in-escrow from User B and cancels the purchase
3. User A purchases a product in-escrow from User B while User B owns no products
4. User A purchases a product in-escrow from User B and approves the purchase
5. User A purchases a product in-escrow from User B and a day passes without approval
6. User A purchases a product in-escrow from User B and attempts to transfer the product to User C


## Detailed Guide in Running the Example

---

### Required Accounts 

```bash 
your-testnet-account-id        # <-- Your usual testnet account
your-escrow-testnet-account-id # <-- The testnet account holding this escrow contract/program
your-assets-testnet-account-id # <-- The testnet account holding the assets contract/program
your-asset-owner-account-id    # <-- The testnet account that owns the assets seeking $NEAR for them
your-buyer-account-id          # <-- The testnet account that owns $NEAR seeking to buy assets
```

---

1. Login to your NEAR account

```bash
near login
```

2. Create sub accounts for deploying the contracts

```bash
near create-account --accountId <your-escrow-testnet-account-id> --masterAccount <your-testnet-account-id> --initialBalance <your-escrow-testnet-account-balance>
```

```bash
near create-account --accountId <your-assets-testnet-account-id> --masterAccount <your-testnet-account-id> --initialBalance <your-assets-testnet-account-balance>
```

3. Create sub accounts to simulate users executing a transaction

```bash
near create-account --accountId <your-asset-owner-account-id> --masterAccount <your-testnet-account-id> --initialBalance <your-asset-owner-account-balance>
```

```bash
near create-account --accountId <your-buyer-account-id> --masterAccount <your-testnet-account-id> --initialBalance <your-buyer-account-balance>
```

4. Deploy the Contracts

```bash
near deploy --wasmFile build/escrow.wasm --accountId <your-escrow-testnet-account-id>
```

```bash
near deploy --wasmFile build/assets.wasm --accountId <your-assets-testnet-account-id>
```

5. Initialize the Assets Contract

```bash
near call <your-assets-testnet-account-id> init '{"owner_id": "<your-asset-owner-account-id>", "total_supply": "1000", "escrow_contract_id": "<your-escrow-testnet-account-id>", "asset_price": "100000000000000000000000"}' --accountId <your-assets-testnet-account-id>
```

6. Perform a Purchase on Escrow

```bash
near call <your-escrow-testnet-account-id> purchase_in_escrow '{"seller_account_id": "<your-asset-owner-account-id>", "asset_contract_id ": "<your-assets-testnet-account-id>"}' --accountId <your-buyer-account-id> --amount 0.11 --gas=300000000000000
```

7. Check the Balance of the Buyer Account

```bash
near view <your-assets-testnet-account-id> get_account_assets '{"account_id": "<your-buyer-account-id>"}'
```

```bash
near state <your-asset-owner-account-id>
```

8. Approve the Purchase

```bash
near call <your-escrow-testnet-account-id> approve_purchase '{}' --accountId <your-buyer-account-id>
```
