import { call, LookupMap, NearBindgen, view, assert, near, NearPromise } from "near-sdk-js";

@NearBindgen({})
export class EscrowContract {
  GAS_FEE = 10000000000000; // 100 TGAS
  accountsReceivers = new LookupMap("ea");
  accountsValueLocked = new LookupMap("avl");
  accountsTimeCreated = new LookupMap("atc");

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

  internalCrossContractTransferAsset(assetContractId, quantityBigInt, fromAccountId, toAccountId) {
    const transferPromiseId = near.promiseBatchCreate(assetContractId);
    near.promiseBatchActionFunctionCall(
      transferPromiseId,
      "transfer_asset",
      JSON.stringify({ quantity: quantityBigInt.toString(), from_account_id: fromAccountId, to_account_id: toAccountId }),
      0,
      this.GAS_FEE
    );
    near.promiseReturn(transferPromiseId);
  }

  @call({ payableFunction: true })
  purchase_in_escrow({ seller_account_id, asset_contract_id, asset_price }) {
    const buyerAccountId = near.predecessorAccountId();
    assert(seller_account_id !== buyerAccountId, "Cannot escrow to the same account");
    assert(buyerAccountId !== near.currentAccountId(), "Cannot escrow from the contract itself");
    const amount = near.attachedDeposit();
    assert(amount > 0, "Must attach a positive amount");
    assert(!this.accountsValueLocked.containsKey(buyerAccountId), "Cannot escrow purchase twice  before completing one first: feature not implemented");
    assert(BigInt(asset_price) > 0, "Asset price must be a positive number");
    assert(BigInt(asset_price) + BigInt(this.GAS_FEE) <= amount, `Not enough balance ${amount} to cover transfer of ${asset_price} yoctoNEAR and ${this.GAS_FEE} yoctoNEAR for gas`);
    this.accountsReceivers.set(buyerAccountId, seller_account_id);
    this.accountsValueLocked.set(buyerAccountId, amount.toString());
    this.accountsTimeCreated.set(buyerAccountId, near.blockTimestamp().toString());
    const quantity = (amount - BigInt(this.GAS_FEE)) / BigInt(asset_price);
    this.internalCrossContractTransferAsset(asset_contract_id, quantity, seller_account_id, buyerAccountId);
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
