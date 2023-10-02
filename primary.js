var cluster = require('cluster');
const { PROVIDERS, SYMBOLS, TOKEN_ID, WEIGHTS } = require('./constants.js');
const { default: axios } = require('axios');
const OPERATION_MODES = {
    PRICE: 0,
    AGG_PRICE: 1,
    TIME: 2,
    EXCHANGE_DIFF: 3,
    PYTH_DIFF: 4,
    COUNT: 5
}
const PRICE_AGGREGATION_MODES = {
    TRIMMED_MEAN: 0,
    WEIGHTED_MEAN: 1,
    TRIMMED_WEIGHTED_MEAN: 2,
}
const CONSOLE_CLEAR = true
const PRINT_RESULT = true
const PRICE_TRIM_THRESHOLD = 0.3;
const providerVolume = {};
const operationMode = (process.argv.length < 3) ? OPERATION_MODES.AGG_PRICE : OPERATION_MODES[process.argv[2]];
const priceAggregationMode = (process.argv.length < 4) ? PRICE_AGGREGATION_MODES.TRIMMED_WEIGHTED_MEAN : PRICE_AGGREGATION_MODES[process.argv[3]];
const price = {}
const pythPrice = {}
const updatedTime = {}
const updateCount = {}
let startTime;
let maxExchangeDiff = {};
let maxExchangeDiffTimestamp = {};
let exchangePriceAtMaxExchangeDiff = {};
let averageCumulativeExchangeDiff = {};
let exchangeDiffUpdateCount = {};
let prevPythUpdatedTime = {};
let cumulativePythPriceDiff = {};
let pythPriceDiff = {};
let dataCount = {};
async function getProviderVolume(provider, symbol) {
    if (provider === PROVIDERS.binance) {
        url = 'https://api.binance.com/api/v3/klines'
        params = {
            symbol: `${symbol}USDT`,
            interval: '1d',
            limit: 3
        }
        const response = await axios.get(url, { params })
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            sum += Number(response.data[i][5])
        }
        sum /= 3;
        return sum;
    }
    if (provider === PROVIDERS.bitget) {
        url = 'https://api.bitget.com/api/spot/v1/market/candles'
        params = {
            symbol: `${symbol}USDT_SPBL`,
            period: '1day',
            after: Date.now() - 86400 * 1000 * 3,
            endTime: Date.now(),
        }
        const response = await axios.get(url, { params })
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            sum += Number(response.data.data[i].baseVol)
        }
        sum /= 3;
        return sum;
    }
    if (provider === PROVIDERS.bybit) {
        url = 'https://api.bybit.com/v5/market/kline'
        params = {
            category: 'spot',
            symbol: `${symbol}USDT`,
            interval: 'D',
            limit: 4
        }
        const response = await axios.get(url, { params });
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            sum += Number(response.data.result.list[i + 1][5])
        }
        sum /= 3;
        return sum;
    }
    if (provider === PROVIDERS.okx) {
        url = 'https://www.okx.com/api/v5/market/candles'
        params = {
            instId: `${symbol}-USDT`,
            bar: '1Dutc',
            limit: 4
        }
        const response = await axios.get(url, { params });
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            sum += Number(response.data.data[i + 1][5])
        }
        sum /= 3;
        return sum;
    }
    if (provider === PROVIDERS.coinbase) {
        url = `https://api.exchange.coinbase.com/products/${symbol}-USD/candles`
        params = {
            granularity: 86400,
            start: Date.now() - 86400 * 1000 * 4,
            end: Date.now() - 86400 * 1000,
        }
        try {

            const response = await axios.get(url, { params })

            let sum = 0;
            for (let i = 0; i < 3; i++) {
                sum += Number(response.data[i][5])
            }
            sum /= 3;
            return sum
        } catch (error) {
            return null
        }

    }
    if (provider === PROVIDERS.huobi) {
        url = `https://api.huobi.pro/market/history/kline`
        params = {
            symbol: `${symbol.toLowerCase()}usdt`,
            period: '1day',
            size: 4,
        }

        const response = await axios.get(url, { params })
        // console.log(response.data)
        let sum = 0;
        for (let i = 0; i < 3; i++) {
            sum += Number(response.data.data[i + 1].amount)
        }
        sum /= 3;
        return sum

    }
}
async function setProviderVolume() {
    for (const symbol of SYMBOLS) {
        providerVolume[symbol] = {};
        for (const provider in PROVIDERS) {
            console.log(`setting ${provider} - ${symbol}`)
            providerVolume[symbol][provider] = await getProviderVolume(provider, symbol);
        }
    }
}
function getTrimmedMean(symbol) {
    const trimCount = 1;
    const symbolPrices = price[symbol];
    if (symbolPrices === undefined || Object.keys(symbolPrices).length < 1) return 0;
    const validPrices = []
    const median = getMedianPrice(symbol);
    for (const provider in symbolPrices) {
        if (typeof symbolPrices[provider] === 'number' || Math.abs(symbolPrices[provider] - median) / median < PRICE_TRIM_THRESHOLD) {
            validPrices.push([provider, symbolPrices[provider]])
        }
    }
    // todo: if validPrices.length < 3, return pyth price or median price
    const sortedPrices = validPrices.sort((a, b) => a[1] - b[1]);

    const trimmedPrices = sortedPrices.slice(trimCount, -trimCount);

    if (trimmedPrices=== undefined) {
        return 0;
    }
    let priceSum = 0;
    for (const [provider, price] of trimmedPrices) {
        priceSum +=price;
    }
    const mean = priceSum / trimmedPrices.length;
    return mean
}
function getWeightedTrimmedMean(symbol) {
    const trimCount = 1;
    const symbolPrices = price[symbol];
    if (symbolPrices === undefined || Object.keys(symbolPrices).length < 1) return 0;
    const validPrices = []
    const median = getMedianPrice(symbol);
    for (const provider in symbolPrices) {
        if (typeof symbolPrices[provider] === 'number' || Math.abs(symbolPrices[provider] - median) / median < PRICE_TRIM_THRESHOLD) {
            validPrices.push([provider, symbolPrices[provider]])
        }
    }
    // todo: if validPrices.length < 3, return pyth price or median price
    const sortedPrices = validPrices.sort((a, b) => a[1] - b[1]);

    const trimmedPrices = sortedPrices.slice(trimCount, -trimCount);

    if (trimmedPrices=== undefined) {
        return 0;
    }
    let weightSum = 0;
    let weightedPriceSum = 0;
    for (const [provider, price] of trimmedPrices) {
        weightSum += providerVolume[symbol][provider];
        weightedPriceSum += providerVolume[symbol][provider] * price;
    }
    const mean = weightedPriceSum / weightSum;
    return mean

}
function printCount() {
    let header = '       '
    for (const provider in PROVIDERS) {
        header += provider.padStart(15)
    }
    console.log(header)
    console.log()
    var str = ''
    for (const provider in PROVIDERS) {
        str += String(dataCount[provider]).padStart(15)
        dataCount[provider] = 0;
    }
    console.log(str)

}
function printPrice() {
    if (CONSOLE_CLEAR) console.clear()
    let header = '       '
    for (const provider in PROVIDERS) {
        header += provider.padStart(15)
    }
    console.log(header)
    console.log()
    for (const symbol of SYMBOLS) {
        var str = ''
        str += symbol.padEnd(5);
        str += ': '
        for (const provider in PROVIDERS) {
            if (typeof (price[symbol][provider]) === 'number') {
                str += String(price[symbol][provider]).padStart(15)
            }
            else str += 'NA'.padStart(15)
        }
        console.log(str)
    }
}
function getAggregatedPrice(symbol) {
    if (priceAggregationMode === PRICE_AGGREGATION_MODES.TRIMMED_WEIGHTED_MEAN) {
        return getWeightedTrimmedMean(symbol);
    }
    else if (priceAggregationMode === PRICE_AGGREGATION_MODES.TRIMMED_MEAN) {
        return getTrimmedMean(symbol);
    }
    //todo: weighted mean 추가
}
function getMedianPrice(symbol) {
    const symbolPrices = price[symbol];
    if (symbolPrices === undefined || Object.keys(symbolPrices).length < 1) return 0;
    const validPrices = []
    for (const provider in symbolPrices) {
        if (typeof symbolPrices[provider] === 'number') {
            validPrices.push(symbolPrices[provider])
        }
    }
    const sortedPrices = validPrices.slice().sort((a, b) => a - b);
    if (sortedPrices.length % 2 === 0) {
        return (sortedPrices[sortedPrices.length / 2] + sortedPrices[sortedPrices.length / 2 - 1]) / 2;
    }
    else {
        return sortedPrices[Math.floor(sortedPrices.length / 2)];
    }
}
function printAggregatedPrice() {
    if (CONSOLE_CLEAR) console.clear()
    let header = '       '
    for (const provider in PROVIDERS) {
        header += provider.padStart(15)
    }
    header += 'Agg. Price'.padStart(15)
    console.log(header)
    console.log()
    for (const symbol of SYMBOLS) {
        const aggregatedPrice = getAggregatedPrice(symbol);
        var str = ''
        str += symbol.padEnd(5);
        str += ': '
        for (const provider in PROVIDERS) {
            if (typeof (price[symbol][provider]) === 'number') {
                str += String(price[symbol][provider]).padStart(15)
            }
            else str += 'NA'.padStart(15)
        }
        str += String(aggregatedPrice.toFixed(5)).padStart(15)
        console.log(str)
    }
}
function printTime() {
    if (CONSOLE_CLEAR) console.clear()
    let header = '       '
    for (const provider in PROVIDERS) {
        header += provider.padStart(15)
    }
    console.log(header)
    console.log()
    for (const symbol of SYMBOLS) {
        var str = ''
        str += symbol.padEnd(5);
        str += ': '
        for (const provider in PROVIDERS) {
            if (typeof (price[symbol][provider]) === 'number') {
                str += String(Math.floor((updatedTime[symbol][provider] - startTime) / updateCount[symbol][provider])).padStart(15)
            }
            else str += 'NA'.padStart(15)
        }
        console.log(str)
    }
}
function printPythPrice() {
    if (CONSOLE_CLEAR) console.clear()
    console.log()
    console.log('Pyth price: ')
    for (const symbol of SYMBOLS) {
        console.log(`${symbol.padEnd(5)}: ${pythPrice[symbol]}`)
    }
}
function updatePythDiff() {
    for (const symbol of SYMBOLS) {
        if (pythPrice[symbol] === undefined) continue;
        const diff = (pythPrice[symbol] - getWeightedTrimmedMean(symbol)) / pythPrice[symbol] * 100;
        pythPriceDiff[symbol] = diff;
        cumulativePythPriceDiff[symbol] += Math.abs(diff) * (Date.now() - prevPythUpdatedTime[symbol]);
        prevPythUpdatedTime[symbol] = Date.now();
    }
}
function printAveragePythDiff() {
    if (CONSOLE_CLEAR) console.clear()
    console.log()
    console.log('Average Price Diff from pyth: ')
    let pythDiffSum = 0;
    for (const symbol of SYMBOLS) {
        const averagePythDiff = cumulativePythPriceDiff[symbol] / (Date.now() - startTime);
        console.log(symbol, ':', averagePythDiff.toFixed(5))
        pythDiffSum += averagePythDiff
    }
    console.log()
    console.log('avg:', (pythDiffSum / SYMBOLS.length).toFixed(5))
}

