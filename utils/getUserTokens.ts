import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');

async function getUserTokens(walletAddress: string) {
    try {
        const publicKey = new PublicKey(walletAddress);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: TOKEN_PROGRAM_ID,
        });
        console.log('Token Accounts:', tokenAccounts);

        return tokenAccounts.value.map((account) => ({
            mint: account.account.data.parsed.info.mint,
            amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        }));
    } catch (error) {
        console.error('Error fetching user tokens:', error);
        throw error;
    }
}

export default getUserTokens;