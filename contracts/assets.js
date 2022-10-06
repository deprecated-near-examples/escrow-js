import { call, LookupMap, NearBindgen, assert, near, view, initialize } from "near-sdk-js";

@NearBindgen({ requireInit: true })
export class AssetContract {
  assetPrice = "";
  escrowContractId = "";
  totalSupply = "0";
  accountAssets = new LookupMap("aa");

  @initialize({})
  init({ owner_id, total_supply, escrow_contract_id, asset_price }) {
    assert(BigInt(total_supply) > BigInt(0), "Total supply should be a positive number");
    assert(this.totalSupply === "0", "Contract is already initialized");
    this.totalSupply = total_supply;
    this.escrowContractId = escrow_contract_id;
    this.assetPrice = asset_price;
    this.accountAssets.set(owner_id, this.totalSupply);
  }

  @view({})
  get_asset_price({}) {
    return this.assetPrice;
  }

  @view({})
  get_total_supply({}) {
    return this.totalSupply;
  }

  @call({})
  transfer_asset({ quantity, from_account_id, to_account_id }) {
    assert(near.predecessorAccountId() === this.escrowContractId, "Only escrow contract can call this method");
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
      return;
    }
    this.accountAssets.set(receivingAccountId, quantity);
  }
}