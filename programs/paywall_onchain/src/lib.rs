use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, transfer};

use {
    anchor_lang::prelude::*,
    solana_program::{pubkey, pubkey::Pubkey},
};

declare_id!("DTsXoYPip9jQTBRvrVXeCWXe3FXbZanBQxgfCm38PE7a");

pub const STAKE_POOL_STATE_SEED: &str = "state";
pub const STAKE_POOL_SIZE: usize = 8 + 32 + 32 + 1 + 8 + 32 + 8 + 1 + 1 + 32 + 16 + 8;
pub const VAULT_SEED: &str = "vault";
pub const VAULT_AUTH_SEED: &str = "vault_authority";
pub const PRICE_STATE_SEED: &str = "price_state";

pub static PROGRAM_AUTHORITY: Pubkey = pubkey!("6tmzmp3ZxW9kk4T3chvxi3CNLvkGU7Gqpkaz3CV6NUJ");

pub const MULT: u128 = 10_000_000_000;
pub const RATE_MULT: u128 = 100_000_000_000;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum PaywallErrorCode {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,

    #[msg("Invalid program authority")]
    InvalidProgramAuthority,

    #[msg("Invalid price authority")]
    InvalidPriceAuthority,

    #[msg("Amount does not match price.")]
    IncorrectAmount,

    #[msg("Not implemented, yet.")]
    NotImplemented,

    #[msg("Token mint is invalid")]
    InvalidMint,

    #[msg("Invalid user provided")]
    InvalidUser,
}

#[program]
pub mod paywall_onchain {
    use super::*;

    pub fn initialize(ctx: Context<InitializePrice>) -> Result<()> {
        let state = &mut ctx.accounts.price_state;
        state.bump = ctx.bumps.get("price_state").unwrap().clone();
        state.authority = ctx.accounts.authority.key.clone();
        state.price = 1000000;

        Ok(())
    }

    pub fn init_pools(ctx: Context<InitializePool>) -> Result<()> {
        let pool_state = &mut ctx.accounts.pool_state;
        pool_state.authority = ctx.accounts.program_authority.key();
        pool_state.bump = *ctx.bumps.get("pool_state").unwrap();
        pool_state.amount = 0;
        pool_state.token_vault = ctx.accounts.token_vault.key();
        pool_state.token_mint = ctx.accounts.token_mint.key();
        pool_state.initialized_at = Clock::get().unwrap().unix_timestamp;
        pool_state.vault_bump = *ctx.bumps.get("token_vault").unwrap();
        pool_state.vault_auth_bump = *ctx.bumps.get("vault_authority").unwrap();
        pool_state.vault_authority = ctx.accounts.vault_authority.key();
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
        msg!("Prev price: {}, new price: {}", ctx.accounts.price_account.price, new_price);
        ctx.accounts.price_account.price = new_price;
        Ok(())
    }

    pub fn pay(ctx: Context<Payment>, pay_amount: u64) -> Result<()> {
        // transfer amount from user token acct to vault
        transfer(ctx.accounts.transfer_ctx(), pay_amount)?;

        msg!("Pool initial total: {}", ctx.accounts.pool.amount);
        let price_state = &ctx.accounts.price_state;

        require!(pay_amount == price_state.price, PaywallErrorCode::IncorrectAmount);

        // update pool state amount
        let pool = &mut ctx.accounts.pool;
        pool.amount = pool.amount.checked_add(pay_amount).unwrap();
        msg!("Current pool total: {}", pool.amount);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePrice<'info> {
    #[account(
        init,
        seeds = [PRICE_STATE_SEED.as_bytes()],
        payer = authority,
        space = 8 + std::mem::size_of::<PriceState>(),
        bump,
    )]
    pub price_state: Account<'info, PriceState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct PoolState {
    pub authority: Pubkey,
    pub bump: u8,
    pub amount: u64,
    pub token_vault: Pubkey,
    pub token_mint: Pubkey,
    pub initialized_at: i64,
    pub vault_bump: u8,
    pub vault_auth_bump: u8,
    pub vault_authority: Pubkey,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump,
        payer = program_authority,
        space = STAKE_POOL_SIZE
    )]
    pub pool_state: Account<'info, PoolState>,
    #[account(
        init,
        token::mint = token_mint,
        token::authority = vault_authority,
        seeds = [token_mint.key().as_ref(), vault_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump,
        payer = program_authority
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = program_authority.key() == PROGRAM_AUTHORITY @ PaywallErrorCode::InvalidProgramAuthority
    )]
    pub program_authority: Signer<'info>,
    /// CHECK: This is not dangerous because we're only using this as a program signer
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        mut,
        seeds = [PRICE_STATE_SEED.as_bytes()],
        bump = price_account.bump,
    )]
    pub price_account: Account<'info, PriceState>,

    #[account(
        mut,
        constraint = program_authority.key() == price_account.authority @ PaywallErrorCode::InvalidProgramAuthority
    )]
    pub program_authority: Signer<'info>,
}

#[account]
pub struct PriceState {
    pub authority: Pubkey,
    pub bump: u8,
    pub price: u64,
}

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        mut,
        seeds = [pool.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, PoolState>,
    #[account(
        mut,
        seeds = [pool.token_mint.key().as_ref(), pool.vault_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool.vault_bump
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == pool.token_mint @ PaywallErrorCode::InvalidMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        //constraint = price_state.authority == pool.authority @ PaywallErrorCode::InvalidPriceAuthority,
        seeds = [PRICE_STATE_SEED.as_bytes()],
        bump = price_state.bump,
    )]
    pub price_state: Account<'info, PriceState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}

impl<'info> Payment<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user_token_account.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.user.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
