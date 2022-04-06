const EventEmitter = require('events').EventEmitter
const protoo = require('protoo-server')
const throttle = require('@sitespeed.io/throttle')

const Studio = require('./studio')
const Logger = require('../logger')
const config = require('../../config')

const logger = new Logger('Room')

class Room extends EventEmitter {
  static async create({ mediasoupWorker, roomId }) {
    logger.info( 'create() [roomId: %s]', roomId )

    const protooRoom = new protoo.Room()

    const { mediaCodecs } = config.mediasoup.routerOptions

    const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs })

    const audioLevelObserver = await mediasoupRouter.createAudioLevelObserver({
      maxEntries: 1,
      threshold : -80,
      interval  : 800
    })

    const room = new this( {
      roomId, protooRoom, mediasoupRouter, audioLevelObserver
    })

    room.startStudio()

    return room
  }

  constructor( { roomId, protooRoom, mediasoupRouter, audioLevelObserver }) {
    super()
    this.setMaxListeners( Infinity )

    this._roomId = roomId

    this._closed = false

    this._protooRoom = protooRoom

    this._mediasoupRouter = mediasoupRouter

    this._audioLevelObserver = audioLevelObserver

    this._networkThrottled = false

    this._studio = new Studio( { mediasoupRouter, ...config.studio  })

    this._handleAudioLevelObserver()
  }

  startStudio() {
    if( this._studio ) {
      this._studio.start()
    }
  }

  close() {
    logger.debug('close()')

    this._closed = true

    this._protooRoom.close()

    this._mediasoupRouter.close()

    this.emit('close')

    if( this._networkThrottled ) {
      throttle.stop({})
        .catch( () => {})
    }
  }

  logStatus() {
    logger.info(
      'logStatus() [roomId:%s, protoo Peers: %s]',
      this._roomId, this._protooRoom.peers.length
    )
  }

  handleProtooConnection({ peerId, consume, protooWebSocketTransport }) {
    const existingPeer = this._protooRoom.getPeer( peerId )

    if( existingPeer ) {
      logger.warn(
        'handleProtooConnection() | there is already a protoo Peer with same peerId, closing it [peerId: %s]',
        peerId
      )

      existingPeer.close()
    }

    try {
      const peer = this._protooRoom.createPeer( peerId, protooWebSocketTransport )

      peer.data.consume = !!consume
      peer.data.joined = false
      peer.data.displayName = undefined
      peer.data.device = undefined
      peer.data.rtpCapabilities = undefined
      peer.data.sctpCapabilities = undefined

      peer.data.transports = new Map()
      peer.data.producers  = new Map()
      peer.data.consumers  = new Map()
      peer.data.dataProducers = new Map()
      peer.data.dataConsumers = new Map()
      
      peer.on('request', ( request, accept, reject ) => {
        logger.debug('protoo Peer "request" event [method:%s, peerId: %s]', 
          request.method, peer.id )

        this._handleProtooRequest( peer, request, accept, reject )
          .catch( err => {
            logger.error( 'request failed:%o', err )
            reject( err )
          })
      })

      peer.on('close', () => {
        if( this._closed ) return

        logger.debug('protoo Peer "close" event [peerId:%s]', peer.id )

        this._studio.deletePeer( peer.id )

        if( peer.data.joined ) {
          for( const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
            otherPeer.notify('peerClosed', {peerId: peer.id })
              .catch(() => {})
            otherPeer.notify('studioLayoutUpdated', this._studio.layout )
              .catch(() => {})
          }
        }

        for( const transport of peer.data.transports.values()) {
          transport.close()
        }

        if( this._protooRoom.peers.length === 0 ) {
          logger.info(
            'last Peer in the room left, closing the room [roomId: %s]',
            this._roomId
          )
          this.close()
        }
      })
    } catch(err) {
      logger.error( 'protooRoom.createPeer() failed:%o', error )
    }
  }

  getRouterCapabilities() {
    return this._mediasoupRouter.rtpCapabilities
  }

  _handleAudioLevelObserver() {
    this._audioLevelObserver.on('volumes', volumes => {
      const { producer, volume } = volumes[0]

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'activeSpeaker', {
          peerId: producer.appData.peerId,
          volume
        }).catch( () => {} )
      }
    })

    this._audioLevelObserver.on('silence', () => {
      for( const peer of this._getJoinedPeers()) {
        peer.notify('activeSpeaker', { peerId: null })
          .catch(() => {})
      }
    })
  }

  async _handleProtooRequest( peer, request, accept, reject ) {
    switch( request.method ) {
      case 'getRouterRtpCapabilities': {
        accept( this._mediasoupRouter.rtpCapabilities )
        break
      }
      case 'join': {
        if( peer.data.joined ) throw new Error('Peer already joined.')

        const { displayName, device, rtpCapabilities, sctpCapabilities } = request.data

        peer.data.joined = true
        peer.data.displayName = displayName
        peer.data.device = device
        peer.data.rtpCapabilities = rtpCapabilities
        peer.data.sctpCapabilities = sctpCapabilities

        const joinedPeers = this._getJoinedPeers()

        const peerInfos = joinedPeers
          .filter( joinedPeer => joinedPeer.id !== peer.id )
          .map( joinedPeer => ({
            id         : joinedPeer.id,
            displayName: joinedPeer.data.displayName,
            device     : joinedPeer.data.device
          }))
        accept({ peers: peerInfos })

        peer.data.joined = true

        for( const joinedPeer of joinedPeers ) {
          for( const producer of joinedPeer.data.producers.values() ) {
            this._createConsumer({
              consumerPeer: peer,
              producerPeer: joinedPeer,
              producer
            })
          }

          for( const dataProducer of joinedPeer.data.dataProducers.values() ) {
            this._createDataConsumer({
              dataConsumerPeer: peer,
              dataProducerPeer: joinedPeer,
              dataProducer
            })
          }
        }

        for( const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
          otherPeer.notify('newPeer', {
            id         : peer.id,
            displayName: peer.data.displayName,
            device     : peer.data.device
          })
        }
        break
      }
      case 'createWebRtcTransport': {
        const { forceTcp, producing, consuming, sctpCapabilities } = request.data

        logger.info( 'received createWebRtcTransport: %o', request.data )

        const webRtcTransportOptions = {
          ...config.mediasoup.webRtcTransportOptions,
          enableSctp: Boolean( sctpCapabilities ),
          numSctpStreams: ( sctpCapabilities || {} ).numSctpStreams,
          appData: { producing, consuming }
        }

        if( forceTcp ) {
          webRtcTransportOptions.enableUdp = false
          webRtcTransportOptions.enableTcp = true
        }

        const transport = await this._mediasoupRouter
          .createWebRtcTransport( webRtcTransportOptions )
        
        transport.on('sctpstatechange', sctpState => {
          logger.debug( 'WebRtcTransport "sctpstatechange" event [sctpState: %s]', sctpState )
        })

        transport.on('dtlsstatechange', dtlsState => {
          if( dtlsState === 'failed' || dtlsState === 'closed' ) {
            logger.warn( 'WebRtcTransport "dtlsstatechange event [dtlsState:%s]', dtlsState )
          }
        })

        await transport.enableTraceEvent([ 'bwe' ])

        transport.on('trace', trace => {
          logger.debug(
            'transport "trace" event [transportId:%s, trace.type: %s, trace: %o]',
            transport.id, trace.type, trace
          )

          if( trace.type === 'bwe' && trace.direction === 'out' ) {
            peer.notify( 'downlinkBwe', {
              desiredBitrate         : trace.info.desiredBitrate,
              effectiveDesiredBitrate: trace.info.effectiveDesiredBitrate,
              availableBitrate       : trace.info.availableBitrate
            }).catch( () => {})
          }
        })

        peer.data.transports.set( transport.id, transport )

        accept( {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters
        })

        const { maxIncomingBitrate } = config.mediasoup.webRtcTransportOptions

        if( maxIncomingBitrate ) {
          try {
            await transport.setMaxIncomingBitrate( maxIncomingBitrate )
          } catch(err ) {}
        }

        break
      }
      case 'connectWebRtcTransport': {
        const { transportId, dtlsParameters } = request.data
        const transport = peer.data.transports.get( transportId )

        if( !transport ) {
          throw new Error( `transport with id "${transportId}" not found`)
        }

        await transport.connect({ dtlsParameters })

        accept()

        break
      }
      case 'restartIce': {
        const { transportId } = request.data
        const transport = peer.data.transports.get( transportId )

        if( !transport ) {
          throw new Error( `transport with id "${transportId}" not found`)
        }

        const iceParameters = await transport.restartIce()

        accept( iceParameters )
        
        break
      }
      case 'produce': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const { transportId, kind, rtpParameters } = request.data
        let { appData } = request.data
        const transport = peer.data.transports.get( transportId )

        if( !transport ) {
          throw new Error( `transport with id "${transportId}" not found`)
        }

        appData = { ...appData, peerId: peer.id }

        const producer = await transport.produce({
          kind, rtpParameters, appData
        })

        peer.data.producers.set( producer.id, producer )

        producer.on('score', score => {
          peer.notify( 'producerScore', { producerId: producer.id, score } )
            .catch( () => {} )
        })

        producer.on( 'videoorientationchange', videoOrientation => {
          logger.debug(
            'producer "videoorientationchange" event [producerId: %s, videoOrientation: %o',
            producer.id, videoOrientation
          )
        })

        producer.on( 'trace', trace => {
          logger.debug(
            'producer "trace" event [producerId:%s, trace.type:%s, trace: %o]',
            producer.id, trace.type, trace
          )
        })

        accept( { id: producer.id } )

        for( const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
          this._createConsumer( {
            consumerPeer: otherPeer,
            producerPeer: peer,
            producer
          })
        }

        if( producer.kind === 'audio' ) {
          this._audioLevelObserver.addProducer({ producerId: producer.id })
            .catch(() => {})
        }

        break
      }
      case 'closeProducer': {
        if( !peer.data.joined ) {
          throw new Error('Peer not yet joined')
        }

        const { producerId } = request.data
        const producer = peer.data.producers.get( producerId )

        if( !producer ) {
          throw new Error(`producer with id "${producerId}" not found`)
        }

        producer.close()

        peer.data.producers.delete( producer.id )

        accept()

        break
      }
      case 'pauseProducer': {
        if( !peer.data.joined ) {
          throw new Error('Peer not yet joined')
        }

        const { producerId } = request.data
        const producer =  peer.data.producers.get( producerId )

        if( !producer ) {
          throw new Error( `producer with id "${producerId}" not found`)
        }

        await producer.pause()

        accept()

        break
      }
      case 'resumeProducer': {
        if( !peer.data.joined ) {
          throw new Error('Peer not yet joined')
        }

        const { producerId } = request.data
        const producer = peer.data.producers.get( producerId )

        if( !producer ) {
          throw new Error( `producer with id "${producerId}" not found` )
        }

        await producer.resume()

        accept()

        break
      }

      case 'pauseConsumer': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const { consumerId } = request.data
        const consumer = peer.data.consumers.get( consumerId )

        if ( !consumer ) {
          throw new Error( `consumer with id "${consumerId}" not found` )
        }

        await consumer.pause()

        accept()

        break
      }

      case 'resumeConsumer': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const { consumerId } = request.data
        const consumer = peer.data.consumers.get( consumerId )

        if( !consumer ) {
          throw new Error( `consumer with id "${consumerId}" not found`)
        }

        await consumer.resume()

        accept()

        break
      }

      case 'setConsumerPreferredLayers': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const { consumerId, spatialLayer, temporalLayer } = request.data
        const consumer = peer.data.consumers.get( consumerId )

        if( !consumer ) {
          throw new Error( `consumer with id "${consumerId}" not found`)
        }

        await consumer.setPreferredLayers({ spatialLayer, temporalLayer })

        accept()

        break
      }

      case 'setConsumerPriority': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const { consumerId, priority } = request.data
        const consumer = peer.data.consumers.get( consumerId )

        if( !consumer ) {
          throw new Error( `consumer with id "${consumerId}" not found` )
        }

        await consumer.setPriority( priority )

        accept()

        break
      }

      case 'requestConsumerKeyFrame': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }
        
        const { consumerId } = request.data
        const consumer = peer.data.consumers.get( consumerId )

        if( !consumer ) {
          throw new Error( `consumer with id "${consumerId}" not found`)
        }

        await consumer.requestKeyFrame()

        accept()

        break
      }

      case 'produceData': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const {
          transportId, sctpStreamParameters, label, protocol, appData
        } = request.data

        const transport = peer.data.transports.get( transportId )

        if( !transport ) {
          throw new Error( `transport with id "${transportId}" not found` )
        }

        const dataProducer = await transport.produceData( {
          sctpStreamParameters, label, protocol, appData
        })

        peer.data.dataProducers.set( dataProducer.id, dataProducer )

        accept( { id: dataProducer.id } )

        switch (dataProducer.label) {
          case 'chat': {
            for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
              await this._createDataConsumer({
                dataConsumerPeer: otherPeer,
                dataProducerPeer: peer,
                dataProducer
              })
            }
            break
          }
        }
        break
      }

      case 'getStudioSize': {
        accept( {
          width: this._studio.width,
          height: this._studio.height
        } )
        break
      }

      case 'getStudioLayout': {
        accept( this._studio.layout )
        break
      }

      case 'addStudioLayout': {
        const { peerId, audioProducerId, videoProducerId, videoWidth, videoHeight } = request.data
        logger.info('"addStudioLayout" - request.data:%o', request.data )

        // let isExist = !!this._studio.layout.find( item => (
        //   item.peerId === peerId && item.audioProducerId === audioProducerId && item.videoProducerId === videoProducerId
        // ))
        
        // if( !isExist ) {
        //   this._studio.layout = [ ...this._studio.layout, { peerId, audioProducerId, videoProducerId, videoWidth, videoHeight }]
        // }
        await this._studio.addMedia({ peerId, videoHeight, videoWidth, audioProducerId, videoProducerId })

        accept()
        logger.info('this._studio.layout:%o', this._studio.layout )

        for( const peer of this._getJoinedPeers() ) {
          peer.notify( 'studioLayoutUpdated', this._studio.layout )
            .catch( () => {} )
        }

        break
      }

      case 'deleteStudioLayout': {
        const { peerId, audioProducerId, videoProducerId } = request.data
        logger.info('"deleteStudioLayout" - request.data:%o', request.data )

        this._studio.deleteMedia({ peerId, audioProducerId, videoProducerId })

        // this._studio.layout = this._studio.layout.filter( item => ( 
        //   item.peerId !== peerId && item.audioProducerId !== audioProducerId && item.videoProducerId !== videoProducerId 
        // ))

        // todo - calucurate position then update this._studio.layout

        accept()

        for( const peer of this._getJoinedPeers() ) {
          peer.notify( 'studioLayoutUpdated', this._studio.layout )
            .catch( () => {} )
        }

        break
      }

      case 'changeDisplayName': {
        if( !peer.data.joined ) {
          throw new Error( 'Peer not yet joined' )
        }

        const { displayName } = request.data
        const oldDisplayName = peer.data.displayName

        peer.data.displayName = displayName

        for( const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
          otherPeer.notify( 'peerDisplayNameChanged', {
            peerId: peer.id,
            displayName,
            oldDisplayName
          }).catch(() => {})
        }

        accept()

        break
      }

      case 'getTransportStats': {
        const { transportId } = request.data
        const transport = peer.data.transports.get( transportId )

        if( !transport ) {
          throw new Error( `transport with id "${transportId}" not found`)
        }

        const stats = await transport.getStats()
        
        accept( stats )

        break
      }

      case 'getProducerStats': {
        const { producerId } = request.data
        const producer = peer.data.producers.get( producerId )

        if( !producer ) {
          throw new Error( `producer with id "${producerId}" not found` )
        }

        const stats = await producer.getStats()

        accept( stats )

        break
      }

      case 'getConsumerStats': {
        const { consumerId } = request.data
        const consumer = peer.data.consumers.get( consumerId )

        if( !consumer ) {
          throw new Error( `consumer with id "${consumerId}" not found`)
        }

        const stats = await consumer.getStats()

        accept( stats )

        break
      }

      case 'getDataProducerStats': {
        const { dataProducerId } = request.data
        const dataProducer = peer.data.dataProducers.get( dataProducerId )

        if( !dataProducer ) {
          throw new Error(`dataProducer with id "${dataProducerId}" not found`)
        }

        const stats = await dataProducer.getStats()

        accept( stats )

        break
      }

      case 'getDataConsumerStats': {
        const { dataConsumerId } = request.data
        const dataConsumer = peer.data.dataConsumers.get( dataConsumerId )

        if ( !dataConsumer ) {
          throw new Error( `dataConsumer with id "${dataConsumerId}" not found` )
        }

        const stats = await dataConsumer.getStats()

        accept( stats )

        break
      }

      case 'applyNetworkThrottle': {
        const DefaultUplink = 1_000_000
        const DefaultDownlink = 1_000_000
        const DefaultRtt = 0

        const { uplink, downlink, rtt, secret } = request.data

        if( !secret || secret !== process.env.NETWORK_THROTTLE_SECRET ) {
          reject( 403, 'operation NOT allowed')

          return
        }

        try {
          await throttle.start({
            up: uplink || DefaultUplink,
            down: downlink || DefaultDownlink,
            rtt: rtt || DefautlRtt
          })
          
          logger.warn( 
            'network throttle set [uplink:%s, downlink: %s, rtt: %s]',
            uplink || DefaultUplink,
            downlink || DefaultDownlink,
            rtt || DefaultRtt
          )

          accept()
        } catch( err ) {
          logger.error( 'network throttle apply failed: %o', err )

          reject( 500, err.toString() )
        }

        break
      }

      case 'resetNetworkThrottle': {
        const { secret } = request.data
        
        if( !secret || secret !== process.env.NETWORK_THROTTLE_SECRET ) {
          reject( 403, 'operation NOT allowed')

          return
        }

        try {
          await throttle.stop({})

          logger.warn( 'network throttle stopped' )

          accept()
        } catch( err ) {
          logger.error( 'network throttle stop failed: %o', err )

          reject( 500, err.toString() )
        }

        break
      }

      default: {
        logger.error('unknown request method "%s"', request.method )

        reject( 500, `unknown request.method "${request.method}"` )
      }
    }
  }

  _getJoinedPeers({ excludePeer = undefined } = {} ) {
    return this._protooRoom.peers.filter( peer => peer.data.joined && peer !== excludePeer )
  }

  async _createConsumer({ consumerPeer, producerPeer, producer }) {
    if( !consumerPeer.data.rtpCapabilities || !this._mediasoupRouter.canConsume( {
      producerId: producer.id, rtpCapabilities: consumerPeer.data.rtpCapabilities
    }) ) {
      return
    }

    const transport = Array.from( consumerPeer.data.transports.values() )
      .find( t => t.appData.consuming )

    if( !transport ) {
      logger.warn( '_createConsumer() | Transport for consuming not found' )

      return
    }

    let consumer

    try {
      consumer = await transport.consume( {
        producerId: producer.id, 
        rtpCapabilities: consumerPeer.data.rtpCapabilities,
        paused: true
      })
    } catch( err ) {
      logger.warn('_createConsumer() | transport.consume():%o', err)

      return
    }

    consumerPeer.data.consumers.set( consumer.id, consumer )

    consumer.on( 'transportclose', () => {
      consumerPeer.data.consumers.delete( consumer.id )
    })

    consumer.on( 'producerclose', () => {
      consumerPeer.data.consumers.delete( consumer.id )

      consumerPeer.notify( 'consumerClosed', { consumerId: consumer.id} )
        .catch( () => {} )
    })

    consumer.on( 'producerpause', () => {
      consumerPeer.notify( 'consumerPaused', { consumerId: consumer.id } )
        .catch( () => {} )
    })

    consumer.on( 'producerresume', () => {
      consumerPeer.notify( 'consumerResumed', { consumerId: consumer.id } )
        .catch( () => {} )
    })

    consumer.on( 'score', score => {
      consumerPeer.notify( 'consumerScore', { consumerId: consumer.id, score } )
        .catch( () => {} )
    })

    consumer.on( 'layerschange', layers => {
      consumerPeer.notify(
        'consumerLayersChanged', {
          consumerId   : consumer.id,
          spatialLayer : layers ? layers.spatialLayer : null,
          temporalLayer: layers ? layers.temporalLayer: null
        }
      ).catch( () => {})
    })

    consumer.on( 'trace', trace => {
      logger.debug(
        'consumer "trace" event [producerId:%s, trace.type:%s, trace:%o]',
        consumer.id, trace.type, trace
      )
    })

    try {
      await consumerPeer.request(
        'newConsumer', {
          peerId        : producerPeer.id,
          producerId    : producer.id,
          id            : consumer.id,
          kind          : consumer.kind,
          rtpParameters : consumer.rtpParameters,
          type          : consumer.type,
          appData       : producer.appData,
          producerPaused: consumer.producerPaused
        }
      )

      await consumer.resume()

      consumerPeer.notify( 'consumerScore', {
        consumerId: consumer.id,
        score: consumer.score
      }).catch(() => {})
    } catch( err ) {
      logger.warn( '_createConsumer() | failed:%o', err )
    }
  }

  async _createDataConsumer( { dataConsumerPeer, dataProducerPeer = null, dataProducer } ) {
    if( !dataConsumerPeer.data.sctpCapabilities ) {
      return
    }

    const transport = Array.from( dataConsumerPeer.data.transports.values() )
      .find( t => t.appData.consuming )

    if( !transport ) {
      logger.warn( '_createDataConsumer() | Transport for consuming not found' )

      return
    }

    let dataConsumer

    try {
      dataConsumer = await transport.consumeData( {
        dataProducerId: dataProducer.id
      })
    } catch( err ) {
      logger.warn( '_createDataConsumer() | transport.consumeData():%o', err )
    }

    dataConsumerPeer.data.dataConsumers.set( dataConsumer.id, dataConsumer )

    dataConsumer.on( 'transportclose', () => {
      dataConsumerPeer.data.dataConsumers.delete( dataConsumer.id )
    })

    dataConsumer.on( 'dataproducerclose', () => {
      dataConsumerPeer.data.dataConsumers.delete( dataConsumer.id )

      dataConsumerPeer.notify( 'dataConsumerClosed', {
        dataConsumerId: dataConsumer.id
      }).catch( () => {} )
    })

    try {
      await dataConsumerPeer.request( 'newDataConsumer', {
        peerId              : dataProducerPeer ? dataProducerPeer.id: null,
        dataProducerId      : dataProducer.id,
        id                  : dataConsumer.id,
        sctpStreamParameters: dataConsumer.sctpStreamParameters,
        label               : dataConsumer.label,
        protocol            : dataConsumer.protocol,
        appData             : dataProducer.appData
      })
    } catch( err ) {
      logger.warn( '_createDataConsumer() | failed:%o', err )
    }
  }
}

module.exports = Room