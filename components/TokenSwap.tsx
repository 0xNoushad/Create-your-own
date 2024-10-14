"use client";
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import getUserTokens from '@/utils/getUserTokens';
import getTokenPrices from '@/utils/getTokenPrices';
import filterLowValueTokens from '@/utils/filterLowValuesTokens';

interface Token {
  mint: string;
  amount: number;
  priceInUSD: number;
  totalValueInUSD: number;
}

const TokenSwapComponent = () => {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lowValueTokens, setLowValueTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<{ [key: string]: boolean }>({});
  const [showTokens, setShowTokens] = useState(false);

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
      
      // Initially select all tokens
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

  const handleProceedToSwap = () => {
    const tokensToSwap = lowValueTokens.filter(token => selectedTokens[token.mint]);
    console.log('Tokens to swap:', tokensToSwap);
    
    alert('Swapping process would start here');
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
                    onClick={handleProceedToSwap}
                    className="bg-green-500 text-white px-4 py-2 rounded mt-4"
                  >
                    Proceed to Swap
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