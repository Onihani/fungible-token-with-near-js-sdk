import {
  NearBindgen,
  AccountId,
  Balance,
  LookupMap,
  StorageUsage,
  assert,
  near,
} from "near-sdk-js";

// models
import { FTTransferEvent } from "./common/models";

// constants
import { DEFAULT_METADATA } from "./common/constants";

// types
import {
  FungibleTokenMetadata,
  InternalDepositArgs,
  InternalTransferArgs,
  InternalUnwrapBalanceOfArgs,
  InternalWithdrawArgs,
} from "./common/types";

@NearBindgen({})
export class ContractLibrary {
  /* ==== State ==== */
  // Keep track of FT contract owner
  ownerId: AccountId = "";
  // Keep track of each account's balances
  accounts: LookupMap<Balance> = new LookupMap<Balance>("accounts");
  // Total supply of all tokens.
  total_supply: Balance = BigInt(0);
  // The bytes for the largest possible account ID that can be registered on the contract
  bytes_for_longest_account_id: StorageUsage = BigInt(0);
  // Metadata for the contract itself
  metadata: FungibleTokenMetadata = DEFAULT_METADATA;

  /* INTERNAL FUNCTIONS */
  internal_deposit({ account_id, amount }: InternalDepositArgs) {
    //  Get the current balance of the account.  If they're not registered, panic.
    const balance = this.internal_unwrap_balance_of({ account_id });

    // Add the amount to the balance
    const new_balance = balance + BigInt(amount);

    // insert the new balance into the accounts map
    // TODO: in the future check for balance overflow errors before depositing
    this.accounts.set(account_id, new_balance);
  }

  internal_withdraw({ account_id, amount }: InternalWithdrawArgs) {
    // Get the current balance of the account. If they're not registered, panic.
    const balance = this.internal_unwrap_balance_of({ account_id });

    // Ensure the account has enough balance to withdraw
    assert(balance >= amount, "The account doesn't have enough balance");

    // Subtract the amount from the balance
    const new_balance = balance - BigInt(amount);

    // Insert the new balance into the accounts map
    this.accounts.set(account_id, new_balance);
  }

  internal_transfer({
    sender_id,
    receiver_id,
    amount,
    memo,
  }: InternalTransferArgs) {
    // Ensure the sender can't transfer to themselves
    assert(sender_id != receiver_id, "Sender and receiver should be different");
    // Ensure the sender can't transfer 0 tokens
    assert(amount > BigInt(0), "The amount should be a positive number");

    // Withdraw from the sender and deposit into the receiver
    this.internal_withdraw({ account_id: sender_id, amount });
    this.internal_deposit({ account_id: receiver_id, amount });

    // Emit the transfer event
    FTTransferEvent.emit({ sender_id, receiver_id, amount, memo });
  }

  // Internal method for registering an account with the contract.
  internal_register_account({ account_id }: { account_id: AccountId }): void {
    if (this.accounts.containsKey(account_id)) {
      throw new Error("The account is already registered.");
    }
    // Register the account with a balance of 0
    this.accounts.set(account_id, BigInt(0));
  }

  // Internal method for force getting the balance of an account. If the account doesn't have a balance, panic with a custom message.
  internal_unwrap_balance_of({
    account_id,
  }: InternalUnwrapBalanceOfArgs): Balance {
    const balance = this.accounts.get(account_id);
    if (balance == null) {
      throw new Error(`The account ${account_id} is not registered.`);
    }
    return balance;
  }

  measure_bytes_for_longest_account_id() {
    let initialStorageUsage = near.storageUsage();
    let tmpAccountId = "a".repeat(64);
    this.accounts.set(tmpAccountId, BigInt(0));
    this.bytes_for_longest_account_id =
      near.storageUsage() - initialStorageUsage;
    this.accounts.remove(tmpAccountId);
  }
}

export default ContractLibrary;
