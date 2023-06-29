import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaSwap } from "../target/types/solana_swap";
import log from "loglevel";
import dotenv from "dotenv";
import { program as programCommander } from "commander";
import { loadPoolProgram, loadWalletKey } from "./utils/various";

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


// const provider = new anchor.AnchorProvider(
//   connection,
//   anchor.Wallet.local(),
//   {
//     preflightCommitment: "processed",
//     commitment: "processed",
//   }
// );

// const idl = JSON.parse(
//   require("fs").readFileSync("./target/idl/solana_swap.json", "utf8")
// );
// const PROGRAM_ID = new anchor.web3.PublicKey("Gm1YoWnMwTB2N6AypNyyyNL2RfF4NJ7JUZ3eQQwcJsrB");


// const program = new anchor.Program(
//   idl,
//   PROGRAM_ID,
//   provider
// );

// console.log("Program ID: ", program)


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
