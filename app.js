const RxNode = require('rx-node');
// const fetch = require('node-fetch');
function fetch(src) {
  return Promise.resolve({
    json() {
      return {
        ask: Math.random() * 900 + 100,
        bid: Math.random() * 900 + 1100,
        timestamp: Date.now(),
      }
    }
  });
}

const sourceBTC1 = () => fetch('https://api.bitfinex.com/v1/ticker/btcusd')
  .then(r => r.json())
  .then(dataAdapter);

const sourceBTC2 = () => fetch('https://www.bitstamp.net/api/ticker/')
  .then(r => r.json())
  .then(dataAdapter);

const sourceEUR1 = () => fetch('https://www.bitstamp.net/api/ticker/')
  .then(r => r.json())
  .then(dataAdapter);

const sourceEUR2 = () => fetch('https://www.bitstamp.net/api/ticker/')
  .then(r => r.json())
  .then(dataAdapter);

function dataAdapter(data) {
  return {
    ask: parseFloat(data.ask),
    bid: parseFloat(data.bid),
    ts: parseInt(data.timestamp * 1000),
  };
}

class Feed {
  constructor({
    currencyFrom,
    currencyTo,
    expirationTimeMS = 10000,
    interval = 2000,
    sourceName = '',
    pullData = () => Promise.reject('Not implemented pullData method'),
  }) {
    this.pullData = pullData;
    this.interval = interval;
    this.intervalId = null;
    this.data = null;
    this.error = null;
    this.subscribers = [];
    this.updateData = async() => {
      try {
        const data = await this.pullData();
        this.propagateData({
          sourceName,
          currencyFrom,
          currencyTo,
          expirationTimeMS,
          ts: +new Date(),
          data,
        });
      }
      catch (e) {
        this.propagateError(e);
      }
    }
  }

  start() {
    if (this.intervalId === null) {
      this.updateData();
      this.intervalId = setInterval(this.updateData, this.interval);
    }
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  propagateData(data) {
    this.data = data;
    this.error = null;
    this.subscribers.forEach(subscriber => subscriber.onData(data));
  }

  propagateError(error) {
    this.data = null;
    this.error = error;
    this.subscribers.forEach(subscriber => subscriber.onError(error));
  }

  subscribe(onData, onError) {
    const subscriber = {onError, onData};
    if (this.data !== null) {
      onData(this.data);
    }
    if (this.error !== null) {
      onError(this.error);
    }
    this.subscribers = [...this.subscribers, subscriber];
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== subscriber);
    };
  }
}


const feedBTC1 = new Feed({
  currencyFrom: 'BTC',
  currencyTo: 'USD',
  pullData: sourceBTC1,
  sourceName: 'Bitfinex',
});
const feedBTC2 = new Feed({
  currencyFrom: 'BTC',
  currencyTo: 'USD',
  pullData: sourceBTC2,
  sourceName: 'Bitstamp',
});
const feedEUR1 = new Feed({
  currencyFrom: 'USD',
  currencyTo: 'EUR',
  pullData: sourceBTC2,
  sourceName: 'Privat',
});
const feedEUR2 = new Feed({
  currencyFrom: 'USD',
  currencyTo: 'EUR',
  pullData: sourceBTC2,
  sourceName: 'globalEX',
});

class Ticker {
  constructor() {
    this.dataSources = [];
    this.askData = new Map();
    this.bidData = new Map();
  }

  updateData(data) {
    const pk = `${data.currencyFrom}-${data.currencyTo}`;
    const savedAskData = this.askData.get(pk);
    const savedBidData = this.bidData.get(pk);
    if (!savedAskData || savedAskData.ask > data.ask) {
      this.askData.set(pk, data);
    }
    if (!savedBidData || savedBidData.bid > data.bid) {
      this.bidData.set(pk, data);
    }
    console.log(this.askData);
    console.log(this.bidData);
  }

  start() {
    this.dataSources.forEach(ds => {
      ds.feed.start();
    });
  }

  stop() {
    this.dataSources.forEach(ds => {
      ds.feed.stop();
    });
  }

  attachFeed(feed) {
    const unsubscribe = feed.subscribe(
      data => this.updateData(data),
      error => console.error(error)
    );
    const dataSource = {
      feed,
      unsubscribe,
    };
    this.dataSources = [...this.dataSources, dataSource];
    return () => {
      this.dataSources = this.dataSources.filter(ds => ds !== dataSource);
    };
  }
}

const ticker = new Ticker();
ticker.attachFeed(feedBTC1);
ticker.attachFeed(feedBTC2);
ticker.attachFeed(feedEUR1);
ticker.attachFeed(feedEUR2);
ticker.start();
