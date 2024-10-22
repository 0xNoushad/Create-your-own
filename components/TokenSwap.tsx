"use client";
import React, { useState } from "react";
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
} from "@solana/web3.js";
import axios from "axios";

interface Token {
  mint: string;
  name: string;
  logoURI: string;
  amount: number;
  priceInUSD: number;
  totalValueInUSD: number;
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
const connection = new Connection(RPC_URL, "confirmed");

const TokenSwapComponent = () => {
  const { publicKey, connected, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lowValueTokens, setLowValueTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<{ [key: string]: boolean }>({});
  const [showTokens, setShowTokens] = useState(false);

  const handleCheckTokens = async () => {
    if (!connected || !publicKey) {
      alert("Please connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      const tokens = await getUserTokens(publicKey.toString());
      const tokensWithPrices = await getTokenPrices(tokens);
      const filteredTokens = filterLowValueTokens(tokensWithPrices);
      setLowValueTokens(filteredTokens);

      const initialSelection = filteredTokens.reduce((acc: { [key: string]: boolean }, token) => {
        acc[token.mint] = true;
        return acc;
      }, {});
      setSelectedTokens(initialSelection);
      setShowTokens(true);
    } catch (error) {
      console.error("Error checking tokens:", error);
      alert("An error occurred while checking your tokens");
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelection = (mint: string) => {
    setSelectedTokens((prev) => ({
      ...prev,
      [mint]: !prev[mint],
    }));
  };

  const fetchQuoteWithRetry = async (params: any, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data } = await axios.get("https://quote-api.jup.ag/v6/quote", { params });
        return data;
      } catch (error) {
        if (i === retries - 1) throw new Error("Failed to fetch quote after multiple attempts");
        console.log(`Retrying... (${i + 1})`);
      }
    }
  };

  const handleSwapTokens = async () => {
    if (!publicKey) return;

    const tokensToSwap = lowValueTokens.filter((token) => selectedTokens[token.mint]);

    const instructions: TransactionInstruction[] = [];

    for (const token of tokensToSwap) {
      try {
        const amount = Math.floor(token.amount * 10 ** 9); // Convert to Lamports

        console.log(`Swapping Token: ${token.name} Mint: ${token.mint} Amount: ${amount}`);

        if (amount <= 0) {
          console.error(`Invalid amount for token: ${token.name}`);
          alert(`Cannot swap token ${token.name} with zero balance.`);
          continue;
        }

        // Fetch quote
        const quoteResponse = await fetchQuoteWithRetry({
          inputMint: token.mint,
          outputMint: "So11111111111111111111111111111111111111112", // SOL mint
          amount,
          slippageBps: 50,
        });

        console.log("Jupiter Quote Response:", quoteResponse);

        if (!quoteResponse || !quoteResponse.routes || quoteResponse.routes.length === 0) {
          throw new Error("No valid swap route found.");
        }

        const route = quoteResponse.routes[0]; // Select the first available route

        // Fetch swap instructions using the route
        const { data: swapResponse } = await axios.post(
          "https://quote-api.jup.ag/v6/swap",
          {
            route,
            userPublicKey: publicKey.toString(),
            wrapAndUnwrapSol: true,
          },
          { headers: { "Content-Type": "application/json" } }
        );

        const { swapTransaction } = swapResponse;
        if (!swapTransaction) throw new Error("Failed to get swap transaction.");

        // Create TransactionInstruction
        const transactionBuf = Buffer.from(swapTransaction, "base64");
        const transaction = VersionedTransaction.deserialize(transactionBuf);

        const instruction = transaction.message.instructions[0];
        instructions.push(instruction);
      } catch (error) {
        console.error(`Failed to prepare swap for ${token.name}:`, error);
        alert(`An error occurred while preparing swap for ${token.name}.`);
        return;
      }
    }

    try {
      // Create a single transaction with all swap instructions
      const latestBlockhash = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);

      // Sign the transaction
      if (signTransaction) {
        await signTransaction(transaction);
      } else {
        throw new Error("Wallet is unable to sign the transaction");
      }

      // Send the transaction to the Solana network
      const serializedTransaction = transaction.serialize();
      const txid = await connection.sendRawTransaction(serializedTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: txid,
      });

      console.log(`Transaction successful: https://solscan.io/tx/${txid}`);
      alert(`Transaction successful: https://solscan.io/tx/${txid}`);
    } catch (error) {
      console.error("Swap failed:", error);
      alert("An error occurred while swapping tokens.");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Token Swap</h1>

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
                lowValueTokens.map((token) => (
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
                ))
              )}
              <button
                onClick={handleSwapTokens}
                className="bg-green-500 text-white px-4 py-2 rounded mt-4"
              >
                Swap Selected Tokens to SOL
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TokenSwapComponent;
