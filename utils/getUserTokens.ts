// utils/getUserTokens.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface TokenAccount {
  mint: string;
  amount: number;
  decimals: number;
}

async function getUserTokens(walletAddress: string) {
  try {
    // Use the mainnet RPC endpoint
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );

    // Get all token accounts for the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    // Filter and format token accounts
    const tokens = tokenAccounts.value
      .map((tokenAccount) => {
        const accountData = tokenAccount.account.data.parsed.info;
        const amount = accountData.tokenAmount.uiAmount;
        
        // Filter out accounts with zero balance
        if (amount === 0) return null;

        return {
          mint: accountData.mint,
          amount: amount,
          decimals: accountData.tokenAmount.decimals,
        };
      })
      .filter((token): token is TokenAccount => token !== null);

    return tokens;
  } catch (error) {
    console.error("Error fetching user tokens:", error);
    throw error;
  }
}

export default getUserTokens;