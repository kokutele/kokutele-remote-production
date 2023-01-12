const fs = require('fs')
const https = require('https')
const http = require('http')
const path = require('path')
const Hashids = require( 'hashids')
const express = require('express')
const cors = require('cors')
const StudioDB = require('../studio-db')
const Logger = require('../logger')

const { getGuestId, getRoomId } = require('../util')
const config = require('../../config')

const hashids = new Hashids()
const logger = new Logger('ApiServer')

/**
 * @class
 */
class ApiServer {
  /**
   * @type {Map<Object>}
   */
  _rooms = null

  /**
   * @type {StudioDB}
   */
  _studioDB = new StudioDB()

  /**
   * @type {Express}
   */
  _expressApp = null

  /**
   * @type {http.Server}
   */
  _httpServer = null

  /**
   * @type {boolean}
   */
  _useTls = false

  /**
   * 
   * @constructor
   * @param {object} props 
   * @param {Map<Object>} props.rooms
   * @param {StudioDB} props.studioDB
   * @param {boolean}  props.useTls
   */
  constructor( props ) {
    this._rooms = props.rooms
    this._useTls = props.useTls
  }

  /**
   * start
   * 
   * @method ApiServer#start
   * @returns {http.Server} 
   */
  async start() {
    await this._studioDB.start()
    this._createExpressApp()
    await this._runApiServer()
  }

  /**
   * @type {http.Server}
   */
  get httpServer() {
    return this._httpServer
  }

