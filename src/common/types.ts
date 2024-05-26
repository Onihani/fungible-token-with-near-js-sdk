import { AccountId, Balance, StorageUsage } from "near-sdk-js";

// custom
export type Nullable<T> = T | null;

export type FTMintArgs = {
  accountId: AccountId,
  amount: Balance;
  memo?: string;
} 

export type FTBurnArgs = {
  accountId?: AccountId,
  amount: Balance;
  memo?: string;
}

// metadata
export type FungibleTokenMetadata = {
  spec: string; // Should be ft-1.0.0 to indicate that a Fungible Token contract adheres to the current versions of this Metadata and the Fungible Token Core specs. This will allow consumers of the Fungible Token to know if they support the features of a given contract.
  name: string; // The human-readable name of the token.
  symbol: string; // The abbreviation, like wETH or AMPL.
  icon: string; // Icon of the fungible token.
  reference?: Nullable<string>; // A link to a valid JSON file containing various keys offering supplementary details on the token
  reference_hash?: Nullable<string>; // The base64-encoded sha256 hash of the JSON file contained in the reference field. This is to guard against off-chain tampering.
  decimals: number; // used in frontends to show the proper significant digits of a token. This concept is explained well in this OpenZeppelin post. https://docs.openzeppelin.com/contracts/3.x/erc20#a-note-on-decimals
};

// storage
export type StorageBalance = {
  total: StorageUsage,
  available: StorageUsage,
}

export type StorageBalanceBounds = {
  min: StorageUsage;
  max?: StorageUsage;
};

export type StorageBalanceOfArgs = {
  account_id: AccountId;
};

export type StorageDepositArgs = {
  account_id?: AccountId;
  registration_only?: boolean;
};

// lib
export type NewArgs = {
  owner_id: AccountId;
  total_supply?: Balance;
  metadata: FungibleTokenMetadata;
};

export type NewDefaultMetaArgs = {
  owner_id: AccountId;
  total_supply?: Balance;
};

// ft-core
export type FTTransferArgs = {
  receiver_id: AccountId;
  amount: Balance;
  memo?: string;
};

export type FTTransferCallArgs = {
  receiver_id: AccountId;
  amount: Balance;
  memo?: string;
  msg: string;
};

export type FTTotalSupplyArgs = {};

export type FTBalanceOfArgs = {
  account_id: AccountId;
};

export type FTResolveTransferArgs = {
  sender_id: AccountId;
  receiver_id: AccountId;
  amount: Balance;
};

// internal
export type InternalDepositArgs = {
  account_id: AccountId;
  amount: Balance;
};

export type InternalWithdrawArgs = {
  account_id: AccountId;
  amount: Balance;
};

export type InternalTransferArgs = {
  sender_id: AccountId;
  receiver_id: AccountId;
  amount: Balance;
  memo?: string;
};

export type InternalUnwrapBalanceOfArgs = {
  account_id: AccountId;
};

// Events 
export enum FTEventKind {
  mint = "ft_mint",
  burn = "ft_burn",
  transfer = "ft_transfer",
  transfer_call = "ft_transfer_call",
  resolve_transfer = "ft_resolve_transfer",
}

export type EVENTJSON = {
  standard: "nep141";
  version: "1.0.0";
  event: FTEventKind;
  data: Array<Record<string, string>>;
};

export type FTTransferEventData = {
  sender_id: AccountId;
  receiver_id: AccountId;
  amount: Balance;
  memo?: string;
};