import { call, LookupMap, NearBindgen, view, assert, near } from "near-sdk-js";

@NearBindgen({})
export class EscrowContract {
  GAS_FEE = 10000000000000;  // 100 TGAS
  accountsReceivers = new LookupMap("ea");
  accountsValueLocked = new LookupMap("avl");
  accountsTimeCreated = new LookupMap("atc");
  accountCronCatHash = "";

  internalSendNEAR(receivingAccountId, amountBigInt) {
    assert(amountBigInt > BigInt("0"), "The amount should be a positive number");
    assert(receivingAccountId != near.currentAccountId(), "Can't transfer to the contract itself");
    assert(amountBigInt < near.accountBalance(), `Not enough balance ${near.accountBalance()} to cover transfer of ${amountBigInt} yoctoNEAR`);
    const transferPromiseId = near.promiseBatchCreate(receivingAccountId);
    near.promiseBatchActionTransfer(transferPromiseId, amountBigInt);
    near.promiseReturn(transferPromiseId);
  }

  internalCompleteNEARTransaction(sellerAccountId, amountBigInt, buyerAccountId) {
    this.internalSendNEAR(sellerAccountId, amountBigInt);
    this.accountsReceivers.delete(buyerAccountId);
    this.accountsValueLocked.delete(buyerAccountId);
    this.accountsTimeCreated.delete(buyerAccountId);
  }

  internalCrossContractTransferAsset(assetContractId, amountBigInt, fromAccountId, toAccountId) {
    const getAssetPricePromiseId = near.promiseBatchCreate(assetContractId);
    near.promiseBatchActionFunctionCall(getAssetPricePromiseId, "get_asset_price", {}, 0, 0);
    const assetPriceStr = JSON.parse(near.promiseResult(getAssetPricePromiseId))[0];
    const assetPrice = BigInt(assetPriceStr);
    assert(amountBigInt >= assetPrice, `Not enough NEAR to purchase the asset. Need ${assetPrice + BigInt(this.GAS_FEE)} yoctoNEAR, but only attached ${amountBigInt} yoctoNEAR`);
    const quantity = amountBigInt / (assetPrice - BigInt(this.GAS_FEE));
    const transferPromiseId = near.promiseBatchCreate(assetContractId);
    near.promiseBatchActionFunctionCall(transferPromiseId, "transfer_asset", { quantity: quantity.toString(), from_account_id: fromAccountId, to_account_id: toAccountId }, 0, this.GAS_FEE);
    near.promiseReturn(transferPromiseId);
  }

  @call({ payableFunction: true })
  purchase_in_escrow({ seller_account_id, asset_contract_id }) {
    const buyerAccountId = near.predecessorAccountId();
    assert(seller_account_id !== buyerAccountId, "Cannot escrow to the same account");
    assert(buyerAccountId !== near.currentAccountId(), "Cannot escrow from the contract itself");
    const amount = near.attachedDeposit();
    assert(amount > 0, "Must attach a positive amount");
    assert(!this.accountsValueLocked.contains(buyerAccountId), "Cannot escrow purchase twice  before completing one first: feature not implemented");
    this.accountsReceivers.set(buyerAccountId, seller_account_id);
    this.accountsValueLocked.set(buyerAccountId, amount.toString());
    this.accountsTimeCreated.set(buyerAccountId, near.blockTimestamp().toString());
    this.internalCrossContractTransferAsset(asset_contract_id, amount, seller_account_id, buyerAccountId);
  }

  @call({})
  escrow_timeout_scan({}) {
    for (const [buyerAccountId, timeCreatedStr] of this.accountsTimeCreated) {
      if (BigInt(timeCreatedStr) + 86400 < near.blockTimestamp()) {
        const receiver_id = this.accountsReceivers.get(buyerAccountId);
        const amount = BigInt(this.accountsValueLocked.get(buyerAccountId));
        this.internalCompleteNEARTransaction(receiver_id, amount, buyerAccountId);
      }
    }
  }

  @call({})
  approve_escrow({}) {
    assert(this.accountsValueLocked.containsKey(buyerAccountId), "Cannot approve escrow purchase before escrowing");
    const buyerAccountId = near.predecessorAccountId();
    const sellerAccountId = this.accountsReceivers.get(buyerAccountId);
    const amount = BigInt(this.accountsValueLocked.get(buyerAccountId));
    this.internalCompleteNEARTransaction(sellerAccountId, amount, buyerAccountId);
  }

  @call({})
  cancel_escrow_transaction({}) {
    const buyerAccountId = near.predecessorAccountId();
    const amountStr = this.accountsValueLocked.get(buyerAccountId);
    if (!amountStr) {
      throw new Error(`No escrow purchase found for buyer: ${buyerAccountId}`);
    }
    const amount = BigInt(amountStr);
    this.internalCompleteNEARTransaction(buyerAccountId, amount, buyerAccountId); // return funds to buyer
    const sellerAccountId = this.accountsReceivers.get(buyerAccountId);
    this.internalCrossContractTransferAsset(asset_contract_id, amount, buyerAccountId, sellerAccountId);
  }

  @view({})
  view_pending_escrow({ account_id }) {
    return {
      receiver_id: this.accountsReceivers.get(account_id),
      amount: this.accountsValueLocked.get(account_id),
      time_created: this.accountsTimeCreated.get(account_id),
    };
  }
}