function updateExchangeDiff() {
    loop1:
    for (const symbol of SYMBOLS) {
        let maxDiff = 0;
        for (const provider in PROVIDERS) {
            if (price[symbol][provider] === undefined) continue loop1;
            diff = Math.abs((price[symbol][provider] - getMedianPrice(symbol)) / price[symbol][provider] * 100)
            if (diff > maxDiff) maxDiff = diff;
        }
        if (maxDiff > maxExchangeDiff[symbol]) {
            maxExchangeDiff[symbol] = maxDiff;
            maxExchangeDiffTimestamp[symbol] = Date.now();
            for (const provider in PROVIDERS) {
                exchangePriceAtMaxExchangeDiff[symbol][provider] = price[symbol][provider];
            }
        }
        averageCumulativeExchangeDiff[symbol] += maxDiff;
        exchangeDiffUpdateCount[symbol] += 1;
    }

}
function printExchangeDiff() {
    if (CONSOLE_CLEAR) console.clear()
    console.log()
    console.log('Exchange Diff: ')
    for (const symbol of SYMBOLS) {
        process.stdout.write(`${symbol.padEnd(5)}: ${maxExchangeDiff[symbol].toFixed(5)}, ${new Date(maxExchangeDiffTimestamp[symbol])}(max)    `)
        console.log(`${(averageCumulativeExchangeDiff[symbol] / exchangeDiffUpdateCount[symbol]).toFixed(5)} (avg)`)
        for (const provider in PROVIDERS) {
            process.stdout.write(`${provider.padStart(10)}: ${exchangePriceAtMaxExchangeDiff[symbol][provider]}`)
        }
        console.log();
        console.log();
    }
}
function updateAndPrintExchangeDiff() {
    updateExchangeDiff();
    printExchangeDiff();
}
function updateAndPrintAveragePythDiff() {
    updatePythDiff();
    printAveragePythDiff();
}
function printResult() {
    if (operationMode === OPERATION_MODES.COUNT) printCount();
    if (operationMode === OPERATION_MODES.PRICE) printPrice();
    if (operationMode === OPERATION_MODES.AGG_PRICE) printAggregatedPrice();
    if (operationMode === OPERATION_MODES.TIME) printTime();
    if (operationMode === OPERATION_MODES.EXCHANGE_DIFF) updateAndPrintExchangeDiff();
    if (operationMode === OPERATION_MODES.PYTH_DIFF) updateAndPrintAveragePythDiff();
}
async function main() {
    for (const provider in PROVIDERS) {
        dataCount[provider] = 0;
    }
    for (const symbol of SYMBOLS) {
        pythPriceDiff[symbol] = 0;
        maxExchangeDiff[symbol] = 0;
        averageCumulativeExchangeDiff[symbol] = 0;
        exchangeDiffUpdateCount[symbol] = 0;
        prevPythUpdatedTime[symbol] = Date.now();
        cumulativePythPriceDiff[symbol] = 0;
        exchangePriceAtMaxExchangeDiff[symbol] = {};
        price[symbol] = {};
        updatedTime[symbol] = {};
        updateCount[symbol] = {};
        for (const provider in PROVIDERS) {
            updatedTime[symbol][provider] = startTime;
            updateCount[symbol][provider] = 0;
        }
    }
    if (operationMode === OPERATION_MODES.AGG_PRICE || operationMode === OPERATION_MODES.PYTH_DIFF) {
        await setProviderVolume();
        console.log(providerVolume);
    }
    const workers = {
    }
    const numCPUs = Object.keys(PROVIDERS).length
    cluster.setupPrimary({
        // exec: './src/worker.js'
        exec: './worker.js'
    })

    for (var i = 0; i < numCPUs; i++) {
        const provider = Object.values(PROVIDERS)[i]
        workers[provider] = cluster.fork({ PROVIDER: provider });
    }
    if (operationMode === OPERATION_MODES.PYTH_DIFF) {
        cluster.setupPrimary({
            // exec: './src/pythWorker.js'
            exec: './pythWorker.js'
        })

        pythWorker = cluster.fork();
    }
    if (PRINT_RESULT) {
        const intervalId = setInterval(printResult, 5000)
    }
    startTime = Date.now();
    for (const provider in PROVIDERS) {
        workers[provider].on('message', (data) => {
            if (data !== undefined) {
                dataCount[provider]++;
                price[data.symbol][provider] = Number(data.price);
                updatedTime[data.symbol][provider] = Date.now();
                updateCount[data.symbol][provider] += 1;
            }
        })
    }
    if (operationMode === OPERATION_MODES.PYTH_DIFF) {
        pythWorker.on('message', (data) => {
            if (data !== undefined) {
                pythPrice[data.symbol] = Number(data.price);
            }
        });
    }
}
main();