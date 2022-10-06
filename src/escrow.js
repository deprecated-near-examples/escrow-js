import { call, LookupMap, NearBindgen, view, assert, near } from "near-sdk-js";

@NearBindgen({})
export class EscrowContract {
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

  @call({ payableFunction: true })
  purchase_in_escrow({ seller_account_id }) {
    const buyerAccountId = near.predecessorAccountId();
    assert(seller_account_id !== buyerAccountId, "Cannot escrow to the same account");
    assert(buyerAccountId !== near.currentAccountId(), "Cannot escrow from the contract itself");
    const amount = near.attachedDeposit();
    assert(amount > 0, "Must attach a positive amount");
    assert(!this.accountsValueLocked.contains(buyerAccountId), "Cannot escrow purchase twice  before completing one first: feature not implemented");
    this.accountsReceivers.set(buyerAccountId, receiver_id);
    this.accountsValueLocked.set(buyerAccountId, amount.toString());
    this.accountsTimeCreated.set(buyerAccountId, near.blockTimestamp().toString());
    // TODO: call asset contract to transfer the asset to the buyerAccountId
  }

  @call({})
  escrow_timeout_scan({}) {
    for (const [account_id, time_created] of this.accountsTimeCreated) {
      if (BigInt(time_created) + 86400 < near.blockTimestamp()) {
        const receiver_id = this.accountsReceivers.get(account_id);
        const amount = BigInt(this.accountsValueLocked.get(account_id));
        this.internalSendNEAR(receiver_id, amount);
        this.accountsReceivers.delete(account_id);
        this.accountsValueLocked.delete(account_id);
        this.accountsTimeCreated.delete(account_id);
      }
    }
  }

  @call({})
  approve_escrow({}) {
    const buyerAccountId = near.predecessorAccountId();
    assert(this.accountsValueLocked.contains(buyerAccountId), "Cannot approve escrow purchase before escrowing");
    const sellerAccountId = this.accountsReceivers.get(buyerAccountId);
    const amount = BigInt(this.accountsValueLocked.get(buyerAccountId));
    this.internalSendNEAR(sellerAccountId, amount);
    this.accountsReceivers.delete(buyerAccountId);
    this.accountsValueLocked.delete(buyerAccountId);
    this.accountsTimeCreated.delete(buyerAccountId);
  }

  @call({})
  cancel_escrow_transaction({}) {
    const buyerAccountId = near.predecessorAccountId();
    const amountStr = this.accountsValueLocked.get(buyerAccountId);
    if (!amountStr) {
      throw new Error(`No escrow purchase found for buyer: ${buyerAccountId}`);
    }
    const amount = BigInt(amountStr);
    this.internalSendNEAR(buyerAccountId, amount);
    this.accountsReceivers.delete(buyerAccountId);
    this.accountsValueLocked.delete(buyerAccountId);
    this.accountsTimeCreated.delete(buyerAccountId);
    // TODO: call asset contract to transfer the asset back to the seller_account_id
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
