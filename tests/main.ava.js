import { NEAR, Worker } from "near-workspaces";
import test from "ava";

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = await Worker.init();

  // Prepare sandbox for tests, create accounts, deploy contracts, etx.
  const root = worker.rootAccount;

  // Deploy the contracts
  // const escrow = await root.devDeploy("./build/escrow.wasm");
  const escrow = await root.createSubAccount("escrow");
  await escrow.deploy("./build/escrow.wasm");
  const assets = await root.devDeploy("./build/assets.wasm", {
    method: "init",
    args: {
      owner_id: root.accountId,
      total_supply: "1000",
      escrow_contract_id: escrow.accountId,
      asset_price: "1" + "0".repeat(23), // 0.1 NEAR per asset
    },
  });

  // Create test accounts
  const alice = await root.createSubAccount("alice");
  const bob = await root.createSubAccount("bob");

  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { root, escrow, assets, alice, bob };
});

test.afterEach.always(async (t) => {
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed tear down the worker:", error);
  });
});

test("should return asset count for root account", async (t) => {
  const { root, assets } = t.context.accounts;
  const amount = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(amount, "1000");
});

test("alice purchases 10 assets from root on escrow", async (t) => {
  const { root, alice, escrow, assets } = t.context.accounts;

  // get root NEAR balance
  const rootBeforeNearBalance = await root.balance();
  t.is(rootBeforeNearBalance.total.toHuman().substring(0, 5), "1,049");

  // Alice purchases 10 assets from root
  await alice.call(
    escrow,
    "purchase_in_escrow",
    {
      seller_account_id: root.accountId,
      asset_contract_id: assets.accountId,
    },
    {
      attachedDeposit: NEAR.parse("1.01 N").toString(),
      gas: "300" + "0".repeat(12), // 300 Tgas
    }
  );

  // Check Alice's balance
  const aliceBalance = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalance, "10");

  // Check root's balance
  const rootBalance = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalance, "990");

  // Check root NEAR balance
  const rootAfterNearBalance = await root.balance();
  t.is(rootAfterNearBalance.total.toHuman().substring(0, 5), "1,049");
});

test("alice purchases 10 assets from root on escrow and then cancels", async (t) => {
  const { root, alice, escrow, assets } = t.context.accounts;

  // Alice purchases 10 assets from root
  await alice.call(
    escrow,
    "purchase_in_escrow",
    {
      seller_account_id: root.accountId,
      asset_contract_id: assets.accountId,
    },
    {
      attachedDeposit: NEAR.parse("1.01 N").toString(),
      gas: "300" + "0".repeat(12), // 300 Tgas
    }
  );

  // Check Alice's balance
  const aliceBalance = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalance, "10");

  // Check root's balance
  const rootBalance = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalance, "990");

  // Alice cancels the purchase
  await alice.call(escrow, "cancel_purchase", {}, { gas: "300" + "0".repeat(12) });

  // Check Alice's balance
  const aliceBalanceAfterCancel = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalanceAfterCancel, "0");

  // Check root's balance
  const rootBalanceAfterCancel = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalanceAfterCancel, "1000");

  // Check Alice has been refunded NEAR
  const aliceBalanceAfterRefund = await alice.balance();
  t.is(aliceBalanceAfterRefund.total.toHuman().substring(0, 5), "99.99");
});

test("alice purchases 10 assets from root on escrow and then transfers to bob", async (t) => {
  const { root, alice, bob, escrow, assets } = t.context.accounts;

  // Alice purchases 10 assets from root
  await alice.call(
    escrow,
    "purchase_in_escrow",
    {
      seller_account_id: root.accountId,
      asset_contract_id: assets.accountId,
    },
    {
      attachedDeposit: NEAR.parse("1.01 N").toString(),
      gas: "300" + "0".repeat(12), // 300 Tgas
    }
  );

  // Check Alice's balance
  const aliceBalance = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalance, "10");

  // Check root's balance
  const rootBalance = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalance, "990");

  try {
    // Alice transfers 10 assets to Bob
    await alice.call(assets, "transfer_asset", {
      quantity: "10",
      from_account_id: alice.accountId,
      to_account_id: bob.accountId,
    });
  } catch (error) {
    t.true(error.message.includes(`Only escrow contract can call this method but called by ${alice.accountId}`));
  }

  try {
    // Alice transfers 10 assets to Bob
    await alice.call(assets, "escrow_purchase_asset", {
      attached_near: "1" + "0".repeat(24), // 1 NEAR
      seller_account_id: alice.accountId,
      buyer_account_id: bob.accountId,
    });
  } catch (error) {
    t.true(error.message.includes(`Only escrow contract can call this method but called by ${alice.accountId}`));
  }

  // Check Alice's balance
  const aliceBalanceAfterTransfer = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalanceAfterTransfer, "10");

  // Check Bob's balance
  const bobBalance = await assets.view("get_account_assets", { account_id: bob.accountId });
  t.is(bobBalance, null);

  // Check root's balance
  const rootBalanceAfterTransfer = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalanceAfterTransfer, "990");

  // Check Alice does not have 10.01 NEAR
  const aliceNEARBalanceAfterTransfer = await alice.balance();
  t.is(aliceNEARBalanceAfterTransfer.total.toHuman().substring(0, 5), "98.98");
});

