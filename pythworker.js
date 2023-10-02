

const { EvmPriceServiceConnection } = require("@pythnetwork/pyth-evm-js");
const { SYMBOLS } = require("./constants");
const priceServiceUrl = 'https://xc-mainnet.pyth.network';
const connection = new EvmPriceServiceConnection(
    priceServiceUrl
);
const price = {};
const priceIds = {
    // You can find the ids of prices at https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD price id in testnet
    // ETH/USD price id in testnet
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    ARB: "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
    ADA: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
    DOGE: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
    SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    LTC: "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
    MATIC: "0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52",
    OP: "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf",
    XRP: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
    DOT: "0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b",
    TRX: "0x67aed5a24fdad045475e7195c98a98aea119c763f272d4523f5bac93a4f33c2b",
    UNI: "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
    ATOM: "0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819",
    AVAX: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
};
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}
function printPrice() {
    console.clear()
    console.log()
    console.log('Pyth price: ')
    for (const symbol of SYMBOLS) {
        console.log(`${symbol}: ${price[symbol]}`)
    }
}
connection.subscribePriceFeedUpdates(Object.values(priceIds), (priceFeed) => {
    const data = priceFeed.getPriceNoOlderThan(60)
    const symbol = getKeyByValue(priceIds, '0x' + priceFeed.id)
    const price = data.price * (10 ** data.expo)
    price[symbol] = price
    process.send({ symbol, price })
    // printPrice()
});