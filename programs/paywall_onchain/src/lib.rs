use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;


declare_id!("DTsXoYPip9jQTBRvrVXeCWXe3FXbZanBQxgfCm38PE7a");

#[program]
pub mod paywall_onchain {
    use super::*;

    pub fn update_price(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
        ctx.accounts.price_account.price = new_price;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut)]
    pub price_account: Account<'info, PriceAccount>,
}

#[account]
pub struct PriceAccount {
    price: u64,
}