test("alice purchases 10 assets from root and then approves escrow purchase", async (t) => {
  const { root, alice, escrow, assets } = t.context.accounts;

  // Alice NEAR balance before purchase
  const aliceBeforeNearBalance = await alice.balance();
  t.is(aliceBeforeNearBalance.total.toHuman().substring(0, 5), "100 N");

  // root NEAR Balance before
  const rootBeforeNearBalance = await root.balance();
  t.is(rootBeforeNearBalance.total.toHuman().substring(0, 13), "1,049,999,599");

  // Alice purchases 10 assets from root
  await alice.call(
    escrow,
    "purchase_in_escrow",
    {
      seller_account_id: root.accountId,
      asset_contract_id: assets.accountId,
    },
    {
      attachedDeposit: NEAR.parse("1.01 N").toString(),
      gas: "300" + "0".repeat(12), // 300 Tgas
    }
  );

  // Check Alice's balance
  const aliceBalance = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalance, "10");

  // Check root's balance
  const rootBalance = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalance, "990");

  // Alice approves the purchase
  await alice.call(escrow, "approve_purchase", {});

  // Check Alice's NEAR Balance
  const aliceBalanceAfterApprove = await alice.balance();
  t.is(aliceBalanceAfterApprove.total.toHuman().substring(0, 5), "98.98");

  // Check root's NEAR Balance
  const rootBalanceAfterApprove = await root.balance();
  t.is(rootBalanceAfterApprove.total.toHuman().substring(0, 13), "1,049,999,601");
});

test("escrow timeout scan after alice purchases 10 assets from root", async (t) => {
  const { root, alice, escrow, assets } = t.context.accounts;

  // Alice NEAR balance before purchase
  const aliceBeforeNearBalance = await alice.balance();
  t.is(aliceBeforeNearBalance.total.toHuman().substring(0, 5), "100 N");

  // root NEAR Balance before
  const rootBeforeNearBalance = await root.balance();
  t.is(rootBeforeNearBalance.total.toHuman().substring(0, 13), "1,049,999,599");

  // Alice purchases 10 assets from root
  await alice.call(
    escrow,
    "purchase_in_escrow",
    {
      seller_account_id: root.accountId,
      asset_contract_id: assets.accountId,
    },
    {
      attachedDeposit: NEAR.parse("1.01 N").toString(),
      gas: "300" + "0".repeat(12), // 300 Tgas
    }
  );

  // root calls escrow timeout scan
  await root.call(escrow, "escrow_timeout_scan", {});

  // Check Alice's balance
  const aliceBalance = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalance, "10");

  // Check root's balance
  const rootBalance = await assets.view("get_account_assets", { account_id: root.accountId });
  t.is(rootBalance, "990");

  // Check Alice has spent NEAR
  const aliceBalanceAfterRefund = await alice.balance();
  t.is(aliceBalanceAfterRefund.total.toHuman().substring(0, 5), "98.98");

  // Check root's NEAR Balance increased by 1 NEAR
  const rootBalanceAfterRefund = await root.balance();
  t.is(rootBalanceAfterRefund.total.toHuman().substring(0, 13), "1,049,999,601");
});

test("alice purchases 10 assets from bob, who does not own any assets", async (t) => {
  const { alice, bob, escrow, assets } = t.context.accounts;

  // Alice NEAR balance before purchase
  const aliceBeforeNearBalance = await alice.balance();
  t.is(aliceBeforeNearBalance.total.toHuman().substring(0, 5), "100 N");

  // Bob NEAR Balance before
  const bobBeforeNearBalance = await bob.balance();
  t.is(bobBeforeNearBalance.total.toHuman().substring(0, 5), "100 N");

  // Alice purchases 10 assets from bob
  await alice.call(
    escrow,
    "purchase_in_escrow",
    {
      seller_account_id: bob.accountId,
      asset_contract_id: assets.accountId,
    },
    {
      attachedDeposit: NEAR.parse("1.01 N").toString(),
      gas: "300" + "0".repeat(12), // 300 Tgas
    }
  );

  // Check Alice's balance
  const aliceBalance = await assets.view("get_account_assets", { account_id: alice.accountId });
  t.is(aliceBalance, null);

  // Check bob's balance
  const bobBalance = await assets.view("get_account_assets", { account_id: bob.accountId });
  t.is(bobBalance, null);

  // Check Alice's NEAR Balance
  const aliceBalanceAfterCancel = await alice.balance();
  t.is(aliceBalanceAfterCancel.total.toHuman().substring(0, 5), "99.99");

  // Check bob's NEAR Balance
  const bobBalanceAfterCancel = await bob.balance();
  t.is(bobBalanceAfterCancel.total.toHuman().substring(0, 5), "100 N");
});
