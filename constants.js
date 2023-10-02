const PROVIDERS = {
    binance: "binance",
    bybit: "bybit",
    okx: "okx",
    bitget: "bitget",
    coinbase: "coinbase",
    huobi: "huobi"

    // bitfinex: "bitfinex",
    // kraken: "kraken",
    // gateio: "gateio",
}
const WEBSOCKETS = {
    "binance": "wss://stream.binance.com:9443/ws",
    "bitfinex": "wss://api-pub.bitfinex.com/ws/2",
    "coinbase": "wss://ws-feed.pro.coinbase.com",
    "kraken": "wss://ws.kraken.com",
    "bybit": "wss://stream.bybit.com/v5/public/spot",
    "okx": "wss://ws.okx.com:8443/ws/v5/public",
    "huobi": "wss://api.huobi.pro/ws",
    "bitget": "wss://ws.bitget.com/spot/v1/stream",
    "gateio": "wss://fx-ws.gateio.ws/v4/ws/usdt"
}
// EXCHANGE, COIN 24HR TRADE VOLUME
// CERTAIN PERCENTAGE DIFF FROM AVERAGE OF TWO MEDIAN VALUES
// BINANCE BIT 118
// BYBIT 32
// OKX 36
// BITGET 40
// const SYMBOLS = ['BTC', 'ETH', 'ARB', 'ADA', 'DOGE', 'SOL', 'LTC', 'MATIC', 'OP', 'XRP', 'DOT', 'TRX', 'UNI', 'ATOM', 'AVAX']
const SYMBOLS = ['BTC', 'ETH', 'ARB', 'ADA', 'DOGE', 'SOL', 'LTC', 'MATIC']
const TOKEN_ID = {}
for (let i = 0; i < SYMBOLS.length; i++) {
    const key = SYMBOLS[i];
    TOKEN_ID[key] = i + 1;
}
// goerli network
// const SYMBOLS = ['BTC', 'MATIC']
module.exports = {
    PROVIDERS, WEBSOCKETS, SYMBOLS, TOKEN_ID
}