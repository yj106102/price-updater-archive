const { interval } = require('rxjs');
const WebSocket = require('ws');
const { PROVIDERS, WEBSOCKETS, SYMBOLS } = require('./constants.js')
const { ungzip } = require('pako')
const provider = process.env.PROVIDER
const savedSymbols = {

};
const providersMsgOnce = [PROVIDERS.binance, PROVIDERS.okx, PROVIDERS.bitget, PROVIDERS.coinbase]
const sendSubscribeMsg = (ws) => {
    if (providersMsgOnce.includes(provider)) {
        const msg = getSubscribeOnceMsg()
        ws.send(msg)
        return
    }
    for (const symbol of SYMBOLS) {
        const msg = getSubscribeMsg(symbol)
        ws.send(msg)
    }
}
const getSubscribeOnceMsg = () => {

    let msg
    if (provider === PROVIDERS.binance) {
        let params = []
        for (const symbol of SYMBOLS) {
            params.push(`${symbol.toLowerCase()}usdt@trade`)
        }
        msg = JSON.stringify({
            method: 'SUBSCRIBE',
            params,
            id: 1
        });
    }
    if (provider === PROVIDERS.okx) {
        let args = []
        for (const symbol of SYMBOLS) {
            const arg = {
                channel: "tickers",
                instId: `${symbol}-USDT`
            }
            args.push(arg)
        }
        msg = JSON.stringify({
            op: 'subscribe',
            args
        })
    }
    if (provider === PROVIDERS.bitget) {
        let args = []
        for (const symbol of SYMBOLS) {
            const arg = {
                instType: "SP",
                channel: "ticker",
                instId: `${symbol}USDT`
            }
            args.push(arg)
        }
        msg = JSON.stringify({
            op: 'subscribe',
            args
        })
    }
    if (provider === PROVIDERS.coinbase) {
        let product_ids = []
        for (const symbol of SYMBOLS) {
            product_ids.push(`${symbol}-USD`)
        }
        msg = JSON.stringify({
            type: 'subscribe',
            product_ids,
            channels: ['ticker']
        });
    }

    return msg;
}
const getSubscribeMsg = (symbol) => {
    if (provider === PROVIDERS.bybit) {
        return JSON.stringify({
            op: 'subscribe',
            args: [`tickers.${symbol}USDT`],
        });
    }
    if (provider === PROVIDERS.huobi) {
        return JSON.stringify({
            sub: `market.${symbol.toLowerCase()}usdt.ticker`,
        });
    }
}
const getSavedSymbol = (chanId) => {
    return savedSymbols[chanId]
}
const processMessage = (data) => {
    const message = JSON.parse(data)
    const [symbol, price] = getSymbolAndPriceFromMessage(message)
    if (SYMBOLS.includes(symbol) && price !== undefined)
        process.send({ symbol, price })
}
const getSymbolAndPriceFromMessage = (message) => {
    if (provider === PROVIDERS.binance) {
        if (message.e == "trade") {
            const symbol = message.s.replace('USDT', '');
            const price = message.p;
            return [symbol, price]
        }
    }
    if (provider === PROVIDERS.bybit) {
        if (Object.keys(message).includes('data')) {
            const symbol = message.data.symbol.replace('USDT', '')
            const price = message.data.lastPrice;
            return [symbol, price]
        }
    }
    if (provider === PROVIDERS.okx) {
        if (Object.keys(message).includes('data')) {
            const symbol = message.arg.instId.replace('-USDT', '')
            const price = message.data[0].last;
            return [symbol, price]
        }
    }
    if (provider === PROVIDERS.bitget) {
        if (Object.keys(message).includes('data')) {
            const symbol = message.arg.instId.replace('USDT', '')
            const price = message.data[0].last;
            return [symbol, price]
        }
    }
    if (provider === PROVIDERS.coinbase) {
        if (message.type == "ticker") {
            const symbol = message.product_id.replace('-USD', '');
            const price = message.price;
            return [symbol, price]
        }
    }
    if (provider === PROVIDERS.huobi) {
        if (Object.keys(message).includes('tick')) {
            const symbol = message.ch.replace('market.', '').replace('usdt.ticker', '').toUpperCase();
            const price = message.tick.lastPrice;
            return [symbol, price]
        }
    }
    return [0, 0]
}
function startWebsocket() {
    const ws = new WebSocket(WEBSOCKETS[provider])
    let startTime;
    let endTime;
    const timeouts = []
    const intervals = []
    let pongArrived = false;
    ws.on('open', () => {
        console.log('Connected to ', provider, ' WebSocket');
        sendSubscribeMsg(ws);
    });
    ws.on('message', (data) => {
        if (provider === PROVIDERS.huobi) {
            data = Buffer.from(data)
            data = ungzip(data)
            data = new TextDecoder().decode(data)
        }
        if (data.toString() === 'pong') {
            pongArrived = true;
            return;
        }
        const parsedData = JSON.parse(data)
        if (Object.keys(parsedData).includes('ping')) {
            ws.send(JSON.stringify({ pong: parsedData.ping }))

            return;
        }
        // console.log('-------------')
        // console.log(JSON.parse(data))
        // console.log(data.toString())
        processMessage(data);

    }
    );
    ws.on('ping', () => {
    });
    ws.on('pong', () => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`${provider} response time : ${elapsedTime} s`)
        if (elapsedTime > 10) {
            console.log('more than 10s!!!!!!!!!!!!!')
        }
        const timeoutID = timeouts.shift();
        clearTimeout(timeoutID);
        // clear first timeout
    });

    ws.on('close', (code, reason) => {
        console.log(`${provider} WebSocket connection closed with code ${code}`);
        console.log(`reason was ${reason.toString()}`)
        for (const T of timeouts) {
            clearTimeout(T)
        }
        for (const I of intervals) {
            clearInterval(I)
        }
        startWebsocket();
    });
    ws.on('error', (error) => {
        console.error(`${provider} WebSocket error: ${error}`);
    });
    let T;
    let I = setInterval(() => {
        pongArrived = false;
        startTime = Date.now();
        if (provider === PROVIDERS.bybit) ws.send(JSON.stringify({ "req_id": "100001", "op": "ping" }));
        else if (provider === PROVIDERS.bitget) ws.send("ping");
        ws.ping();
        T = setTimeout(() => {

            console.log(provider, 'ping not arrived')
            ws.close();
        }, 30000)
        timeouts.push(T)
    }, 20000);
    intervals.push(I)

}
startWebsocket();