import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FungibleToken } from "../target/types/fungible_token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { assert } from "chai";
import * as dotenv from "dotenv";

dotenv.config();

describe("fungible-token-sol", async () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();

  const program = anchor.workspace.FungibleToken as Program<FungibleToken>;

  const [mintAccount, mint_bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint-account")],
    program.programId
  );

  const to_keypair = anchor.web3.Keypair.fromSecretKey(
    bs58.decode(process.env.TO_ADDRESS)
  );
  const toAddress = to_keypair.publicKey;
  console.log(toAddress);

  const tokenAccountMint = await getAssociatedTokenAddressSync(
    mintAccount,
    toAddress
  );

  const receiver_keypair = anchor.web3.Keypair.fromSecretKey(
    bs58.decode(process.env.RECEIVER)
  );

  const tokenAccountTransfer = await getAssociatedTokenAddressSync(
    mintAccount,
    provider.publicKey
  );

  const mintTokenAmount = 100000000;
  const burnTokenAmount = 10000000;
  const transferTokenAmount = 50000000;

  it("Initialize mint account", async () => {
    const tx = await program.methods
      .initialize(mint_bump)
      .accounts({
        owner: provider.publicKey,
        mint: mintAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([])
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Mint Token", async () => {
    const tokenBalance = await provider.connection.getTokenAccountBalance(
      tokenAccountMint
    );
    const toBalance = BigInt(tokenBalance.value.amount);

    const tx = await program.methods
      .mintToken(new anchor.BN(mintTokenAmount), mint_bump)
      .accounts({
        owner: provider.publicKey,
        mint: mintAccount,
        tokenAccount: tokenAccountMint,
        toAddress: toAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([])
      .rpc();

    console.log(tx);

    const newTokenBalance = await provider.connection.getTokenAccountBalance(
      tokenAccountMint
    );
    const newToBalance = BigInt(newTokenBalance.value.amount);

    assert.strictEqual(newToBalance, toBalance + BigInt(mintTokenAmount));
  });

  it("should burn token", async () => {
    const beforeBurn = await provider.connection.getTokenAccountBalance(
      tokenAccountMint
    );
    const beforeBurnBalance = BigInt(beforeBurn.value.amount);

    const tx = await program.methods
      .burnToken(new anchor.BN(burnTokenAmount))
      .accounts({
        owner: toAddress,
        mint: mintAccount,
        from: tokenAccountMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([to_keypair])
      .rpc();
    console.log(tx);

    const afterBurn = await provider.connection.getTokenAccountBalance(
      tokenAccountMint
    );
    const afterBurnBalance = BigInt(afterBurn.value.amount);

    assert.strictEqual(
      afterBurnBalance,
      beforeBurnBalance - BigInt(burnTokenAmount)
    );
  });

  it("should transfer token", async () => {
    const beforeTransferSenderAccount =
      await provider.connection.getTokenAccountBalance(tokenAccountMint);
    const beforeTransferBalanceSender = BigInt(
      beforeTransferSenderAccount.value.amount
    );

    const beforeTransferReceiverAccount =
      await provider.connection.getTokenAccountBalance(tokenAccountTransfer);
    const beforeTransferBalanceReceiver = BigInt(
      beforeTransferReceiverAccount.value.amount
    );
    const tx = await program.methods
      .transferToken(new anchor.BN(transferTokenAmount))
      .accounts({
        owner: toAddress,
        mint: mintAccount,
        to: provider.publicKey,
        from: tokenAccountMint,
        toTokenAccount: tokenAccountTransfer,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([to_keypair])
      .rpc();

    console.log(tx);

    const afterTransferSenderAccount =
      await provider.connection.getTokenAccountBalance(tokenAccountMint);
    const atferTransferBalanceSender = BigInt(
      afterTransferSenderAccount.value.amount
    );

    const afterTransferReceiverAccount =
      await provider.connection.getTokenAccountBalance(tokenAccountTransfer);
    const afterTransferBalanceReceiver = BigInt(
      afterTransferReceiverAccount.value.amount
    );

    assert.strictEqual(
      beforeTransferBalanceSender,
      atferTransferBalanceSender + BigInt(transferTokenAmount)
    );
    assert.strictEqual(
      beforeTransferBalanceReceiver,
      afterTransferBalanceReceiver - BigInt(transferTokenAmount)
    );
  });
});
