const EventEmitter = require('events').EventEmitter
const protoo = require('protoo-server')
const throttle = require('@sitespeed.io/throttle')

const Logger = require('../logger')
const config = require('../../config')

const logger = new Logger('Room')

class Room extends EventEmitter {
  static async create({ mediasoupWorker, roomId }) {
    logger.info( 'cretate() [roomId: %s]', roomId )

    const protooRoom = new protoo.Room()

    const { mediaCodecs } = config.mediasoup.routerOptions

    const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs })

    const audioLevelObserver = await mediasoupRouter.createAudioLevelObserver({
      maxEntries: 1,
      threshold : -80,
      interval  : 800
    })

    return new this( {
      roomId, protooRoom, mediasoupRouter, audioLevelObserver
    })
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

    this._handleAudioLevelObserver()
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

        if( peer.data.joined ) {
          for( const otherPeer of this._getJoinedPeers({ excludePeer: peer }) ) {
            otherPeer.notify('peerClosed', {peerId: peer.id })
              .catch(() => {})
          }
        }

        for( const transport of peer.data.transport.values()) {
          transport.close()
        }

        if( this._protooRoom.peers.length === 0 ) {
          logger.info(
            'last Peer in the room left, closing the room [roomId: %s]',
            this.close()
          )
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
    // todo - implement this.

  }

  async _handleProtooRequest( peer, request, accept, reject ) {
    // todo - implement this.

  }

  _getJoinedPeers({ excludePeer = undefined } = {} ) {
    return this._protooRoom.peers.filter( peer => peer.data.joined && peer !== excludePeer )
  }

  async _createConsumer({ consumerPeer, producerPeer, producer }) {
    // todo - implement this.

  }
}

module.exports = Room