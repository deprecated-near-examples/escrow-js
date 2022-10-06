import { call, LookupMap, NearBindgen, assert, near } from "near-sdk-js";

@NearBindgen({ requireInit: true })
export class AssetContract {
  ESCROW_CONTRACT_ID = "escrow.testnet";
  totalSupply = "0";
  accountAssets = new LookupMap("aa");

  @initialize({})
  init({ owner_id, total_supply }) {
    assert(BigInt(total_supply) > BigInt(0), "Total supply should be a positive number");
    assert(this.totalSupply === "0", "Contract is already initialized");
    this.totalSupply = total_supply;
    this.accountAssets.set(owner_id, this.totalSupply);
  }

  @call({})
  transfer_asset({ quantity, from_account_id, to_account_id }) {
    assert(near.predecessorAccountId() === this.ESCROW_CONTRACT_ID, "Only escrow contract can call this method");
    const receivingAccountId = to_account_id;
    assert(this.accountAssets.containsKey(from_account_id), `Sender account ${from_account_id} does not own any assets`);
    const senderAssets = BigInt(this.accountAssets.get(from_account_id));
    assert(senderAssets >= BigInt(quantity), `Sender account ${from_account_id} does not own enough (${senderAssets.toString()} of required ${quantity}) assets`);
    const sellerNewAssets = senderAssets - BigInt(quantity);
    this.accountAssets.set(from_account_id, sellerNewAssets.toString());
    if (this.accountAssets.containsKey(receivingAccountId)) {
        const receivingAccountAssets = BigInt(this.accountAssets.get(receivingAccountId));
        const receivingAccountNewAssets = receivingAccountAssets + BigInt(quantity);
        this.accountAssets.set(receivingAccountId, receivingAccountNewAssets.toString());
        return 
    }
    this.accountAssets.set(receivingAccountId, quantity);
  }
}
