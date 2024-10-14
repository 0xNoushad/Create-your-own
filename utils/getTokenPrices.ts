import axios from 'axios';

async function getTokenPrices(tokens: { mint: string; amount: number }[]) {
    try {
        // Extract mint addresses directly inside this function
        const tokenMints = tokens.map((token) => token.mint).join(','); // Join mints by comma

        // Fetch prices from Jupiter Price API for these token mints (vsToken is USDC by default)
        const response = await axios.get(`https://price.jup.ag/v6/price?ids=${tokenMints}&vsToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`);

        const priceData = response.data.data;

        if (!priceData) {
            throw new Error('Invalid response from Jupiter API');
        }

        // Map each token to its corresponding price and total value in USD
        return tokens.map((token) => {
            const price = priceData[token.mint]?.price || 0; // Safely handle missing prices
            return {
                ...token,
                priceInUSD: price,
                totalValueInUSD: token.amount * price, // Calculate total value in USD
            };
        });
    } catch (error) {
        console.error('Error fetching token prices:', error);
        throw error;
    }
}

export default getTokenPrices;
