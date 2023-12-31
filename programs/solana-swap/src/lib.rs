use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::Mint;
use anchor_spl::token::Token;
use anchor_spl::token::TokenAccount;

declare_id!("G8wxZbx3xzSzsLBHaEuNcCeN14nVoBLiHoW3QVEL8dP5");

#[program]
pub mod solana_swap {
    use super::*;

    pub fn create_liquidity_pool(
        ctx: Context<CreateLiquidityPool>,
        pool_nonce: u8,
        sol_account_nonce: u8,
    ) -> Result<()> {
        msg!("Create liquidity pool");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        liquidity_pool.move_token = ctx.accounts.move_mint.key();
        liquidity_pool.sol_reserve = 0;
        liquidity_pool.move_token_reserve = 0;
        liquidity_pool.pool_authority = *ctx.accounts.authority.key;
        liquidity_pool.sol_account = *ctx.accounts.sol_account.key;
        liquidity_pool.move_token_account = *ctx.accounts.move_token_account.key;
        liquidity_pool.bump = pool_nonce;
        liquidity_pool.sol_account_bump = sol_account_nonce;
        liquidity_pool.paused = false;

        Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        msg!("Deposit sol");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.sol_account.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;
        liquidity_pool.sol_reserve += amount;

        Ok(())
    }

    pub fn deposit_move(ctx: Context<DepositMoveToken>, amount: u64) -> Result<()> {
        msg!("Deposit move");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.from_move.to_account_info(),
                to: ctx.accounts.move_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );

        anchor_spl::token::transfer(cpi_ctx, amount)?;

        liquidity_pool.move_token_reserve += amount;
        Ok(())
    }

    pub fn swap_move_to_sol(ctx: Context<SwapMoveToSol>, amount: u64) -> Result<()> {
        msg!("Swap move to sol");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        if liquidity_pool.sol_reserve < (amount / 10) {
            return Err(ErrorCode::InsufficientReserve.into());
        }

        //transfer move to pool
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.from_move_token_account.to_account_info(),
                to: ctx.accounts.move_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        anchor_spl::token::transfer(cpi_ctx, amount)?;

        let amount_of_sol = amount.checked_div(10).unwrap();

        // transfer sol to destination
        **ctx
            .accounts
            .sol_account
            .to_account_info()
            .lamports
            .borrow_mut() -= amount_of_sol;
        **ctx.accounts.destination.lamports.borrow_mut() += amount_of_sol;

        liquidity_pool.sol_reserve -= amount_of_sol;
        liquidity_pool.move_token_reserve += amount;
        Ok(())
    }

    pub fn swap_sol_to_move(ctx: Context<SwapSolToMove>, amount: u64) -> Result<()> {
        msg!("Swap sol to move");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        if liquidity_pool.move_token_reserve < (amount * 10) {
            return Err(ErrorCode::InsufficientReserve.into());
        }

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.sol_account.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        let amount_of_move: u64 = amount.checked_mul(10).unwrap();
        // let amount_of_sol = amount.checked_div(10).unwrap();

        let seeds = &[
            liquidity_pool.to_account_info().key.as_ref(),
            &[liquidity_pool.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.move_token_account.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.pool_signer.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::transfer(cpi_ctx, amount_of_move)?;

        liquidity_pool.move_token_reserve -= amount_of_move;
        liquidity_pool.sol_reserve += amount;
        Ok(())
    }

    pub fn pause_liquidity_pool(ctx: Context<PauseLiquidityPool>) -> Result<()> {
        msg!("Pause liquidity pool");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        liquidity_pool.paused = true;
        Ok(())
    }

    pub fn unpause_liquidity_pool(ctx: Context<UnpauseLiquidityPool>) -> Result<()> {
        msg!("Unpause liquidity pool");
        let liquidity_pool = &mut ctx.accounts.liquidity_pool;
        liquidity_pool.paused = false;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(pool_nonce: u8)]
pub struct CreateLiquidityPool<'info> {
    #[account(zero, signer)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub move_mint: Account<'info, Mint>,
    ///CHECK: This is no dangerous
    #[account(init,
        payer = authority,
        space = 32,
        seeds = [b"sol-account".as_ref(), &liquidity_pool.key().to_bytes()],
        bump,
    )]
    pub sol_account: AccountInfo<'info>,
    ///CHECK: This is no dangerous
    pub move_token_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut,
    constraint = !liquidity_pool.paused)]
    liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    authority: Signer<'info>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    sol_account: AccountInfo<'info>,
    system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct DepositMoveToken<'info> {
    #[account(mut,
    constraint = !liquidity_pool.paused)]
    liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    authority: Signer<'info>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    move_token_account: Account<'info, TokenAccount>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    from_move: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pool_signer: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SwapMoveToSol<'info> {
    #[account(mut,
    constraint = !liquidity_pool.paused)]
    liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    authority: Signer<'info>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    sol_account: AccountInfo<'info>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    move_token_account: Account<'info, TokenAccount>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    from_move_token_account: Account<'info, TokenAccount>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    destination: AccountInfo<'info>,
    ///CHECK: This is no dangerous
    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SwapSolToMove<'info> {
    #[account(mut,
    constraint = !liquidity_pool.paused)]
    liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    authority: Signer<'info>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    sol_account: AccountInfo<'info>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    move_token_account: Account<'info, TokenAccount>,
    ///CHECK: This is no dangerous
    #[account(mut)]
    destination: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pool_signer: UncheckedAccount<'info>,
    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PauseLiquidityPool<'info> {
    #[account(mut)]
    liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, constraint = liquidity_pool.pool_authority == *authority.key)]
    authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UnpauseLiquidityPool<'info> {
    #[account(mut)]
    liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, constraint = liquidity_pool.pool_authority == *authority.key)]
    authority: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct LiquidityPool {
    pub sol: Pubkey,
    pub move_token: Pubkey,
    pub sol_reserve: u64,
    pub sol_account: Pubkey,
    pub move_token_account: Pubkey,
    pub move_token_reserve: u64,
    pub pool_authority: Pubkey,
    pub bump: u8,
    pub sol_account_bump: u8,
    pub paused: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient reserve")]
    InsufficientReserve,
}
