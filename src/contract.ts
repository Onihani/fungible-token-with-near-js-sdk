// Find all our documentation at https://docs.near.org
import {
  NearBindgen,
  near,
  call,
  view,
  assert,
  initialize,
  LookupMap,
  Balance,
  NearPromise,
  ONE_YOCTO,
  PromiseOrValue,
} from "near-sdk-js";

// lib
import ContractLibrary from "./lib";

// models
import { FTMintEvent, FTBurnEvent } from "./common/models";

// constants
import {
  GAS_FOR_FT_TRANSFER_CALL,
  GAS_FOR_RESOLVE_TRANSFER,
  NO_DEPOSIT,
} from "./common/constants";

// helpers
import { findMinValue, promiseResult } from "./common/helpers";

// types
import {
  FTBalanceOfArgs,
  FTBurnArgs,
  FTMintArgs,
  FTResolveTransferArgs,
  FTTransferArgs,
  FTTransferCallArgs,
  FungibleTokenMetadata,
  NewArgs,
  NewDefaultMetaArgs,
  Nullable,
  StorageBalance,
  StorageBalanceBounds,
  StorageBalanceOfArgs,
  StorageDepositArgs,
} from "./common/types";

@NearBindgen({})
class Contract extends ContractLibrary {
  @initialize({})
  init({
    owner_id = near.signerAccountId(),
    total_supply = BigInt(0),
    metadata,
  }: NewArgs) {
    // Initialize the token with the owner_id as the owner
    this.ownerId = owner_id;
    this.metadata = metadata;
    this.total_supply = BigInt(total_supply);
    this.accounts = new LookupMap<Balance>("accounts");

    // Measure the bytes for the longest account ID and store it in the contract.
    this.measure_bytes_for_longest_account_id();

    // Register the owner's account and set their balance to the total supply.
    this.internal_register_account({ account_id: owner_id });
    this.internal_deposit({ account_id: owner_id, amount: total_supply });

    // Emit an event showing that the FTs were minted
    FTMintEvent.emit({
      accountId: owner_id,
      amount: total_supply,
      memo: "Initial token supply is minted",
    });
  }

  @initialize({})
  init_default_meta({ owner_id, total_supply }: NewDefaultMetaArgs) {
    // Initialize the token with the owner_id as the owner and default metadata
    this.init({
      owner_id,
      total_supply,
      metadata: this.metadata,
    });
  }

  /* STORAGE MANAGEMENT */
  @view({})
  storage_balance_bounds(): StorageBalanceBounds {
    // Calculate the required storage balance by taking the bytes for the longest account ID and multiplying by the current byte cost
    let requiredStorageBalance =
      this.bytes_for_longest_account_id * near.storageByteCost();

    // Storage balance bounds will have min == max == requiredStorageBalance
    return {
      min: requiredStorageBalance,
      max: requiredStorageBalance,
    };
  }

  @view({})
  storage_balance_of({
    account_id,
  }: StorageBalanceOfArgs): Nullable<StorageBalance> {
    // Get the storage balance of the account. Available will always be 0 since you can't overpay for storage.
    if (this.accounts.containsKey(account_id)) {
      return {
        total: this.storage_balance_bounds().min,
        available: BigInt(0),
      };
    } else {
      return null;
    }
  }

  @call({ payableFunction: true })
  storage_deposit({
    account_id,
    registration_only,
  }: StorageDepositArgs): Nullable<StorageBalance> {
    // Get the amount of $NEAR to deposit
    const amount = near.attachedDeposit();
    // If an account was specified, use that. Otherwise, use the predecessor account.
    let accountId = account_id ?? near.predecessorAccountId();

    // If the account is already registered, refund the deposit.
    if (this.accounts.containsKey(accountId)) {
      near.log("The account is already registered, refunding the deposit.");
      if (amount > BigInt(0)) {
        NearPromise.new(accountId).transfer(amount);
      }
    } else {
      // Register the account and refund any excess $NEAR
      // Get the minimum required storage and ensure the deposit is at least that amount
      const min_balance = this.storage_balance_bounds().min;

      if (amount < min_balance) {
        throw new Error(
          "The attached deposit is less than the minimum storage balance"
        );
      }

      // Register the account
      this.internal_register_account({ account_id: accountId });

      // Perform a refund
      const refund = amount - min_balance;
      if (refund > BigInt(0)) {
        NearPromise.new(accountId).transfer(refund);
      }
    }

    // Return the storage balance of the account
    return {
      total: this.storage_balance_bounds().min,
      available: BigInt(0),
    };
  }

  /* FT CORE */
  @view({})
  ft_metadata(): FungibleTokenMetadata {
    // Return the metadata of the token
    return this.metadata;
  }

  @view({})
  ft_total_supply(): bigint {
    // Return the total supply of the token
    return this.total_supply;
  }

  @view({})
  ft_balance_of({ account_id }: FTBalanceOfArgs): bigint {
    // Return the balance of the account_id
    return this.accounts.get(account_id, { defaultValue: BigInt(0) });
  }

