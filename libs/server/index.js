process.env.DEBUG = process.env.DEBUG || '*INFO* *WARN* *ERROR*'

const url = require('url')
const protoo = require('protoo-server')
const mediasoup = require('mediasoup')
const { AwaitQueue } = require('awaitqueue')
const Room = require('./room')
const ApiServer = require('./api-server') 
const exporter = require('../observer/exporter')
const Logger = require('../logger')

const { getGuestId, getRoomId } = require('../util')

const config = require('../../config')

const logger = new Logger()
const useTls = false


class Server {
  _queue = new AwaitQueue()
  _rooms = new Map()
  _apiServer = null
  _protooWebSocketServer = null
  _mediasoupWorkers = []
  _nextMediasoupWorkerIdx = 0

  static create() {
    return new this()
  }

  start = async () => {
    await exporter({ port: 4000 })

    await this._runMediasourpWorkers()

    this._apiServer = new ApiServer({
      rooms: this._rooms,
      useTls
    })

    await this._apiServer.start()

    this._runProtooWebSocketServer()

    setInterval( () => {
      for( const room of this._rooms.values() ) {
        room.logStatus()
      }
    }, 120_000 )
  }

  _runMediasourpWorkers = async () => {
    const { numWorkers } = config.mediasoup

    logger.info( 'executes %d mediasoup workers...', numWorkers )

    for( let i = 0; i < numWorkers; i++ ) {
      const worker = await mediasoup.createWorker({
        logLevel  : config.mediasoup.workerSettings.logLevel,
        logTags   : config.mediasoup.workerSettings.logTags,
        rtcMinPort: Number( config.mediasoup.workerSettings.rtcMinPort ),
        rtcMaxPort: Number( config.mediasoup.workerSettings.rtcMaxPort ),
      })

      worker.on( 'died', () => {
        logger.error( 'mediasoup Worker died, exiting in 2 seconds... [pid:%d]', worker.pid )
        setTimeout( () => process.exit(1), 2_000 )
      })

      this._mediasoupWorkers.push( worker )
    }
  }

  _runProtooWebSocketServer() {
    this._protooWebSocketServer = new protoo.WebSocketServer( this._apiServer.httpServer, {
      maxReceivedFrameSize    : 960_000,
      maxReceivedMessageSize  : 960_000,
      fragmentOutgoingMessages: true,
      fragmentationThreshold  : 960_000
    })

    this._protooWebSocketServer.on('connectionrequest', ( info, accept, reject ) => {
      logger.info('connectionRequest:%s', info.request.url )
      const u = url.parse( info.request.url, true )
      logger.info(u)
      const roomId = u.query['roomId']
      const peerId = u.query['peerId']
      logger.info('roomId:%s, peerId:%s', roomId, peerId )

      if( !roomId || !peerId ) {
        reject( 400, 'Connection request MUST specify roomId and/or peerId' )
        return
      }

      logger.info(
        'protoo connection request [roomId:%s, peerId:%s, address:%s, origin:%s]',
        roomId, peerId, info.socket.remoteAddress, info.origin
      )

      this._queue.push( async () => {
        const room = await this._getOrCreateRoom( { roomId } )
        const protooWebSocketTransport = accept()
        room.handleProtooConnection({ peerId, protooWebSocketTransport })
      }).catch( error => {
        logger.error( 'room creation or joining failed: %o', error )
        reject( error )
      })
    })
    logger.info("setup of protooWebSocketServer finished.")
  }

  _getMediasoupWorker() {
    const worker = this._mediasoupWorkers[ this._nextMediasoupWorkerIdx ]

    if( ++this._nextMediasoupWorkerIdx === this._mediasoupWorkers.length ) {
      this._nextMediasoupWorkerIdx = 0
    }

    return worker
  }

  _getOrCreateRoom = async ( { roomId } ) => {
    let room = this._rooms.get( roomId )
    
    if( !room ) {
      logger.info( 'creates an new Room [roomId:%s]', roomId )

      const mediasoupWorker = this._getMediasoupWorker()

      room = await Room.create({ mediasoupWorker, roomId })

      this._rooms.set( roomId, room )

      room.on('close', () => this._rooms.delete( roomId ))
    }

    return room
  }
}



module.exports = Server