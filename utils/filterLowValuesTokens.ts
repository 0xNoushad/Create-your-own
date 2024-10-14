function filterLowValueTokens(
    tokens: { mint: string; amount: number; priceInUSD: number; totalValueInUSD: number }[]
) {
    return tokens.filter((token) => {
        return token.totalValueInUSD > 0 && token.totalValueInUSD < 5;
    });
}

export default filterLowValueTokens;