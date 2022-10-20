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

  @call({})
  escrow_purchase_asset({ seller_account_id, buyer_account_id, attached_near }) {
    try {
      assert(near.predecessorAccountId() === this.escrowContractId, `Only escrow contract can call this method but called by ${near.predecessorAccountId()}`);
      assert(this.accountAssets.containsKey(seller_account_id), `Seller account ${seller_account_id} does not own any assets`);
      assert(BigInt(this.assetPrice) <= BigInt(attached_near), `Attached ${attached_near} is not enough to buy the asset`);
      
      const quantity = BigInt(attached_near) / BigInt(this.assetPrice);
      const sellerAssets = BigInt(this.accountAssets.get(seller_account_id));
      assert(sellerAssets >= BigInt(quantity), `Seller account ${seller_account_id} does not own enough (${sellerAssets.toString()} of required ${quantity}) assets`);
      
      const sellerNewAssets = sellerAssets - BigInt(quantity);
      this.accountAssets.set(seller_account_id, sellerNewAssets.toString());
      const receivingAccountNewAssets = this.accountAssets.containsKey(buyer_account_id) ? BigInt(this.accountAssets.get(buyer_account_id)) + BigInt(quantity) : BigInt(quantity);
      this.accountAssets.set(buyer_account_id, receivingAccountNewAssets.toString());
      return { success: true, seller_account_id, buyer_account_id, quantity: quantity.toString(), amount: attached_near, asset_account_id: near.currentAccountId() };
    } catch (e) {
      near.log("error: ", e, e.message, e.stack);
      return { success: false, error: e, message: e.message, stack: e.stack, seller_account_id, buyer_account_id, amount: attached_near, asset_account_id: near.currentAccountId() };
    }
  }

  @view({})
  get_total_supply({}) {
    return this.totalSupply;
  }

  @view({})
  get_account_assets({ account_id }) {
    return this.accountAssets.get(account_id);
  }

  @call({})
  transfer_asset({ quantity, from_account_id, to_account_id }) {
    assert(near.predecessorAccountId() === this.escrowContractId, `Only escrow contract can call this method but called by ${near.predecessorAccountId()}`);
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
