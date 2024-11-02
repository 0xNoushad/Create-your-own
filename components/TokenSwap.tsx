"use client";
import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import getUserTokens from "@/utils/getUserTokens";
import getTokenPrices from "@/utils/getTokenPrices";
import filterLowValueTokens from "@/utils/filterLowValuesTokens";
import {
  Connection,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import axios, { AxiosError } from "axios";

interface Token {
  mint: string;
  name: string;
  logoURI: string;
  amount: number;
  priceInUSD: number;
  totalValueInUSD: number;
}


const getRpcUrl = () => {
  const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (!envRpcUrl) {
 
    return clusterApiUrl('devnet');
    // For mainnet, you could use:
    // return "https://api.mainnet-beta.solana.com";
  }
  
  // Ensure URL has protocol
  if (!envRpcUrl.startsWith("http://") && !envRpcUrl.startsWith("https://")) {
    return `https://${envRpcUrl}`;
  }
  
  return envRpcUrl;
};
 
let connection: Connection;
try {
  connection = new Connection(getRpcUrl(), "confirmed");
} catch (error) {
  console.error("Failed to create Solana connection:", error);
 
  connection = new Connection(clusterApiUrl('devnet'), "confirmed");
}
 
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6";

const TokenSwapComponent = () => {
  const { publicKey, connected, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lowValueTokens, setLowValueTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<{ [key: string]: boolean }>({});
  const [showTokens, setShowTokens] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const handleCheckTokens = async () => {
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      return;
    }
  
    setLoading(true);
    setError("");
    try {
      
      const tokens = await getUserTokens(publicKey.toString());
      console.log("Fetched tokens:", tokens);
   
      const tokensWithPrices = await getTokenPrices(tokens);
      console.log("Tokens with prices:", tokensWithPrices);
  
     
      const filteredTokens = filterLowValueTokens(tokensWithPrices);
      console.log("Filtered low value tokens:", filteredTokens);
  
      setLowValueTokens(filteredTokens);
  
       
      const initialSelection = filteredTokens.reduce((acc: { [key: string]: boolean }, token) => {
        acc[token.mint] = true;
        return acc;
      }, {});
      setSelectedTokens(initialSelection);
      setShowTokens(true);
  
      if (filteredTokens.length === 0) {
        setError("No low value tokens found in your wallet");
      }
    } catch (error) {
      console.error("Error checking tokens:", error);
      setError("Failed to fetch tokens. Please ensure your wallet is properly connected and try again.");
    } finally {
      setLoading(false);
    }
  };

  const getQuote = async (inputMint: string, amount: number) => {
    try {
      const response = await axios.get(`${JUPITER_QUOTE_API}/quote`, {
        params: {
          inputMint,
          outputMint: "So11111111111111111111111111111111111111112",  
          amount: Math.floor(amount * 10 ** 9),  
          slippageBps: 50,
          onlyDirectRoutes: false,
          asLegacyTransaction: false,
          maxAccounts: 64,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Quote fetch failed: ${error.response?.data?.message || error.message}`);
      }
      throw new Error("Failed to fetch quote");
    }
  };

  const getSwapTransaction = async (quoteResponse: any) => {
    if (!publicKey) throw new Error("Wallet not connected");

    try {
      const response = await axios.post(
        `${JUPITER_QUOTE_API}/swap`,
        {
          quoteResponse,
          userPublicKey: publicKey.toString(),
          wrapAndUnwrapSol: true,
          computeUnitPriceMicroLamports: 1000, // Added for better transaction success rate
          prioritizationFeeLamports: 1000, // Added for better transaction success rate
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Swap transaction failed: ${error.response?.data?.message || error.message}`);
      }
      throw new Error("Failed to get swap transaction");
    }
  };

  const executeSwapTransaction = async (swapTransaction: string) => {
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");

    try {
      const transactionBuf = Buffer.from(swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction);

      // Get latest blockhash
      const latestBlockhash = await connection.getLatestBlockhash();

      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      return signature;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Transaction execution failed: ${error.message}`);
      }
      throw new Error("Failed to execute transaction");
    }
  };

  const handleSwapTokens = async () => {
    if (!publicKey) return;

    const tokensToSwap = lowValueTokens.filter((token) => selectedTokens[token.mint]);
    setSwapStatus("Starting swaps...");
    setError("");

    for (const token of tokensToSwap) {
      try {
        setSwapStatus(`Processing ${token.name}...`);
        
        // Get quote
        const quoteResponse = await getQuote(token.mint, token.amount);
        if (!quoteResponse) {
          throw new Error("Invalid quote response");
        }

        // Get swap transaction
        const { swapTransaction } = await getSwapTransaction(quoteResponse);
        if (!swapTransaction) {
          throw new Error("Failed to get swap transaction");
        }

        // Execute swap
        const signature = await executeSwapTransaction(swapTransaction);
        
        setSwapStatus(`Successfully swapped ${token.name}! TX: ${signature}`);
        console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
      } catch (error) {
        console.error(`Failed to swap ${token.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setError(`Failed to swap ${token.name}: ${errorMessage}`);
        setSwapStatus("Swap failed. Check error message above.");
        break; // Stop processing remaining tokens if one fails
      }
    }

    if (!error) {
      setSwapStatus("All swaps completed successfully!");
    }
  };

  function handleTokenSelection(mint: string): void {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Token Swap</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!connected ? (
        <p className="text-red-500">Please connect your wallet to use this feature.</p>
      ) : (
        <>
          <button
            onClick={handleCheckTokens}
            className="bg-blue-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? "Checking..." : "Check Tokens"}
          </button>

          {showTokens && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Low Value Tokens</h2>
              {lowValueTokens.length === 0 ? (
                <p>No low value tokens found.</p>
              ) : (
                <>
                  {lowValueTokens.map((token) => (
                    <div key={token.mint} className="flex items-center mb-2">
                      <img
                        src={token.logoURI}
                        alt={token.name}
                        className="w-8 h-8 mr-2 rounded-full"
                        onError={(e) => (e.currentTarget.src = "/default-token.png")}
                      />
                      <input
                        type="checkbox"
                        id={token.mint}
                        checked={selectedTokens[token.mint]}
                        onChange={() => handleTokenSelection(token.mint)}
                        className="mr-2"
                      />
                      <label htmlFor={token.mint}>
                        {token.name} - Amount: {token.amount.toFixed(2)} - Value: $
                        {token.totalValueInUSD.toFixed(2)}
                      </label>
                    </div>
                  ))}
                  <button
                    onClick={handleSwapTokens}
                    className="bg-green-500 text-white px-4 py-2 rounded mt-4"
                  >
                    Swap Selected Tokens to SOL
                  </button>
                  {swapStatus && (
                    <div className="mt-4 p-4 bg-gray-100 rounded">
                      <p>{swapStatus}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TokenSwapComponent;