  @call({ payableFunction: true })
  ft_transfer({ receiver_id, amount, memo }: FTTransferArgs) {
    // Assert that the user attached exactly 1 yoctoNEAR. This is for security and so that the user will be required to sign with a FAK.
    assert(near.attachedDeposit() == ONE_YOCTO, "1 yoctoNEAR must be attached");
    // The sender is the user who called the method
    const sender_id = near.predecessorAccountId();
    // How many tokens the user wants to withdraw
    const amt = amount;
    // Transfer the tokens
    this.internal_transfer({ sender_id, receiver_id, amount: amt, memo });
  }

  @call({ payableFunction: true })
  ft_transfer_call({
    receiver_id,
    amount,
    memo,
    msg,
  }: FTTransferCallArgs): PromiseOrValue<bigint> {
    // Assert that the user attached exactly 1 yoctoNEAR. This is for security and so that the user will be required to sign with a FAK.
    assert(near.attachedDeposit() == ONE_YOCTO, "1 yoctoNEAR must be attached");
    // The sender is the user who called the method
    const sender_id = near.predecessorAccountId();
    // How many tokens the user wants to withdraw
    const amt = amount;
    // Transfer the tokens
    this.internal_transfer({ sender_id, receiver_id, amount: amt, memo });

    // Initiating receiver's call and the callback
    // Defaulting GAS weight to 1, no attached deposit, and static GAS equal to the GAS for ft transfer call.
    const promise = NearPromise.new(receiver_id)
      .functionCall(
        "ft_on_transfer",
        JSON.stringify({
          sender_id,
          amount: amt,
          msg,
        }),
        NO_DEPOSIT,
        GAS_FOR_FT_TRANSFER_CALL
      )
      .then(
        NearPromise.new(near.currentAccountId()).functionCall(
          "ft_resolve_transfer",
          JSON.stringify({
            sender_id,
            receiver_id,
            amount: amt,
          }),
          NO_DEPOSIT,
          GAS_FOR_RESOLVE_TRANSFER
        )
      );

    return promise.asReturn();
  }

  @call({ privateFunction: true })
  ft_resolve_transfer({
    sender_id,
    receiver_id,
    amount,
  }: FTResolveTransferArgs): bigint {
    const amt = BigInt(amount);

    // Get the unused amount from the `ft_on_transfer` call result.
    const { result, success } = promiseResult();

    let unused_amount = amt;

    // If the call was successful, get the return value and cast it to a U128
    if (success) {
      // If we can properly parse the value, the unused amount is equal to whatever is smaller - the unused amount or the original amount (to prevent malicious contracts)
      unused_amount =
        result != null ? findMinValue(amt, BigInt(JSON.parse(result))) : amt;
    } else {
      // If the promise wasn't successful, return the original amount.
      unused_amount = amt;
    }

    // If there is some unused amount, we should refund the sender
    if (unused_amount > BigInt(0)) {
      // Get the receiver's balance. We can only refund the sender if the receiver has enough balance.
      const receiver_balance = this.accounts.get(receiver_id, {
        defaultValue: BigInt(0),
      });

      near.log("receiver balance", unused_amount);

      if (receiver_balance > BigInt(0)) {
        // The amount to refund is the smaller of the unused amount and the receiver's balance as we can only refund up to what the receiver currently has.
        const refund_amount = findMinValue(unused_amount, receiver_balance);

        // Refund the sender for the unused amount
        this.internal_transfer({
          sender_id: receiver_id,
          receiver_id: sender_id,
          amount: refund_amount,
          memo: "Refund from ft_transfer_call",
        });

        // Return what was actually used (the amount sent - refund)
        const used_amount = amt - refund_amount;
        return used_amount;
      }
    }

    // Return the amount that was actually used
    return amt;
  }

  /* CUSTOM METHODS */
  @view({})
  name() {
    return this.metadata.name;
  }

  @view({})
  owner() {
    return this.ownerId;
  }

  @view({})
  symbol() {
    return this.metadata.symbol;
  }

  @view({})
  decimals() {
    return this.metadata.decimals;
  }

  @call({})
  mint({ accountId, amount, memo }: FTMintArgs) {
    // Assert that the caller is the owner
    assert(
      near.predecessorAccountId() == this.ownerId,
      "Only the owner can mint tokens"
    );

    // Mint the tokens
    this.internal_deposit({ account_id: accountId, amount });

    // increase the total supply
    this.total_supply += BigInt(amount);

    // Emit the mint event
    FTMintEvent.emit({ accountId, amount, memo });
  }

  @call({})
  burn({ amount, memo }: FTBurnArgs) {
    // Assert that the caller is the account holder
    assert(
      near.predecessorAccountId() == near.signerAccountId() &&
        this.accounts.containsKey(near.signerAccountId()),
      "Only the account holder can burn tokens"
    );

    // Burn the tokens
    this.internal_withdraw({ account_id: near.signerAccountId(), amount });

    // decrease the total supply
    this.total_supply -= BigInt(amount);

    // Emit the burn event
    FTBurnEvent.emit({ accountId: near.signerAccountId(), amount, memo });
  }
}
