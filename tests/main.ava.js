import { Worker } from "near-workspaces";
import test from "ava";

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = await Worker.init();

  // Prepare sandbox for tests, create accounts, deploy contracts, etx.
  const root = worker.rootAccount;

  // Deploy the contracts
  const escrow = await root.devDeploy("./build/escrow.wasm");
  const assets = await root.devDeploy("./build/assets.wasm", {
    method: "init",
    args: {
        owner_id: root.accountId, 
        total_supply: "1000",
        escrow_contract_id: escrow.accountId,
        asset_price: "1" + "0".repeat(23) // 0.1 NEAR per asset
    }
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

test("transfer asset", async (t) => {
  t.pass();
});
