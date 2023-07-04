import * as anchor from "@coral-xyz/anchor";
import * as web3 from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as spl_token from '@solana/spl-token';
import { DECIMAL, loadPoolProgram, loadWalletKey, sleep, transferSolana } from "./utils/various";
import { expect } from "chai";

let connection: anchor.web3.Connection;
let walletKeyPair: web3.Keypair;
let swapProgram: any;
let MOVE_TOKEN: web3.PublicKey;
let tokenAccount: web3.PublicKey;
let aliceWallet: web3.Keypair;
let bobWallet: web3.Keypair;
let aliceTokenAccount: web3.PublicKey;
let bobTokenAccount: web3.PublicKey;
let liquidityPoolKeypair: web3.Keypair;
let pool: web3.PublicKey;

const masterWallet = loadWalletKey("/Users/dai/Documents/drw-blockchain/test/hero-rmYMpn5oYzKfMaBEvku9XCakFQEfsr4GNpFAsBgCPjy.json");

describe("solana-swap", () => {
  before(async () => {
    console.log("Initializing and configuring...");
    console.log("Please wait a moment!");

    connection = new anchor.web3.Connection(
      "https://solana-devnet.g.alchemy.com/v2/jFn2wegh5B12OAmy9L8rQXs1qbvLV7R4",
      {
        commitment: "processed",
      }
    );

    walletKeyPair = new web3.Keypair();
    const tx = await transferSolana(connection, masterWallet, walletKeyPair.publicKey, 0.3);
    sleep(1000);

    swapProgram = await loadPoolProgram(
      walletKeyPair,
      "devnet",
    );

    MOVE_TOKEN = await spl_token.createMint(
      connection,
      walletKeyPair,
      walletKeyPair.publicKey,
      null,
      9,
    );

    tokenAccount = await spl_token.createAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      walletKeyPair.publicKey,
    );


    const mintTokenTx = await spl_token.mintTo(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      tokenAccount,
      walletKeyPair.publicKey,
      10 * DECIMAL,
    );

    liquidityPoolKeypair = new anchor.web3.Keypair();
    pool = liquidityPoolKeypair.publicKey;

    const [poolAccountSigner, nonce] = anchor.web3.PublicKey.findProgramAddressSync(
      [liquidityPoolKeypair.publicKey.toBuffer()],
      swapProgram.programId
    );

    const moveTokenAccount = await spl_token.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      poolAccountSigner,
      true
    );

    const [solAccount, solAccountNonce] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("sol-account"), liquidityPoolKeypair.publicKey.toBuffer()],
      swapProgram.programId
    );

    const tx_creation = await swapProgram.rpc.createLiquidityPool(nonce, solAccountNonce, {
      accounts: {
        liquidityPool: liquidityPoolKeypair.publicKey,
        authority: walletKeyPair.publicKey,
        solAccount: solAccount,
        moveMint: MOVE_TOKEN,
        moveTokenAccount: moveTokenAccount.address,
        systemProgram: web3.SystemProgram.programId,
      },
      signers: [liquidityPoolKeypair],
      instructions: [
        await swapProgram.account.liquidityPool.createInstruction(liquidityPoolKeypair, 1000),
      ]
    });
  });

  console.log("Start testing...");
  it("Is initialized!", async () => {
    const liquidityPoolAccount = await swapProgram.account.liquidityPool.fetch(liquidityPoolKeypair.publicKey);
    expect(liquidityPoolAccount.paused).to.be.false;
  });

  it("Can add liquidity with SOL", async () => {

    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
    const sol_before = liquidityPoolAccount.solReserve.toNumber();
    const amount = new anchor.BN(0.1 * web3.LAMPORTS_PER_SOL);
    const tx = await swapProgram.methods.depositSol(amount).accounts({
      authority: walletKeyPair.publicKey,
      liquidityPool: liquidityPoolPubkey,
      solAccount: liquidityPoolAccount.solAccount,
      systemProgram: web3.SystemProgram.programId,
    }).signers([walletKeyPair]).rpc();

    const liquidityPoolAccountAfter = await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey);
    const sol_after = liquidityPoolAccountAfter.solReserve.toNumber();
    expect(sol_after).to.eql(sol_before + amount.toNumber());
  });

  it("Can add liquidity with MOVE", async () => {
    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
    const move_before = liquidityPoolAccount.moveTokenReserve.toNumber();
    const [poolAccountSigner, nonce] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity-pool"), liquidityPoolPubkey.toBuffer()],
      swapProgram.programId
    );

    const fromMoveTokenAccount = await spl_token.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      walletKeyPair.publicKey,
      false
    )
    const amount = new anchor.BN(1 * DECIMAL);
    const tx = await swapProgram.methods.depositMove(amount).accounts({
      liquidityPool: liquidityPoolPubkey,
      authority: walletKeyPair.publicKey,
      moveTokenAccount: liquidityPoolAccount.moveTokenAccount,
      fromMove: fromMoveTokenAccount.address,
      poolSigner: poolAccountSigner,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([walletKeyPair]).rpc();

    const liquidityPoolAccountAfter = await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey);
    const move_after = liquidityPoolAccountAfter.moveTokenReserve.toNumber();
    expect(move_after).to.eql(move_before + amount.toNumber());

  });

  it("Can swap MOVE to SOL", async () => {
    const fromMoveTokenAccount = await spl_token.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      walletKeyPair.publicKey,
      false
    )
    const userSolBefore = await connection.getBalance(walletKeyPair.publicKey);
    const userMoveBefore = await spl_token.getAccount(connection, fromMoveTokenAccount.address);


    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
    const sol_before = liquidityPoolAccount.solReserve.toNumber();
    const move_before = liquidityPoolAccount.moveTokenReserve.toNumber();
    const amount = new anchor.BN(1 * DECIMAL);
    const tx = await swapProgram.methods.swapMoveToSol(amount).accounts({
      liquidityPool: liquidityPoolPubkey,
      authority: walletKeyPair.publicKey,
      solAccount: liquidityPoolAccount.solAccount,
      moveTokenAccount: liquidityPoolAccount.moveTokenAccount,
      fromMoveTokenAccount: fromMoveTokenAccount.address,
      destination: walletKeyPair.publicKey,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([walletKeyPair]).rpc();

    const liquidityPoolAccountAfter = await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey);
    const sol_after = liquidityPoolAccountAfter.solReserve.toNumber();
    const move_after = liquidityPoolAccountAfter.moveTokenReserve.toNumber();

    const userSolAfter = await connection.getBalance(walletKeyPair.publicKey);
    const userMoveAfter = await spl_token.getAccount(connection, fromMoveTokenAccount.address);

    expect(sol_after).to.eql(sol_before - amount.toNumber() / 10);
    expect(move_after).to.eql(move_before + amount.toNumber());
    expect(userSolAfter).to.eql(userSolBefore + amount.toNumber() / 10 - (0.000005 * web3.LAMPORTS_PER_SOL)); //add gas fee 0.000005 SOL
    expect(Number(userMoveAfter.amount)).to.eql(Number(userMoveBefore.amount) - amount.toNumber());
  });

  it("Can swap SOL to MOVE", async () => {
    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));

    const [poolAccountSigner, nonce] = anchor.web3.PublicKey.findProgramAddressSync(
      [liquidityPoolPubkey.toBuffer()],
      swapProgram.programId
    );
    const destinationMoveTokenAccount = await spl_token.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      walletKeyPair.publicKey,
      false
    )
    const userSolBefore = await connection.getBalance(walletKeyPair.publicKey);
    const userMoveBefore = await spl_token.getAccount(connection, destinationMoveTokenAccount.address);


    const sol_before = liquidityPoolAccount.solReserve.toNumber();
    const move_before = liquidityPoolAccount.moveTokenReserve.toNumber();


    const amount = new anchor.BN(0.1 * web3.LAMPORTS_PER_SOL);
    const tx = await swapProgram.methods.swapSolToMove(amount).accounts({
      liquidityPool: liquidityPoolPubkey,
      authority: walletKeyPair.publicKey,
      solAccount: liquidityPoolAccount.solAccount,
      moveTokenAccount: liquidityPoolAccount.moveTokenAccount,
      destination: destinationMoveTokenAccount.address,
      poolSigner: poolAccountSigner,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    }).signers([walletKeyPair]).rpc();

    const liquidityPoolAccountAfter = await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey);
    const sol_after = liquidityPoolAccountAfter.solReserve.toNumber();
    const move_after = liquidityPoolAccountAfter.moveTokenReserve.toNumber();

    const userSolAfter = await connection.getBalance(walletKeyPair.publicKey);
    const userMoveAfter = await spl_token.getAccount(connection, destinationMoveTokenAccount.address);
    expect(sol_after).to.eql(sol_before + amount.toNumber());
    expect(move_after).to.eql(move_before - amount.toNumber() * 10);
    expect(userSolAfter).to.eql(userSolBefore - amount.toNumber() - (0.000005 * web3.LAMPORTS_PER_SOL)); //add gas fee 0.000005 SOL
    expect(Number(userMoveAfter.amount)).to.eql(Number(userMoveBefore.amount) + amount.toNumber() * 10);


  });
});
