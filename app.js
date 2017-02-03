const RxNode = require('rx-node');
const fetch = require('node-fetch');

const source1 = () => fetch('https://api.bitfinex.com/v1/ticker/btcusd')
  .then(r => r.json())
  .then(dataAdapter)
  .then((d) => Object.assign({source: 'Bitfinex'}, d));

const source2 = () => fetch('https://www.bitstamp.net/api/ticker/')
  .then(r => r.json())
  .then(dataAdapter)
  .then((d) => Object.assign({source: 'Bitstamp'}, d));

function dataAdapter(data) {
  return {
    ask: parseFloat(data.ask),
    bid: parseFloat(data.bid),
    ts: parseInt(data.timestamp * 1000),
  };
}

class Feed {
  constructor({
    expirationTimeMS = 10000,
    interval = 2000,
    pullData = () => Promise.reject('Not implemented pullData method'),
  }) {
    this.expirationTimeMS = expirationTimeMS;
    this.pullData = pullData;
    this.interval = interval;
    this.intervalId = null;
    this.data = null;

    this.updateData = async() => {
      try {
        const data = await this.pullData();
        this.data = {
          ts: +new Date(),
          data,
        };
        console.log(this.data);
      }
      catch (e) {
        console.log(e);
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
}

const feed1 = new Feed({
  pullData: source1,
  interval: 4000,
});
const feed2 = new Feed({
  pullData: source2,
});

feed1.start();
feed2.start();