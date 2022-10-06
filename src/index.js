import { call, LookupMap, NearBindgen, view, assert, near } from "near-sdk-js";

@NearBindgen({ initRequired: true })
export class FungibleToken {
  accountsReceivers = new LookupMap("ea");
  accountsValueLocked = new LookupMap("avl");
  accountsTimeCreated = new LookupMap("atc");
  accountCronCatHash = "";

  @call({ payableFunction: true })
  transfer_in_escrow({ receiver_id }) {
    const predecessorAccountId = near.predecessorAccountId();
    assert(receiver_id !== predecessorAccountId, "Cannot escrow to the same account");
    assert(predecessorAccountId !== near.currentAccountId(), "Cannot escrow from the contract itself");
    const amount = near.attachedDeposit();
    assert(amount > 0, "Must attach a positive amount");
    this.accountsReceivers.set(predecessorAccountId, receiver_id);
    this.accountsValueLocked.set(predecessorAccountId, amount);
    this.accountsTimeCreated.set(predecessorAccountId, near.blockTimestamp());
  }

  @call({})
  escrow_timeout_scan({}) {
    // iterate through accountsTimeCreated
    // if time_created + 1 day < blockTimestamp
    //   transfer amount to account_id
    //   delete account_id from all maps
    for (const [account_id, time_created] of this.accountsTimeCreated) {
      if (time_created + 86400 < near.blockTimestamp()) {
        const receiver_id = this.accountsReceivers.get(account_id);
        const amount = this.accountsValueLocked.get(account_id);
        this.accountsReceivers.delete(account_id);
        this.accountsValueLocked.delete(account_id);
        this.accountsTimeCreated.delete(account_id);
        near.transfer(receiver_id, amount);
      }
    }
    
    throw new Error("Not implemented");
  }

  @call({})
  unlock_escrow({ amount }) {
    throw new Error("Not implemented");
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
