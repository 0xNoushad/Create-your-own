"use client";
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import getUserTokens from '@/utils/getUserTokens';
import getTokenPrices from '@/utils/getTokenPrices';
import filterLowValueTokens from '@/utils/filterLowValuesTokens';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

interface Token {
  mint: string;
  amount: number;
  priceInUSD: number;
  totalValueInUSD: number;
}

const TokenSwapComponent = () => {
  const { publicKey, connected, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lowValueTokens, setLowValueTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<{ [key: string]: boolean }>({});
  const [showTokens, setShowTokens] = useState(false);

  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');

  const handleCheckTokens = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet first');
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
      console.error('Error checking tokens:', error);
      alert('An error occurred while checking your tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelection = (mint: string) => {
    setSelectedTokens(prev => ({
      ...prev,
      [mint]: !prev[mint]
    }));
  };

  const handleSwapTokens = async () => {
    if (!publicKey) return;

    const tokensToSwap = lowValueTokens.filter(token => selectedTokens[token.mint]);

    for (const token of tokensToSwap) {
      try {
        const amount = Math.floor(token.amount * 10 ** 9); // Convert to Lamports

        // Step 1: Get Quote for the Swap
        const { data: quoteResponse } = await axios.get(
          `https://quote-api.jup.ag/v6/quote`,
          {
            params: {
              inputMint: token.mint,
              outputMint: 'So11111111111111111111111111111111111111112', // SOL mint address
              amount,
              slippageBps: 50
            }
          }
        );

        if (!quoteResponse) throw new Error('Failed to fetch quote.');

        // Step 2: Get Swap Transaction
        const { data: swapResponse } = await axios.post(
          'https://quote-api.jup.ag/v6/swap',
          {
            quoteResponse,
            userPublicKey: publicKey.toString(),
            wrapAndUnwrapSol: true,
          },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { swapTransaction } = swapResponse;

        if (!swapTransaction) throw new Error('Failed to get swap transaction.');

        // Step 3: Deserialize and Sign Transaction
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        if (signTransaction) {
          await signTransaction(transaction);
        } else {
          throw new Error('signTransaction is undefined');
        }

        // Step 4: Send Transaction to Blockchain
        const latestBlockHash = await connection.getLatestBlockhash();
        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2,
        });

        await connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txid,
        });

        console.log(`Transaction successful: https://solscan.io/tx/${txid}`);
      } catch (error) {
        console.error('Swap failed:', error);
        alert('An error occurred during the swap.');
      }
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
            {loading ? 'Checking...' : 'Check Tokens'}
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
                      <input
                        type="checkbox"
                        id={token.mint}
                        checked={selectedTokens[token.mint]}
                        onChange={() => handleTokenSelection(token.mint)}
                        className="mr-2"
                      />
                      <label htmlFor={token.mint}>
                        {token.mint.slice(0, 8)}... - Amount: {token.amount.toFixed(2)} - 
                        Value: ${token.totalValueInUSD.toFixed(2)}
                      </label>
                    </div>
                  ))}
                  <button
                    onClick={handleSwapTokens}
                    className="bg-green-500 text-white px-4 py-2 rounded mt-4"
                  >
                    Swap Selected Tokens to SOL
                  </button>
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
