// utils/getTokenPrices.ts
import axios from "axios";
import type { TokenAccount } from "./getUserTokens";

interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  logoURI: string;
  price: number;
}

async function getTokenPrices(tokens: TokenAccount[]) {
  try {
    // Fetch token list from Jupiter API
    const response = await axios.get("https://token.jup.ag/all");
    const tokenList = response.data;
    
    // Create a map of token info by mint address
    const tokenInfoMap = new Map<string, TokenInfo>();
    tokenList.forEach((token: any) => {
      tokenInfoMap.set(token.address, {
        mint: token.address,
        name: token.name,
        symbol: token.symbol,
        logoURI: token.logoURI,
        price: token.price || 0,
      });
    });

    // Combine token balances with prices and info
    return tokens.map((token) => {
      const tokenInfo = tokenInfoMap.get(token.mint);
      if (!tokenInfo) {
        return {
          mint: token.mint,
          name: "Unknown Token",
          symbol: "???",
          logoURI: "/default-token.png",
          amount: token.amount,
          priceInUSD: 0,
          totalValueInUSD: 0,
        };
      }

      return {
        mint: token.mint,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        logoURI: tokenInfo.logoURI,
        amount: token.amount,
        priceInUSD: tokenInfo.price,
        totalValueInUSD: token.amount * tokenInfo.price,
      };
    });
  } catch (error) {
    console.error("Error fetching token prices:", error);
    throw error;
  }
}

export default getTokenPrices;