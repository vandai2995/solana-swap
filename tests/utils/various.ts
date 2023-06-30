import * as anchor from '@project-serum/anchor';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

export const SWAP_PROGRAM_ID = new anchor.web3.PublicKey("G8wxZbx3xzSzsLBHaEuNcCeN14nVoBLiHoW3QVEL8dP5");
export const MOVE_TOKEN = new anchor.web3.PublicKey("sy4LXfLXTmMQUCUVjaNf59Kc274NWKXZPjCzMPhM1je");
export const DECIMAL = 1000000000;
export function loadWalletKey(keypair: any): anchor.web3.Keypair {
    if (!keypair || keypair == '') {
        throw new Error('Keypair is required!');
    }
    const loaded = anchor.web3.Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
    );
    return loaded;
}

export async function loadPoolProgram(
    walletKeyPair: anchor.web3.Keypair,
    env: string,
    customRpcUrl?: string,
) {
    if (customRpcUrl) console.log('USING CUSTOM URL', customRpcUrl);

    // @ts-ignore
    const solConnection = new anchor.web3.Connection(
        //@ts-ignore
        customRpcUrl || anchor.web3.clusterApiUrl(env),
        "processed"
    );

    const walletWrapper = new anchor.Wallet(walletKeyPair);
    const provider = new anchor.AnchorProvider(solConnection, walletWrapper, {
        preflightCommitment: 'processed',
        commitment: 'processed'
    });


    const idl = JSON.parse(
        require('fs').readFileSync(
            './target/idl/solana_swap.json',
            'utf8',
        ),
    );

    const program = new anchor.Program(idl, SWAP_PROGRAM_ID, provider);
    console.log('program id from anchor', program.programId.toBase58());

    return program;
}

export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transferSolana(connection: anchor.web3.Connection, from: anchor.web3.Keypair, sto: anchor.web3.PublicKey, amount: number) {
    const transaction = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: sto,
            lamports: amount * LAMPORTS_PER_SOL,
        }),
    );
    const signature = await anchor.web3.sendAndConfirmTransaction(
        //@ts-ignore
        connection,
        transaction,
        [from],
        {
            commitment: 'processed',
        },
    );
    return signature;
}