export const CONFIG = {
  aavePoolAddress: (import.meta.env.VITE_AAVE_POOL_ADDRESS_BASE_SEPOLIA as string | undefined)?.toLowerCase() as `0x${string}` | undefined,
  vaultAddress: (import.meta.env.VITE_VAULT_ADDRESS as string | undefined)?.toLowerCase() as `0x${string}` | undefined,
  loanManagerAddress: (import.meta.env.VITE_LOAN_MANAGER_ADDRESS as string | undefined)?.toLowerCase() as `0x${string}` | undefined
}
