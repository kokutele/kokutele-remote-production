process.env.DEBUG = process.env.DEBUG || '*INFO* *WARN* *ERROR*'

const fs = require('fs')
const https = require('https')
const http = require('http')
const path = require('path')
const url = require('url')
const Hashids = require( 'hashids')
const protoo = require('protoo-server')
const mediasoup = require('mediasoup')
const express = require('express')
const cors = require('cors')
const { AwaitQueue } = require('awaitqueue')
const Room = require('./room')
const StudioDB = require('../studio-db')
const exporter = require('../observer/exporter')
const Logger = require('../logger')

const { getGuestId, getRoomId } = require('../util')

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
  _studioDB = new StudioDB()

  static create() {
    return new this()
  }

  start = async () => {
    await this._studioDB.start()

    await exporter({ port: 4000 })

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

    this._expressApp.use( express.static( path.join( __dirname, "..", "..", "webapp", "build") ))
    this._expressApp.use((req, res, next) => {
      if( req.url.includes("/virtual-studio") || req.url.includes("/viewer") || req.url.includes("/guest-room") ) {
        res.sendFile( path.join( __dirname, "..", "..", "webapp", "build", "index.html" ) )
      } else {
        next()
      }
    })

    this._expressApp.param( 'roomId', ( req, res, next, roomId ) => {
      req.roomId = roomId
      req.room = this._rooms.get( roomId )
      next()
    })

    // generate random name for create room
    this._expressApp.get('/api/studio', ( req, res ) => {
      const name = hashids.encode(Date.now())
      logger.info('name:%s', name)
      res.json({ name })
    })

    this._expressApp.get('/api/studio/:roomId', async ( req, res ) => {
      // check auth is needed for req.roomId
      const roomId = await this._studioDB.findOrSetRoomName( req.roomId )
      const isAuthNeeded = await this._studioDB.isPasscodeExist( roomId )

      if( isAuthNeeded ) {
        res.status( 401 ).send('unauthenticated')
      } else {
        res.status( 200 ).send('ok')
      }
    })

    this._expressApp.post('/api/studio/:roomId', async ( req, res ) => {
      const { passcode } = req.body
      const result = await this._studioDB.challengePasscode({ roomName: req.roomId, passcode })

      if( result ) {
        res.status(200).send('ok')
      } else {
        res.status(403).send('forbidden')
      }
    })

    this._expressApp.get('/api/studio/:roomId/covers', async ( req, res ) => {
      const roomName = req.params.roomId

      const result = await this._studioDB.getCoverUrls( roomName )

      if( result ) {
        res.status( 200 ).send( result )
      } else {
        res.status( 404 ).send('Not found')
      }
    })

    this._expressApp.post('/api/studio/:roomId/covers', async ( req, res ) => {
      const roomName = req.params.roomId
      const { url } = req.body
      logger.info('POST covers - %s, %s', roomName, url)

      if( !roomName || !url ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
      }

      const result = await this._studioDB.setCoverUrl({ roomName, url })

      if( result ) {
        res.status( 200 ).send( result )
      } else {
        res.status( 404 ).send('Not found')
      }
    })

    this._expressApp.delete('/api/studio/:roomId/covers', async ( req, res ) => {
      const roomName = req.params.roomId
      const { id } = req.body
      logger.info('DELETE covers - %s, %s', roomName, id)

      if( !roomName || !id ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
      }

      const result = await this._studioDB.deleteCoverUrl({ roomName, id })

      if( result ) {
        res.status( 200 ).send( result )
      } else {
        res.status( 404 ).send('Not found')
      }
    })



    this._expressApp.put('/api/studio/:roomId', async ( req, res ) => {
      try {
        const { passcode } = req.body
        await this._studioDB.setPasscode({ roomName: req.roomId, passcode })

        res.status(201).send('accepted')
      } catch( err ) {
        res.status( err.status || 500 ).send( err.message )
      }
    })

    this._expressApp.post('/api/reaction/:roomId', ( req, res ) => {
      req.room.addReaction(0)
      res.status(201).send('accepted')
    })

    this._expressApp.get('/api/reaction/:roomId', ( req, res ) => {
      const numReaction = req.room.numReaction
      res.status(200).json(numReaction)
    })



    this._expressApp.get('/api/guestId/:roomId', ( req, res ) => {
      const guestId = getGuestId( req.roomId )
      res.status(200).send( guestId )
    })

    this._expressApp.get('/api/roomId/:guestId', ( req, res ) => {
      const guestId = req.params.guestId
      const roomId = getRoomId( guestId )
      res.status(200).send( roomId )
    })

    this._expressApp.get('/rooms/:roomId', ( req, res ) => {
      if( req.room ) {
        const data = req.room.getRouterRtpCapabilities()
        res.status( 200 ).json( data )
      } else {
        const error = new Error( `room with id "${roomId}" not found` )
        error.status = 404

        throw error
      }
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