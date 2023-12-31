<h1 align="center">
  <br>
    Swap Demo
  <br>
</h1>

## Introduction

This project is a Swap Demo that allows you to perform token swaps between SOL and MOVE tokens. The demo is built with the aim of showcasing how token swapping works in a decentralized finance (DeFi) scenario. The Swap Demo is written in Rust, and it uses Anchor Framework/Solana for development.

## How to Check the Demo

You can check the demo in three different ways:

### UI demo

Throughout the demonstrations: Visit the following link to see the demonstrations: https://demo-swap-pi.vercel.app/

### Using the CLI:

Clone the GitHub repository to your local machine and use the command line interface (CLI) to interact with the project.

- Clone the .env.example file:
  Clone the .env.example file from the repository, change to .env and supply your secret key.

- Airdrop SOL and MOVE Tokens:
  Before running the script or performing any actions, it is recommended to airdrop some SOL and MOVE tokens to your wallet. You can do this by visiting https://demo-swap-pi.vercel.app/ and following the instructions provided on the website.

- Running the Scripts
  To perform various actions, you can use the following scripts:

This script creates the swap pool. You can skip the -a flag if you want to use the default values.


```
npm run init_liquidity_pool
```

This script allows you to deposit SOL tokens to the pool.

```
npm run deposit_sol -- -a <amount>
```

This script allows you to deposit MOVE tokens to the pool.

```
npm run deposit_move -- -a <amount>
```

This script performs a swap from MOVE tokens to SOL tokens.

```
npm run swap_move_to_sol -- -a <amount>
```

This script performs a swap from SOL tokens to MOVE tokens.

```
npm run swap_sol_to_move -- -a <amount>
```

This script allows owner to pause the pool.

```
npm run pause
```

This script allows owner to unpause the pool.

```
npm run unpause
```

### Running Unit Tests

Unit tests for the project have been written using the Anchor framework. To run the unit tests, follow these steps:

- Clone the GitHub repository to your local machine.
- Open the command line interface (CLI) and navigate to the project directory.
- Run the command to execute the unit tests.

```
npm run test
```

By running the unit tests, you can ensure the correctness and functionality of the project.
