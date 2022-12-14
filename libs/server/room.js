const EventEmitter = require('events').EventEmitter
const protoo = require('protoo-server')
const throttle = require('@sitespeed.io/throttle')

const Studio = require('./studio')
const ReactionManager = require('./reaction-manager')
const Logger = require('../logger')
const config = require('../../config')

const logger = new Logger('Room')

/**
 * @class
 * @extends EventEmitter
 */
class Room extends EventEmitter {
  /**
   * 
   * @method Room#create
   * @param {object} props 
   * @param {object} props.mediasoupWorker 
   * @param {string} props.roomId 
   * @returns {Room}
   */
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

    room.startReactionManager()
    room.startStudio()

    return room
  }

  /**
   * 
   * @constructor
   * @param {object} props 
   * @param {string} props.roomId 
   * @param {object} props.protooRoom 
   * @param {object} props.mediasoupRouter 
   * @param {object} props.audioLevelObserver 
   */
  constructor( { roomId, protooRoom, mediasoupRouter, audioLevelObserver }) {
    super()
    this.setMaxListeners( Infinity )

    this._roomId = roomId

    this._closed = false

    this._protooRoom = protooRoom

    this._routings = new Map()

    this._mediasoupRouter = mediasoupRouter

    this._audioLevelObserver = audioLevelObserver

    this._networkThrottled = false

    this._studio = new Studio( config.studio )

    this._reactionManager = new ReactionManager()

    this._caption = ''

    this._handleAudioLevelObserver()
  }

  /**
   * number of reaction
   * 
   * @type {number}
   */
  get numReaction() {
    return this._reactionManager.numReaction
  }

  /**
   * start reaction manager
   * 
   * @method Room#startReactionManager
   * 
   */
  startReactionManager() {
    if( this._reactionManager ) {
      this._reactionManager.start( this._roomId )

      this._reactionManager.on(`reactions/${this._roomId}`, data => {
        for( const peer of this._getJoinedPeers() ) {
          peer.notify( 'reactionsUpdated', data )
            .catch( () => {} )
        }
      })
    }
  }

  /**
   * start studio
   * 
   * @method Room#startStudio
   * 
   */
  startStudio() {
    if( this._studio ) {
      this._studio.start()
    }
  }

  /**
   * close server
   * 
   * @method Room#close
   * @fires Room#close
   * 
   */
  close() {
    logger.debug('close()')

    this._closed = true

    this._reactionManager.destroy()

    this._protooRoom.close()

    this._mediasoupRouter.close()

    /**
     * fires on close 
     * 
     * @event Room#close
     * @type {NULL}
     */
    this.emit('close')

    if( this._networkThrottled ) {
      throttle.stop({})
        .catch( () => {})
    }
  }

  /**
   * log status ( roomId, num of peers )
   * 
   * @method Room#logStatus
   * 
   */
  logStatus() {
    logger.info(
      'logStatus() [roomId:%s, protoo Peers: %s]',
      this._roomId, this._protooRoom.peers.length
    )
  }

  /**
   * set handler for protoo connection
   * 
   * @method Room#handleProtooConnection
   * @param {object} props 
   * @param {string} props.peerId 
   * @param {object} props.consume 
   * @param {object} props.protooWebSocketTransport 
   * 
   */
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

      this._setGenericRouting()
      this._setWebRtcTransportRouting()
      this._setProducerRouting()
      this._setConsumerRouting()
      this._setLayerRouting()
      this._setDataRouting()
      this._setStudioRouting()
      this._setParticipantRouting()
      this._setCaptionRouting()
      this._setCoverRouting()
      this._setBackgroundRouting()
      this._setStatsRouting()
      
      peer.on('request', ( request, accept, reject ) => {
        logger.debug('protoo Peer "request" event [method:%s, peerId: %s]', 
          request.method, peer.id )

        const cb = this._routings.get( request.method )

        if( cb && typeof cb === 'function' ) {
          cb( peer, request, accept, reject )
            .catch( err => {
              logger.error( 'request failed:%o', err )
              reject( err )
            })
        } else {
          this._handleProtooRequest( peer, request, accept, reject )
            .catch( err => {
              logger.error( 'request failed:%o', err )
              reject( err )
            })
        }
      })

      peer.on('close', () => {
        if( this._closed ) return

        logger.debug('protoo Peer "close" event [peerId:%s]', peer.id )

        this._studio.deletePeer( peer.id )

        this._studio.deleteParticipantsByPeerId( peer.id )

        if( peer.data.joined ) {
          for( const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
            otherPeer.notify('peerClosed', {peerId: peer.id })
              .catch(() => {})
            otherPeer.notify('studioLayoutUpdated', this._studio.layout )
              .catch(() => {})
            otherPeer.notify('studioParticipantsUpdated', this._studio.participants )
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

  /**
   * get router rtp capabilities
   * 
   * @method Room#getRouterCapabilities
   * @returns {object} - rtp capabilities
   * 
   */
  getRouterCapabilities() {
    return this._mediasoupRouter.rtpCapabilities
  }

  /**
   * add reaction
   * 
   * @method Room#addReaction
   * @param {number} reactionId 
   * 
   */
  addReaction( reactionId ) {
    this._reactionManager.add( reactionId )
  }

  /**
   * set routing
   * 
   * @method Room#do
   * @param {string} name 
   * @param {function} callback 
   */
  do( name, callback ) {
    this._routings.set( name, callback )
  }

  /**
   * broadcast message to peers
   * 
   * @method Room#broadcast
   * @param {string} message 
   * @param {object} data 
   */
  broadcast( message, data ) {
    if( 
      !!message && typeof message === 'string ' &&
      !!data && typeof data === 'object'
    ) {
      for( const peer of this._getJoinedPeers() ) {
        peer.notify( message, data )
          .catch( () => {} )
      }
    }
  }

  /**
   * private: handle audio level observer
   * 
   * @private
   * @method Room#_handleAudioLevelObserver
   * @listens audioLevelObserver#volumes
   * @listens audioLevelObserver#silence
   * @fires peer.notify#activeSpeaker
   * 
   */
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

  /**
   * set generic routing
   * 
   * @private
   */
  _setGenericRouting() {
    this.do('getRouterRtpCapabilities', async ( peer, request, accept, reject ) => {
      accept( this.getRouterCapabilities() )
    })

    this.do('join', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'changeDisplayName', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'applyNetworkThrottle', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'resetNetworkThrottle', async ( peer, request, accept, reject ) => {
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
    })
  }

  /**
   * set WebRTC transport routing
   * 
   * @private
   */
  _setWebRtcTransportRouting() {
    this.do('createWebRtcTransport', async ( peer, request, accept, reject ) => {
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

      const {
        iceServers, iceTransportPolicy
      } = config.mediasoup
      accept( {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
        iceServers,
        iceTransportPolicy
      })

      const { maxIncomingBitrate } = config.mediasoup.webRtcTransportOptions

      if( maxIncomingBitrate ) {
        try {
          await transport.setMaxIncomingBitrate( maxIncomingBitrate )
        } catch(err ) {}
      }
    })

    this.do('connectWebRtcTransport', async ( peer, request, accept, reject ) => {
      const { transportId, dtlsParameters } = request.data
      const transport = peer.data.transports.get( transportId )

      if( !transport ) {
        throw new Error( `transport with id "${transportId}" not found`)
      }

      await transport.connect({ dtlsParameters })

      accept()
    })

    this.do( 'restartIce', async ( peer, request, accept, reject ) => {
      const { transportId } = request.data
      const transport = peer.data.transports.get( transportId )

      if( !transport ) {
        throw new Error( `transport with id "${transportId}" not found`)
      }

      const iceParameters = await transport.restartIce()

      accept( iceParameters )
    })
  }

  /**
   * set producer routing
   * 
   * @private
   */
  _setProducerRouting() {
    this.do('produce', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'closeProducer', async ( peer, request, accept, reject ) => {
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
      logger.info('producerId:%o', producerId )
      accept()
    })
  
    this.do( 'pauseProducer', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'resumeProducer', async ( peer, request, accept, reject ) => {
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
    })
  }

  /**
   * set consumer routing
   * 
   * @private
   */
  _setConsumerRouting() {
    this.do( 'pauseConsumer', async ( peer, request, accept, reject ) => {
      if( !peer.data.joined ) {
        throw new Error( 'Peer not yet joined' )
      }

      const { consumerId } = request.data

      logger.info('pauseConsumer:%s', consumerId)
      const consumer = peer.data.consumers.get( consumerId )

      if ( !consumer ) {
        throw new Error( `consumer with id "${consumerId}" not found` )
      }

      await consumer.pause()

      accept()
    })

    this.do( 'resumeConsumer', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'setConsumerPriority', async ( peer, request, accept, reject ) => {
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
    })

    this.do( 'requestConsumerKeyFrame', async ( peer, request, accept, reject ) => {
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
    })
  }

  /**
   * set layer routing
   * 
   * @private
   */
  _setLayerRouting() {
    this.do( 'getPreferredLayers', async ( peer, request, accept, reject ) => {
      if( !peer.data.joined ) {
        throw new Error( 'Peer not yet joined' )
      }

      const { consumerId } = request.data
      const consumer = peer.data.consumers.get( consumerId )

      if( !consumer ) {
        throw new Error( `consumer with id "${consumerId}" not found`)
      }

      accept( consumer.preferredLayers )
    })

    this.do( 'getCurrentLayers', async( peer, request, accept, reject ) => {
      if( !peer.data.joined ) {
        throw new Error( 'Peer not yet joined' )
      }

      const { consumerId } = request.data
      const consumer = peer.data.consumers.get( consumerId )

      if( !consumer ) {
        throw new Error( `consumer with id "${consumerId}" not found`)
      }

      accept( consumer.currentLayers )
    })

    this.do( 'setPreferredLayers', async ( peer, request, accept, reject ) => {
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
    })
  }

  /**
   * set data routing
   * 
   * @private
   * 
   */
  _setDataRouting() {
    this.do( 'produceData', async ( peer, request, accept, reject ) => {
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
    })
  }

  /**
   * set routing for studio
   * 
   * @private
   * @method Room#_setStudioRouting
   * 
   */
  _setStudioRouting() {
    this.do( 'getStudioSize', async ( peer, request, accept, reject ) => {
      accept( {
        width: this._studio.width,
        height: this._studio.height
      } )
    })

    this.do( 'getStudioPatterns', async ( peer, request, accept, reject ) => {
      accept( this._studio.patterns )
    })

    this.do( 'getStudioPatternId', async ( peer, request, accept, reject ) => {
      accept({ patternId: this._studio.patternId })
    })

    this.do( 'setStudioPatternId', async ( peer, request, accept, reject ) => {
      const { patternId } = request.data
      logger.info( 'setStudioPatternId:%d', patternId )
      this._studio.patternId = patternId
      this._studio.calcLayout()
      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioLayoutUpdated', this._studio.layout )
          .catch( () => {} )
        peer.notify( 'studioPatternIdUpdated', { patternId: this._studio.patternId } )
          .catch( () => {} )
      }
    })

    this.do( 'getStudioLayout', async ( peer, request, accept, reject ) => {
      accept( this._studio.layout )
    })

    this.do( 'addStudioLayout', async ( peer, request, accept, reject ) => {
      const { peerId, audioProducerId, videoProducerId, mediaId, videoWidth, videoHeight } = request.data
      logger.info('"addStudioLayout" - request.data:%o', request.data )

      await this._studio.addMedia({ peerId, videoHeight, videoWidth, mediaId, audioProducerId, videoProducerId })

      accept()
      logger.info('this._studio.layout:%o', this._studio.layout )

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioLayoutUpdated', this._studio.layout )
          .catch( () => {} )
      }
    })

    this.do( 'toMainInStudioLayout', async ( peer, request, accept, reject ) => {
      const { layoutIdx } = request.data
      this._studio.toMain( layoutIdx )

      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioLayoutUpdated', this._studio.layout )
          .catch( () => {} )
      }
    })

    this.do( 'deleteStudioLayout', async ( peer, request, accept, reject ) => {
      const { peerId, audioProducerId, videoProducerId, mediaId } = request.data
      logger.info('"deleteStudioLayout" - request.data:%o', request.data )

      this._studio.deleteMedia({ peerId, audioProducerId, videoProducerId, mediaId })

      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioLayoutUpdated', this._studio.layout )
          .catch( () => {} )
      }
    })
  }

  /**
   * set routing for participant
   * these are used for synchronizing audio and video conditions
   * of participants
   * 
   * @private
   * @method Room#_setParticipantRouting
   * 
   */
  _setParticipantRouting() {
    this.do( 'getStudioParticipants', async ( peer, request, accept, reject ) => {
      accept( this._studio.participants )
    })

    this.do( 'addParticipant', async ( peer, request, accept, reject ) => {
      const { peerId, mediaId, displayName, audio, video } = request.data
      logger.info('"addParticipant" - request.data:%o', request.data )

      this._studio.addParticipant({ peerId, mediaId, displayName, audio, video })

      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioParticipantsUpdated', this._studio.participants )
          .catch( () => {} )
      }
    })

    this.do( 'updateParticipantAudio', async ( peer, request, accept, reject ) => {
      const { mediaId, audio } = request.data
      logger.info('"updateParticipantAudio" - request.data:%o', request.data )

      this._studio.updateParticipantAudio( mediaId, audio )

      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioParticipantsUpdated', this._studio.participants )
          .catch( () => {} )
      }
    })

    this.do( 'updateParticipantVideo', async ( peer, request, accept, reject ) => {
      const { mediaId, video } = request.data
      logger.info('"updateParticipantVideo" - request.data:%o', request.data )

      this._studio.updateParticipantVideo( mediaId, video )

      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioParticipantsUpdated', this._studio.participants )
          .catch( () => {} )
      }
    })

    this.do( 'deleteParticipantByMediaId', async ( peer, request, accept, reject ) => {
      const { mediaId } = request.data
      logger.info('"deleteParticipantByMediaId" - request.data:%o', request.data )

      this._studio.deleteParticipantByMediaId( mediaId )

      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'studioParticipantsUpdated', this._studio.participants )
          .catch( () => {} )
      }
    })
  }

  /**
   * set routing for caption
   * 
   * @private
   * @method Room#_setCaptionRouting
   */
  _setCaptionRouting() {
    this.do( 'getCaption', async ( peer, request, accept, reject ) => {
      accept({ caption: this._caption })
    })

    this.do( 'setCaption', async ( peer, request, accept, reject ) => {
      const { caption } = request.data
      this._caption = caption
      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'setCaption', { caption } )
          .catch( () => {} )
      }
    })
  }

  /**
   * set routing for cover image
   * 
   * @private
   * @method Room#_setCoverRouting
   * 
   */
  _setCoverRouting() {
    this.do( 'setCoverUrl', async ( peer, request, accept, reject ) => {
      const { coverUrl } = request.data

      this._studio.coverUrl = coverUrl
      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'setCoverUrl', { coverUrl: this._studio.coverUrl })
          .catch( () => {} )
      }
    })

    this.do( 'getCoverUrl', async ( peer, request, accept, reject ) => {
      logger.info('getCoverUrl: %s', this._studio.coverUrl )
      accept({ coverUrl: this._studio.coverUrl})
    })
  }

  /**
   * set routing for background image
   * 
   * @private
   * @method Room#_setBackgroundRouting
   * 
   */
  _setBackgroundRouting() {
    this.do( 'setBackgroundUrl', async ( peer, request, accept, reject ) => {
      const { backgroundUrl } = request.data

      this._studio.backgroundUrl = backgroundUrl
      accept()

      for( const peer of this._getJoinedPeers() ) {
        peer.notify( 'setBackgroundUrl', { backgroundUrl: this._studio.backgroundUrl })
          .catch( () => {} )
      }
    })

    this.do( 'getBackgroundUrl', async ( peer, request, accept, reject ) => {
      logger.info('getBackgroundUrl: %s', this._studio.backgroundUrl )
      accept({ backgroundUrl: this._studio.backgroundUrl})
    })
  }

  /**
   * set routing for statistics
   * 
   * @private
   * @method Room#_setStatsRouting
   */
  _setStatsRouting() {
    this.do( 'getTransportStats', async ( peer, request, accept, reject ) => {
      const { transportId } = request.data
      const transport = peer.data.transports.get( transportId )

      if( !transport ) {
        throw new Error( `transport with id "${transportId}" not found`)
      }

      const stats = await transport.getStats()
      
      accept( stats )
    })

    this.do( 'getProducerStats', async ( peer, request, accept, reject ) => {
      const { producerId } = request.data
      const producer = peer.data.producers.get( producerId )

      if( !producer ) {
        throw new Error( `producer with id "${producerId}" not found` )
      }

      const stats = await producer.getStats()

      accept( stats )
    })

    this.do( 'getConsumerStats', async ( peer, request, accept, reject ) => {
      const { consumerId } = request.data
      const consumer = peer.data.consumers.get( consumerId )

      if( !consumer ) {
        throw new Error( `consumer with id "${consumerId}" not found`)
      }

      const stats = await consumer.getStats()

      accept( stats )
    })

    this.do( 'getDataProducerStats', async ( peer, request, accept, reject ) => {
      const { dataProducerId } = request.data
      const dataProducer = peer.data.dataProducers.get( dataProducerId )

      if( !dataProducer ) {
        throw new Error(`dataProducer with id "${dataProducerId}" not found`)
      }

      const stats = await dataProducer.getStats()

      accept( stats )
    })

    this.do( 'getDataConsumerStats', async ( peer, request, accept, reject ) => {
      const { dataConsumerId } = request.data
      const dataConsumer = peer.data.dataConsumers.get( dataConsumerId )

      if ( !dataConsumer ) {
        throw new Error( `dataConsumer with id "${dataConsumerId}" not found` )
      }

      const stats = await dataConsumer.getStats()

      accept( stats )
    })
  }

  /**
   * private - handle protoo request
   * setting for routing about protoo request
   * 
   * @private
   * @param {object} peer 
   * @param {object} request 
   * @param {object} accept 
   * @param {object} reject 
   * @returns {Promise<NULL>}
   */
  async _handleProtooRequest( peer, request, accept, reject ) {
    switch( request.method ) {
      default: {
        logger.error('unknown request method "%s"', request.method )

        reject( 500, `unknown request.method "${request.method}"` )
      }
    }
  }

  /**
   * get joined peers
   * 
   * @private
   * @method Room#_getJoinedPeers
   * @param {object} props 
   * @param {object} props.excludePeer
   * @returns {Array<Object>}
   */
  _getJoinedPeers({ excludePeer = undefined } = {} ) {
    return this._protooRoom.peers.filter( peer => (
      peer.data.joined && peer !== excludePeer 
    ))
  }

  /**
   * create consumer
   * 
   * @private
   * @method Room#_createConsumer
   * @param {object} props 
   * @param {object} props.consumerPeer
   * @param {object} props.producerPeer
   * @param {object} props.producer
   * @returns {Promise<NULL>}
   */
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

  /**
   * create data consumer
   * 
   * @private
   * @method Room#_createDataConsumer
   * @param {object} props 
   * @param {object} props.dataConsumerPeer
   * @param {object} [props.dataProducerPeer]
   * @param {object} props.dataProducer
   * @returns {Promise<NULL>}
   */
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