 
interface Token {
    mint: string;
    name: string;
    logoURI: string;
    amount: number;
    priceInUSD: number;
    totalValueInUSD: number;
  }
  
  function filterLowValueTokens(tokens: Token[]) {
     
    const LOW_VALUE_THRESHOLD = 5;
    
    return tokens.filter(
      (token) => 
        token.totalValueInUSD > 0 && 
        token.totalValueInUSD < LOW_VALUE_THRESHOLD
    );
  }
  
  export default filterLowValueTokens;