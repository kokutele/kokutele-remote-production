process.env.DEBUG = process.env.DEBUG || '*INFO* *WARN* *ERROR*'

const fs = require('fs')
const https = require('https')
const http = require('http')
const url = require('url')
const Hashids = require( 'hashids')
const protoo = require('protoo-server')
const mediasoup = require('mediasoup')
const express = require('express')
const cors = require('cors')
const { AwaitQueue } = require('awaitqueue')
const Logger = require('../logger')
const Room = require('./room')

const config = require('../../config')

const logger = new Logger()
const useTls = false

const hashids = new Hashids()

class Server {
  _queue = new AwaitQueue()
  _rooms = new Map()
  _apiServer = null
  _expressApp = null
  _protooWebSocketServer = null
  _mediasoupWorkers = []
  _nextMediasoupWorkerIdx = 0

  static create() {
    return new this()
  }

  start = async () => {
    await this._runMediasourpWorkers()

    this._createExpressApp()

    await this._runApiServer()

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

      // setInterval( async () => {
      //   const usage = await worker.getResourceUsage()
      //   logger.info( 'mediasoup Worker resource usage[pid: %d] %o', worker.pid, usage )
      // }, 120_000 )
    }
  }

  _createExpressApp() {
    this._expressApp = express()
    this._expressApp.use( express.json() )
    this._expressApp.use( cors() )

    const publicDir = __dirname + '/../../webapp/build'
    logger.info( 'publicDir:%s', publicDir )
    this._expressApp.use( express.static( publicDir ))

    this._expressApp.param( 'roomId', ( req, res, next, roomId ) => {
      if( !this._rooms.has( roomId ) ) {
        const error = new Error( `room with id "${roomId}" not found` )
        error.status = 404
        throw error
      } else {
        req.room = rooms.get( roomId )
        next()
      }
    })

    this._expressApp.get('/api/studio', ( req, res ) => {
      const name = hashids.encode(Date.now())
      logger.info('name:%s', name)
      res.json({ name })
    })

    this._expressApp.get('/rooms/:roomId', ( req, res ) => {
      const data = req.room.getRouterRtpCapabilities()
      res.status( 200 ).json( data )
    })

    this._expressApp.use( ( error, req, res, next ) => {
      if( error ) {
        logger.warn('Expres app %s', String( error ))
        error.status = error.status || ( error.name === 'TypeError' ? 400 : 500 ) 
        res.statusMessage = error.message
        res.status( error.status ).send( String( error ) )
      } else {
        next()
      }
    })
  }

  _runApiServer = async () => {
    if( useTls ) {
      const tls = {
        cert: fs.readFileSync( config.api.tls.cert ),
        key : fs.readFileSync( config.api.tls.key )
      }

      this._apiServer = https.createServer( tls, this._expressApp )
    } else {
      this._apiServer = http.createServer( this._expressApp )
    }

    await new Promise( (resolve) => {
      const port = Number( config.api.listenPort )
      this._apiServer.listen( port, config.api.listenIp, () => {
        logger.info( 'API server running on port - %d', port )
        resolve()
      } )
    })
  }

  _runProtooWebSocketServer() {
    this._protooWebSocketServer = new protoo.WebSocketServer( this._apiServer, {
      maxReceivedFrameSize    : 960_000,
      maxReceivedMessageSize  : 960_000,
      fragmentOutgoingMessages: true,
      fragmentationThreshold  : 960_000
    })

    this._protooWebSocketServer.on('connectionrequest', ( info, accept, reject ) => {
      const u = url.parse( info.request.url, true )
      const roomId = u.query['roomId']
      const peerId = u.query['peerId']

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