  _createExpressApp = () => {
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

    /////////////////////////////////////////////////
    // APIs for generating room, authentification
    /////////////////////////////////////////////////

    // generate random name for create roomId
    this._expressApp.get('/api/studio', ( req, res ) => {
      const roomId = hashids.encode(Date.now())
      logger.info('generated roomId:%s', roomId)
      res.json({ roomId })
    })

    this._expressApp.get('/api/studio/:roomId', async ( req, res, next ) => {
      // check auth is needed for req.roomId
      try {
        const roomId = await this._studioDB.findOrSetRoomName( req.params.roomId )
        const isAuthNeeded = await this._studioDB.isPasscodeExist( roomId )

        if( isAuthNeeded ) {
          res.status( 401 ).send('unauthenticated')
        } else {
          res.status( 200 ).send('ok')
        }
      } catch(err) {
        next( err )
      }
    })

    this._expressApp.post('/api/studio/:roomId', async ( req, res, next ) => {
      const { passcode } = req.body

      try {
        const result = await this._studioDB.challengePasscode({ roomName: req.roomId, passcode })

        if( result ) {
          res.status(200).send('ok')
        } else {
          res.status(403).send('forbidden')
        }
      } catch( err ) {
        next( err )
      }
    })

    this._expressApp.put('/api/studio/:roomId', async ( req, res, next ) => {
      try {
        const { passcode } = req.body
        await this._studioDB.setPasscode({ roomName: req.roomId, passcode })

        res.status(201).send('accepted')
      } catch( err ) {
        next( err )
      }
    })

    /////////////////////////////////////////////////
    // APIs for Covers ( no update)
    /////////////////////////////////////////////////

    // getter - GET /api/studio/:roomId/covers
    this._expressApp.get('/api/studio/:roomId/covers', async ( req, res, next ) => {
      const roomName = req.params.roomId

      try {
        const result = await this._studioDB.getCoverUrls( roomName )

        if( result ) {
          res.status( 200 ).send( result )
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    // setter - POST /api/studio/:roomId/covers
    this._expressApp.post('/api/studio/:roomId/covers', async ( req, res, next ) => {
      const roomName = req.params.roomId
      const { url } = req.body
      logger.info('POST covers - %s, %s', roomName, url)

      if( !roomName || !url ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
        return
      }

      try {
        const result = await this._studioDB.setCoverUrl({ roomName, url })

        if( result ) {
          res.status( 200 ).send( result )

          if( req.room ) {
            const coverUrls = await this._studioDB.getCoverUrls( roomName )
            req.room.broadcast( 'updatedCoverUrls', coverUrls )
          }
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch(err) {
        next( err )
      }
    })

    // delete - DELETE /api/studio/:roomId/covers
    this._expressApp.delete('/api/studio/:roomId/covers', async ( req, res, next ) => {
      const roomName = req.params.roomId
      const { id } = req.body
      logger.info('DELETE covers - %s, %s', roomName, id)

      if( !roomName || !id ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
        return
      }

      try {
        const result = await this._studioDB.deleteCoverUrl({ roomName, id })

        if( result ) {
          res.status( 200 ).send( result )

          if( req.room ) {
            const coverUrls = await this._studioDB.getCoverUrls( roomName )
            req.room.broadcast( 'updatedCoverUrls', coverUrls )
          }
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    /////////////////////////////////////////////////
    // APIs for Backgrounds ( no update)
    /////////////////////////////////////////////////

    // getter - GET /api/studio/:roomId/backgrounds
    this._expressApp.get('/api/studio/:roomId/backgrounds', async ( req, res, next ) => {
      const roomName = req.params.roomId

      try {
        const result = await this._studioDB.getBackgroundUrls( roomName )

        if( result ) {
          res.status( 200 ).send( result )
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    // setter - POST /api/studio/:roomId/covers
    this._expressApp.post('/api/studio/:roomId/backgrounds', async ( req, res, next ) => {
      const roomName = req.params.roomId
      const { url } = req.body
      logger.info('POST backgrounds - %s, %s', roomName, url)

      if( !roomName || !url ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
        return
      }

      try {
        const result = await this._studioDB.setBackgroundUrl({ roomName, url })

        if( result ) {
          res.status( 200 ).send( result )

          if( req.room ) {
            const backgroundUrls = await this._studioDB.getBackgroundUrls( roomName )
            req.room.broadcast( 'updatedBackgroundUrls', backgroundUrls )
          }
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    // delete - DELETE /api/studio/:roomId/covers
    this._expressApp.delete('/api/studio/:roomId/backgrounds', async ( req, res, next ) => {
      const roomName = req.params.roomId
      const { id } = req.body
      logger.info('DELETE backgrounds - %s, %s', roomName, id)

      if( !roomName || !id ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
        return
      }

      try {
        const result = await this._studioDB.deleteBackgroundUrl({ roomName, id })

        if( result ) {
          res.status( 200 ).send( result )

          if( req.room ) {
            const backgroundUrls = await this._studioDB.getBackgroundUrls( roomName )
            req.room.broadcast( 'updatedBackgroundUrls', backgroundUrls )
          }
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    /////////////////////////////////////////////////
    // APIs for Captions ( no update)
    /////////////////////////////////////////////////

    // getter - GET /api/studio/:roomId/captions
    this._expressApp.get('/api/studio/:roomId/captions', async ( req, res, next ) => {
      const roomName = req.params.roomId

      try {
        const result = await this._studioDB.getCaptions( roomName )

        if( result ) {
          res.status( 200 ).send( result )
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    // setter - POST /api/studio/:roomId/captions
    this._expressApp.post('/api/studio/:roomId/captions', async ( req, res, next ) => {
      const roomName = req.params.roomId
      const { caption } = req.body
      logger.info('POST captions - %s, %s, %o', roomName, caption, req.body )

      if( !roomName || !caption ) {
        res.status( 400 ).send('Both roomName and caption MUST be specified.')
        return
      }

      try {
        const result = await this._studioDB.addCaption({ roomName, caption })

        if( result ) {
          res.status( 200 ).send( result )

          if( req.room ) {
            const captions = await this._studioDB.getCaptions( roomName )
            req.room.broadcast( 'updatedCaptions', captions )
          }
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })

    // delete - DELETE /api/studio/:roomId/captions
    this._expressApp.delete('/api/studio/:roomId/captions', async ( req, res, next ) => {
      const roomName = req.params.roomId
      const { id } = req.body
      logger.info('DELETE captions - %s, %s', roomName, id)

      if( !roomName || !id ) {
        res.status( 400 ).send('Both roomName and url MUST be specified.')
        return 
      }

      try {
        const result = await this._studioDB.deleteCaption({ roomName, id })

        if( result ) {
          res.status( 200 ).send( result )

          if( req.room ) {
            const captions = await this._studioDB.getCaptions( roomName )
            req.room.broadcast( 'updatedCaptions', captions )
          }
        } else {
          res.status( 404 ).send('Not found')
        }
      } catch( err ) {
        next( err )
      }
    })



    ///////////////////////////////////////////////////////////////
    // APIs for reaction
    ///////////////////////////////////////////////////////////////
    this._expressApp.post('/api/reaction/:roomId', ( req, res, next ) => {
      try {
        req.room.addReaction(0)
        res.status(201).send('accepted')
      } catch( err ) {
        next( err )
      }
    })

    this._expressApp.get('/api/reaction/:roomId', ( req, res, next ) => {
      try {
        const numReaction = req.room.numReaction
        res.status(200).json(numReaction)
      } catch( err ) {
        next( err )
      }
    })


    ///////////////////////////////////////////////////////////////
    // APIs for ids, capabilities
    ///////////////////////////////////////////////////////////////
    this._expressApp.get('/api/guestId/:roomId', ( req, res, next ) => {
      try {
        const guestId = getGuestId( req.roomId )
        res.status(200).send( guestId )
      } catch( err ) {
        next( err )
      }
    })

    this._expressApp.get('/api/roomId/:guestId', ( req, res, next ) => {
      const guestId = req.params.guestId
      try {
        const roomId = getRoomId( guestId )
        res.status(200).send( roomId )
      } catch( err ) {
        next( err )
      }
    })

    this._expressApp.get('/rooms/:roomId', ( req, res, next ) => {
      if( req.room ) {
        const data = req.room.getRouterRtpCapabilities()
        res.status( 200 ).json( data )
      } else {
        const error = new Error( `room with id "${roomId}" not found` )
        error.status = 404

        next( error )
      }
    })

    ///////////////////////////////////////////////////////////////
    // Error handling for APIs
    ///////////////////////////////////////////////////////////////
    this._expressApp.use( ( error, req, res, next ) => {
      if( error ) {
        logger.warn('Express app %s', String( error ))
        error.status = error.status || ( error.name === 'TypeError' ? 400 : 500 ) 
        res.statusMessage = error.message
        res.status( error.status ).send( String( error ) )
      } else {
        next()
      }
    })
  }

  _runApiServer = async () => {
    if( this._useTls ) {
      const tls = {
        cert: fs.readFileSync( config.api.tls.cert ),
        key : fs.readFileSync( config.api.tls.key )
      }

      this._httpServer = https.createServer( tls, this._expressApp )
    } else {
      this._httpServer = http.createServer( this._expressApp )
    }

    await new Promise( (resolve) => {
      const port = Number( config.api.listenPort )
      this._httpServer.listen( port, config.api.listenIp, () => {
        logger.info( 'API server running on port - %d', port )
        resolve()
      } )
    })
  }
}

module.exports = ApiServer