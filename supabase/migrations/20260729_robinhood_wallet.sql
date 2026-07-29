-- Robinhood Crypto wallet support (API credentials + balances)

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS credentials jsonb;

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_chain_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_chain_check
  CHECK (chain IN ('solana', 'hyperliquid', 'evm', 'robinhood'));
