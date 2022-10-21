# Escrow Contract Example for NEAR in JavaScript

[![](https://img.shields.io/badge/⋈%20Examples-Basics-green)](https://docs.near.org/tutorials/welcome)
[![](https://img.shields.io/badge/Gitpod-Ready-orange)](https://gitpod.io/#/https://github.com/near-examples/escrow-js)
[![](https://img.shields.io/badge/Contract-JS-yellow)](https://docs.near.org/develop/contracts/anatomy)
[![](https://img.shields.io/badge/Tests-passing-green)](https://docs.near.org/develop/integrate/frontend)

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
