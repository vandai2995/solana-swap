import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaSwap } from "../target/types/solana_swap";
import log from "loglevel";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as spl_token from '@solana/spl-token';

import { program as programCommander } from "commander";
import { DECIMAL, MOVE_TOKEN, loadPoolProgram, loadWalletKey } from "./utils/various";
import * as web3 from '@solana/web3.js';
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
const connection = new anchor.web3.Connection(
  anchor.web3.clusterApiUrl("devnet"),
  {
    commitment: "processed",
  }
);


programCommand("init")
  .action(async (directory, cmd) => {
    const { keypair } = cmd.opts();
    const walletKeyPair = loadWalletKey(keypair);
    const swapProgram = await loadPoolProgram(walletKeyPair, "devnet");
    const tx = await swapProgram.methods.initialize().rpc();
    console.log(tx);
  });


programCommand("init_liquidity_pool")
  .action(async (directory, cmd) => {
    const { keypair } = cmd.opts();
    const walletKeyPair = loadWalletKey(keypair);
    const swapProgram = await loadPoolProgram(walletKeyPair, "devnet");
    const liquidityPoolKeypair = new anchor.web3.Keypair();
    console.log("liquidity pool:", liquidityPoolKeypair.publicKey.toBase58());
    const [poolAccountSigner, nonce] = anchor.web3.PublicKey.findProgramAddressSync(
      [liquidityPoolKeypair.publicKey.toBuffer()],
      swapProgram.programId
    );
    console.log("poolAccountSigner", poolAccountSigner.toBase58());

    const moveTokenAccount = await spl_token.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      poolAccountSigner,
      true
    )

    // create new account for sol using liquidity
    const [solAccount, solAccountNonce] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("sol-account"), liquidityPoolKeypair.publicKey.toBuffer()],
      swapProgram.programId
    )



    const tx = await swapProgram.rpc.createLiquidityPool(nonce, solAccountNonce, {
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
    console.log(tx);

    const liquidityPoolAccount = await swapProgram.account.liquidityPool.fetch(liquidityPoolKeypair.publicKey);
    console.log(liquidityPoolAccount);

  });

programCommand("deposit_sol")
  .option("-p, --pool <string>", "Pool address")
  .action(async (directory, cmd) => {
    const { keypair, pool } = cmd.opts();
    const walletKeyPair = loadWalletKey(keypair);
    const swapProgram = await loadPoolProgram(walletKeyPair, "devnet");

    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
    console.log(walletKeyPair.publicKey.toBase58());
    const amount = new anchor.BN(0.5 * web3.LAMPORTS_PER_SOL);
    const tx = await swapProgram.methods.depositSol(amount).accounts({
      authority: walletKeyPair.publicKey,
      liquidityPool: liquidityPoolPubkey,
      solAccount: liquidityPoolAccount.solAccount,
      systemProgram: web3.SystemProgram.programId,
    }).signers([walletKeyPair]).rpc();
    console.log(tx);

  });

programCommand("deposit_move")
  .option("-p, --pool <string>", "Pool address")
  .action(async (directory, cmd) => {
    const { keypair, pool } = cmd.opts();
    const walletKeyPair = loadWalletKey(keypair);
    const swapProgram = await loadPoolProgram(walletKeyPair, "devnet");

    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
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
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
    console.log("before: ", liquidityPoolAccount.moveTokenReserve.toNumber());
    const amount = new anchor.BN(1000 * DECIMAL);
    const tx = await swapProgram.methods.depositMove(amount).accounts({
      liquidityPool: liquidityPoolPubkey,
      authority: walletKeyPair.publicKey,
      moveTokenAccount: liquidityPoolAccount.moveTokenAccount,
      fromMove: fromMoveTokenAccount.address,
      poolSigner: poolAccountSigner,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([walletKeyPair]).rpc();
    console.log(tx);

    const liquidityPoolAccountAfter = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
    console.log("after: ", liquidityPoolAccountAfter.moveTokenReserve.toNumber() / DECIMAL);


  });

programCommand("swap_move_to_sol")
  .option("-p, --pool <string>", "Pool address")
  .action(async (directory, cmd) => {
    const { keypair, pool } = cmd.opts();
    const walletKeyPair = loadWalletKey(keypair);
    const swapProgram = await loadPoolProgram(walletKeyPair, "devnet");

    const fromMoveTokenAccount = await spl_token.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeyPair,
      MOVE_TOKEN,
      walletKeyPair.publicKey,
      false
    )

    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);
    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
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
    console.log(tx);

  });

programCommand("swap_sol_to_move")
  .option("-p, --pool <string>", "Pool address")
  .action(async (directory, cmd) => {
    const { keypair, pool } = cmd.opts();
    const walletKeyPair = loadWalletKey(keypair);
    const swapProgram = await loadPoolProgram(walletKeyPair, "devnet");
    const liquidityPoolPubkey = new anchor.web3.PublicKey(pool);


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

    const liquidityPoolAccount = Object(await swapProgram.account.liquidityPool.fetch(liquidityPoolPubkey));
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
    console.log(tx);

  });


function programCommand(name: string) {
  return programCommander
    .command(name)
    .option(
      "-e, --env <string>",
      "Solana cluster env name",
      "devnet" //mainnet-beta, testnet, devnet
    )
    .option(
      "-k, --keypair <path>",
      `Solana wallet location`,
      "--keypair not provided"
    )
    .option("-l, --log-level <string>", "log level", setLogLevel)
    .option("-c, --cache-name <string>", "Cache file name", "temp");
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value: any, prev: any) {
  if (value === undefined || value === null) {
    return;
  }
  log.info("setting the log value to: " + value);
  log.setLevel(value);
}

function errorColor(str: any) {
  // Add ANSI escape codes to display text in red.
  return `\x1b[31m${str}\x1b[0m`;
}
programCommander
  .configureOutput({
    // Visibly override write routines as example!
    writeOut: (str) => process.stdout.write(`[OUT] ${str}`),
    writeErr: (str) => process.stdout.write(`[ERR] ${str}`),
    // Highlight errors in color.
    outputError: (str, write) => write(errorColor(str)),
  })
  .parse(process.argv);
