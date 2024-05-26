import { Worker, NearAccount } from "near-workspaces";
import anyTest, { TestFn } from "ava";
import { setDefaultResultOrder } from "dns";
import { AccountId } from "near-sdk-js";
setDefaultResultOrder("ipv4first"); // temp fix for node >v17

// types
import {
  FungibleTokenMetadata,
  Nullable,
  StorageBalance,
  StorageBalanceBounds,
} from "../src/common/types";

// Global context
const test = anyTest as TestFn<{
  worker: Worker;
  accounts: Record<string, NearAccount>;
}>;

test.beforeEach(async (t) => {
  // Create sandbox, accounts, deploy contracts, etc.
  const worker = (t.context.worker = await Worker.init());

  // Deploy contract
  const root = worker.rootAccount;
  const contract = await root.createSubAccount("test-account");
  const account1 = await root.createSubAccount("account1");
  const account2 = await root.createSubAccount("account2");

  // Get wasm file path from package.json test script in folder above
  await contract.deploy(process.argv[2]);

  // initialize the fungible token contract
  await root.call(contract, "init_default_meta", {});

  // Save state for test runs, it is unique for each test
  t.context.accounts = { root, contract, account1, account2 };
});

test.afterEach.always(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("returns the default metadata", async (t) => {
  const { contract } = t.context.accounts;
  const metadata: FungibleTokenMetadata = await contract.view(
    "ft_metadata",
    {}
  );
  t.is(metadata.spec, "ft-1.0.0");
  t.is(metadata.name, "Justin Case Fungible Token");
  t.is(metadata.symbol, "JC-FT");
  t.is(metadata.decimals, 18);
});

test("sets root account id as contract owner", async (t) => {
  const { root, contract } = t.context.accounts;
  const ownerId: AccountId = await contract.view("owner", {});
  t.is(ownerId, root.accountId);
});

test("should return the storage balance bounds", async (t) => {
  const { contract } = t.context.accounts;
  const bounds: StorageBalanceBounds = await contract.view(
    "storage_balance_bounds",
    {}
  );
  t.true(bounds.min > 0);
});

test("should register an account with storage deposit", async (t) => {
  const { root, contract } = t.context.accounts;
  const accountId = root.accountId;

  // get the storage balance bounds
  const storageBounds: StorageBalanceBounds = await contract.view(
    "storage_balance_bounds",
    {}
  );

  await root.call(
    contract,
    "storage_deposit",
    { account_id: accountId },
    {
      attachedDeposit: storageBounds.min.toString(),
    }
  );
  const storageBalance: Nullable<StorageBalance> = await contract.view(
    "storage_balance_of",
    {
      account_id: accountId,
    }
  );
  t.true(storageBalance.total >= BigInt(storageBounds.min));
});

test("should be able to mint tokens", async (t) => {
  const { root, contract } = t.context.accounts;

  const accountId = root.accountId;

  // get the storage balance bounds
  const storageBounds: StorageBalanceBounds = await contract.view(
    "storage_balance_bounds",
    {}
  );

  // register the root account
  await root.call(
    contract,
    "storage_deposit",
    { account_id: accountId },
    {
      attachedDeposit: storageBounds.min.toString(),
    }
  );

  const amount = "100";
  await root.call(contract, "mint", { accountId, amount });
  const balance: string = await contract.view("ft_balance_of", {
    account_id: accountId,
  });
  t.is(balance, amount);
});

test("should be able to transfer tokens", async (t) => {
  const { root, contract, account1 } = t.context.accounts;

  const accountId = root.accountId;
  const account1Id = account1.accountId;

  // get the storage balance bounds
  const storageBounds: StorageBalanceBounds = await contract.view(
    "storage_balance_bounds",
    {}
  );

  // register the root account
  await root.call(
    contract,
    "storage_deposit",
    { account_id: accountId },
    {
      attachedDeposit: storageBounds.min.toString(),
    }
  );

  // register the alice account
  await account1.call(
    contract,
    "storage_deposit",
    { account_id: account1Id },
    {
      attachedDeposit: storageBounds.min.toString(),
    }
  );

  const amount = "100";
  const transferAmount = "40";
  await root.call(contract, "mint", { accountId, amount });
  await root.call(
    contract,
    "ft_transfer",
    {
      receiver_id: account1Id,
      amount: transferAmount,
      memo: "test transfer",
    },
    {
      attachedDeposit: "1",
    }
  );
  const account1Balance: string = await contract.view("ft_balance_of", {
    account_id: account1Id,
  });
  const rootBalance: string = await contract.view("ft_balance_of", {
    account_id: accountId,
  });

  t.is(account1Balance, transferAmount);
  t.is(rootBalance, "60");
});
