export const CONFIG = {
  aavePoolAddress: (import.meta.env.VITE_AAVE_POOL_ADDRESS_BASE_SEPOLIA as string | undefined)?.toLowerCase() as `0x${string}` | undefined,
  vaultAddress: (import.meta.env.VITE_VAULT_ADDRESS as string | undefined)?.toLowerCase() as `0x${string}` | undefined,
  loanManagerAddress: (import.meta.env.VITE_LOAN_MANAGER_ADDRESS as string | undefined)?.toLowerCase() as `0x${string}` | undefined,
  // USD価格は 1e8 スケール（例: $3000 => 3000 * 1e8）
  ethUsdPrice1e8: Number(import.meta.env.VITE_ETH_USD_1E8 ?? (3000 * 1e8))
}
