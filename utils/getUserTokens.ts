import axios from 'axios';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;

async function getUserTokens(walletAddress: string): Promise<{ mint: string; name: string; logoURI: string; amount: number }[]> {
  const body = {
    jsonrpc: '2.0',
    id: 'fetch-solana-assets',
    method: 'searchAssets',
    params: {
      ownerAddress: walletAddress,
      tokenType: 'all',
      displayOptions: {
        showNativeBalance: false, // Exclude SOL
        showCollectionMetadata: false,
      },
    },
  };

  try {
    const response = await axios.post(RPC_URL, body);

    if (!response.data || !response.data.result) {
      throw new Error('Failed to fetch assets');
    }

    const tokens = response.data.result.items
      .filter((item: any) => item.interface === 'FungibleToken' || item.interface === 'FungibleAsset')
      .map((token: any) => ({
        mint: token.id,
        name: token.token_info.symbol || token.content.metadata.symbol || 'Unknown',
        logoURI: token.content.links.image || '',
        amount: token.token_info.balance / Math.pow(10, token.token_info.decimals),
      }));

    return tokens;
  } catch (error) {
    console.error('Error fetching Solana tokens:', error);
    throw error;
  }
}

export default getUserTokens;
