const express = require('express')
const pidusage = require('pidusage')
const promClient = require('prom-client')
const mediasoup = require('mediasoup')

const Logger = require('../logger')

const collectDefaultMetrics = promClient.collectDefaultMetrics;
const register = new promClient.Registry()
const logger = new Logger('exporter')

collectDefaultMetrics({register});  // デフォルトで組み込まれているメトリクスを、デフォルト10秒間隔で取得

const {
  getWorkersDump,
  getRouterIds,
  getRoutersDump,
  getProducerIds,
  getConsumerIds,
  getProducersStats,
  getConsumersStats,
} = require('./util')

// Maps to store all mediasoup objects.
const workers = new Map();
const routers = new Map();
const transports = new Map();
const producers = new Map();
const consumers = new Map();
const dataProducers = new Map();
const dataConsumers = new Map();

function runMediasoupObserver() {
  mediasoup.observer.on('newworker', (worker) => {
    if (!worker) return
    workers.set(worker.pid, worker);
    worker.observer.on('close', () => workers.delete(worker.pid));

    worker.observer.on('newrouter', (router) => {
      if (!router) return
      routers.set(router.id, router);
      router.observer.on('close', () => routers.delete(router.id));

      router.observer.on('newtransport', (transport) => {
        if( !transport ) return
        transports.set(transport.id, transport);
        transport.observer.on('close', () => transports.delete(transport.id));

        transport.observer.on('newproducer', (producer) => {
          if( !producer ) return
          producers.set(producer.id, producer);
          producer.observer.on('close', () => producers.delete(producer.id));
        });

        transport.observer.on('newconsumer', (consumer) => {
          if( !consumer ) return 
          consumers.set(consumer.id, consumer);
          consumer.observer.on('close', () => consumers.delete(consumer.id));
        });

        transport.observer.on('newdataproducer', (dataProducer) => {
          if( !dataProducer ) return
          dataProducers.set(dataProducer.id, dataProducer);
          dataProducer.observer.on('close', () => dataProducers.delete(dataProducer.id));
        });

        transport.observer.on('newdataconsumer', (dataConsumer) => {
          if( !dataConsumer ) return
          dataConsumers.set(dataConsumer.id, dataConsumer);
          dataConsumer.observer.on('close', () => dataConsumers.delete(dataConsumer.id));
        });
      });
    });
  });
}

module.exports = async function(props) {
  // Run the mediasoup observer API.
  runMediasoupObserver();

  const _props = Object.assign({}, {port:4000}, props)

  const app = express()

  // setup REST 

  // get all metrics in prometheus format
  app.get('/metrics', async (_, res) => {
    // process
    const usages = []
    const pusage = await pidusage(process.pid)
    usages.push( Object.assign({}, pusage, { type: 'parent' }) )

    let wusage
    for( let worker of workers.values() ) {
      wusage =  await pidusage( worker.pid )
      usages.push( Object.assign({}, wusage, { type: 'worker' }))
    }

    const mediasoup_processes_num = {
      labels: {},
      value: usages.length
    }

    const mediasoup_processes_cpu_usage = usages.map( (usage) => ({
      labels: { pid: usage.pid, ppid: usage.ppid, type: usage.type },
      value: usage.cpu
    }))

    const mediasoup_processes_memory_usage = usages.map( usage => ({
      labels: { pid: usage.pid, ppid: usage.ppid, type: usage.type },
      value: usage.memory
    }))

    // workers
    const workersDump = await getWorkersDump( workers )
    const routerIds = getRouterIds( workersDump )
    const routersDump = await getRoutersDump( routers, routerIds )

    const mediasoup_workers_active_num = {
      labels: {},
      value: workersDump.filter( w => w.routerIds.length > 0).length
    }
    const mediasoup_workers_idle_num = {
      labels: {},
      value: workersDump.filter( w => w.routerIds.length === 0).length
    }
    const mediasoup_workers_total_num = {
      labels: {},
      value: workersDump.length
    }
    const mediasoup_routers_num = {
      labels: {},
      value: routerIds.length
    }

    const producerIds = getProducerIds( routersDump )

    const mediasoup_producers_num = {
      labels: {},
      value: producerIds.length
    }

    const consumerIds = getConsumerIds( routersDump )

    const mediasoup_consumers_num = {
      labels: {},
      value: consumerIds.length
    }

    const obj = {
      mediasoup_processes_num,
      mediasoup_processes_cpu_usage,
      mediasoup_processes_memory_usage,
      mediasoup_workers_active_num,
      mediasoup_workers_idle_num,
      mediasoup_workers_total_num,
      mediasoup_routers_num,
      mediasoup_producers_num,
      mediasoup_consumers_num,
    }

    const _register = new promClient.Registry()

    Object.entries( obj ).forEach( ([key, v]) => {
      if( Array.isArray( v ) ) {
        const gauge = new promClient.Gauge({
          name: key,
          help: key,
          labelNames: (
            typeof(v[0]) === 'object' && typeof(v[0]).labels === 'object'
          ) ? Object.keys(v[0].labels): [],
          registers: [ _register ]
        })

        v.forEach( _item => {
          if( !isNaN( _item.value )) gauge.set(_item.labels, _item.value)
        })
      } else {
        if( !isNaN( v.value ) ) {
          const gauge = new promClient.Gauge({
            name: key,
            help: key,
            labelNames: Object.keys(v.labels),
            registers: [ _register ]
          })
          gauge.set( v.labels, v.value )
        }
      }
    })

    const merged = promClient.Registry.merge([register, _register])
    const ret = await merged.metrics()

    res.set("Content-Type", "text/plain")
    res.send( ret )
  })

  // start REST server
  app.listen(_props.port, _ => {
    logger.info('mediasoup-exporter started on port', _props.port)
  })
};