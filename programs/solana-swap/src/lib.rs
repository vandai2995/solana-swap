use anchor_lang::prelude::*;

declare_id!("G8wxZbx3xzSzsLBHaEuNcCeN14nVoBLiHoW3QVEL8dP5");

#[program]
pub mod solana_swap {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
