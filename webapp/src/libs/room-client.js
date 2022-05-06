import protooClient from 'protoo-client'
import * as mediasoupClient from 'mediasoup-client'
import randomString from 'random-string'
import { v4 as uuidv4 } from 'uuid'
import deviceInfo from './device-info'
import { getProtooUrl } from './url-factory'
import Logger from './logger'

import EventEmitter from 'events'

const logger = new Logger('room-client')

const PC_PROPRIETARY_CONSTRAINTS = {
  optional: [ { googDscp: true } ]
}

const VIDEO_SIMULCAST_ENCODINGS = [
  { scaleResolutionDownBy: 4, maxBitrate: 500_000 },
  { scaleResolutionDownBy: 2, maxBitrate: 1_000_000 },
  { scaleResolutionDownBy: 1, maxBitrate: 5_000_000 }
]

// const SCREEN_SHARING_SIMULCAST_ENCODINGS = [
//   { dtx: true, maxBitrate: 1_500_000 },
//   { dtx: true, maxBitrate: 6_000_000 }
// ]

export default class RoomClient extends EventEmitter {
  /**
   * 
   * @param {Object} props
   * @param {String} props.displayName
   * @param {String} props.roomId
   * @returns {RoomClient}
   */
  static create( { displayName, roomId } ) {
    const peerId = randomString()
    const useSimulcast = false

    return new RoomClient( { peerId, roomId, displayName, useSimulcast })
  }

  constructor( props ) {
    super()

    this._peerId = props.peerId
    this._roomId = props.roomId
    this._displayName = props.displayName
    this._useSimulcast = props.useSimulcast
    this._protooUrl   = getProtooUrl( { roomId: this._roomId, peerId: this._peerId })

    this._device = deviceInfo()
    this._closed = false
    this._protoo = null
    this._sendTransport = null
    this._recvTransport = null
    this._consumers     = new Map()
    this._producers     = new Map()
    this._dataConsumers = new Map()  // needed?

    logger.debug( "protooUrl:%s", this._protooUrl )
  }

  get peerId() {
    return this._peerId
  }

  get consumers() {
    return this._consumers
  }

  get audioProducer() {
    return this._audioProducer
  }

  get videoProducer() {
    return this._videoProducer
  }

  join() {
    let promiseReturned = false

    return new Promise( ( resolve, reject ) => {
      const protooTransport = new protooClient.WebSocketTransport( this._protooUrl )

      this._protoo = new protooClient.Peer( protooTransport )

      this._protoo.on('open', async () => {
        logger.debug( 'established connection to "kokutele-studio" server' )
        this._closed = false

        await this._joinRoom()

        if( !promiseReturned ) {
          promiseReturned = true
          resolve()
        }
      })

      this._protoo.on('failed', () => {
        const mesg = 'failed to establish connection to "kokutele-studio" server'

        logger.warn( mesg )

        if( !promiseReturned ) {
          promiseReturned = true
          reject( new Error( mesg ) )
        }
      })

      this._protoo.on('disconnected', () => {
        logger.warn( 'disconnected to "kokutele-studio" server' )

        if( this._sendTransport ) {
          this._sendTransport.close()
          this._sendTransport = null
        }

        if( this._recvTransport ) {
          this._recvTransport.close()
          this._recvTransport = null
        }
      })

      this._protoo.on('close', () => {
        if( this._closed ) {
          return
        }
        this.close()
      })

      this._protoo.on('request', async ( request, accept, reject ) => {
        logger.debug( 
          'protoo "request" event [method:%s, data:%o]', request.method, request.data
        )
        switch( request.method ) {
          case 'newConsumer': {
            const {
              peerId,
              producerId,
              id,
              kind,
              rtpParameters,
              type,
              appData,
              producerPaused
            } = request.data

            try {
              const consumer = await this._recvTransport.consume( {
                id,
                producerId,
                kind,
                rtpParameters,
                appData: { ...appData, peerId }
              })

              this._consumers.set( consumer.id, consumer )

              consumer.on('transportclose', () => {
                this._consumers.delete( consumer.id )
                this.emit( "leaveConsumer", {
                  id: consumer.id,
                  kind: consumer.kind
                } )
              })

              this.emit("newConsumer", {
                peerId,
                producerId,
                id,
                kind,
                type,
                producerPaused,
                appData,
              })

              accept()
            } catch( err ) {
              logger.error('"newConsumer" request failed:%o', err )

              throw err
            }
            break
          }

          case 'newDataConsumer': {
            const {
              peerId,
              dataProducerId,
              id,
              sctpStreamParameters,
              label,
              protocol,
              appData
            } = request.data

            try {
              const dataConsumer = await this._recvTransport.consumeData({
                id,
                dataProducerId,
                sctpStreamParameters,
                label,
                protocol,
                appData: { ...appData, peerId }
              })

              this._dataConsumers.set( dataConsumer.id, dataConsumer )

              dataConsumer.on('transportclose', () => {
                this._dataConsumers.delete( dataConsumer.id )
              })

              dataConsumer.on('open', () => {
                logger.debug('DataConsumer "open" event')
              })

              dataConsumer.on('close', () => {
                logger.debug('DataConsumer "close" event')
                this._dataConsumers.delete( dataConsumer.id )
              })

              dataConsumer.on('error', err => {
                logger.error('DataConsumer "error" event:%o', err )
              })

              dataConsumer.on('message', mesg => {
                logger.debug(
                  'DatConsumer "message" event [streamId:%d]', 
                  dataConsumer.sctpStreamParameters.streamId
                )
                // todo - implement message handling for dataConsumer
              })

              accept()
            } catch( err ) {
              logger.error('"newDataConsumer" request failed:%o', err )

              throw err
            }
            break
          }
          default: {
            logger.error('unknown protoo request.method: "%s"', request.method )
          }
        }
      })

      this._protoo.on('notification', notification => {
        logger.debug(
          'protoo "notification" event [method: %s, data: %o]',
          notification.method, notification.data
        )
        switch( notification.method ) {
          case 'producerScore': {
            const { producerId, score } = notification.data
            this.emit('producerScore', { producerId, score })
            break
          }
          case 'newPeer': {
            const peer = notification.data
            this.emit('newPeer', peer )
            break
          }
          case 'peerClosed': {
            const { peerId } = notification.data
            this.emit('peerClosed', peerId )
            break
          }
          case 'peerDisplayNameChanged': {
            const { peerId, displayName, oldDisplayName } = notification.data
            this.emit('peerDisplayNameChanged', { peerId, displayName, oldDisplayName })
            break
          }
          case 'studioLayoutUpdated': {
            this.emit('studioLayoutUpdated', notification.data )
            break
          }
          case 'studioPatternIdUpdated': {
            this.emit('studioPatternIdUpdated', notification.data )
            break
          }
          case 'downlinkBwe': {
            logger.debug('"downlinkBwe" event:%o', notification.data)
            break
          }
          case 'consumerClosed': {
            const { consumerId } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            consumer.close()
            this._consumers.delete( consumerId )

            const { peerId } = consumer.appData

            this.emit('consumerClosed', { consumerId, peerId })

            break
          }
          case 'consumerPaused': {
            const { consumerId } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            consumer.pause()

            this.emit('consumerPaused', consumerId )

            break
          }
          case 'consumerResumed': {
            const { consumerId } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            consumer.resume()

            this.emit('consumerResumed', consumerId )

            break
          }
          case 'consumerLayersChanged': {
            const { consumerId, spatialLayer, temporalLayer } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            this.emit( 'consumerLayersChanged', { consumerId, spatialLayer, temporalLayer })

            break
          }
          case 'consumerScore': {
            const { consumerId, score } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            this.emit( 'consumerScore', { consumerId, score })

            break
          }
          case 'dataConsumerClosed': {
            const { dataConsumerId } = notification.data
            const dataConsumer = this._dataConsumers.get( dataConsumerId )

            if( !dataConsumer ) break

            dataConsumer.close()
            this._dataConsumers.delete( dataConsumerId )

            const  { peerId } = dataConsumer.appData

            this.emit( 'dataConsumerClosed', { dataConsumerId, peerId } )
            break
          }
          case 'activeSpeaker': {
            const { peerId } = notification.data

            this.emit( 'activeSpeaker', peerId )

            break
          }
          default: {
            logger.error('unknown protoo notification.method: "%s"', notification.method )
          }
        }
      })
    })
  }

  /**
   * create producer
   * 
   * @param {MediaStream} stream 
   * @return {Promise<Object>} - { audioProducerId:String, videoProducerId:String }
   */
  async createProducer( stream ) {
    if( !( stream instanceof MediaStream ) ) {
      throw new TypeError( 'createProducer - MediaStream object MUST set.' )
    }

    const mediaId = uuidv4()
    let audioProducer, videoProducer
    ////////////////////////////////////////////////////////////
    // Create producer for audio
    ////////////////////////////////////////////////////////////
    if( !this._mediasoupDevice.canProduce('audio') ) {
      logger.warn('cannot produce audio:%o', this._mediasoupDevice )
    } else {
      let track
      try {
        track = stream.getAudioTracks()[0]

        if( track ) {
          audioProducer = await this._sendTransport.produce( {
            track,
            codecOptions: {
              opusStereo: 1,
              opusDtx   : 1
            },
            appData: {
              mediaId
            }
          })
          logger.debug( "audioProducer.id: %s", audioProducer.id )

          audioProducer.on( 'transoprtclose', () => {
            this._producers.delete( audioProducer.id )
          })

          audioProducer.on( 'trackended', async () => {
            audioProducer.close()

            await this._protoo.request( 'closeProducer', {
              producerId: audioProducer.id
            })
            .then( () => {
              this._producers.delete( audioProducer.id ) 
            })
            .catch( err => {
              logger.error( 'Error while closing producer for audio' )
            })
          })

          this._producers.set( audioProducer.id, audioProducer )
        }
      } catch( err ) {
        logger.error('error while producing audio: %o', err )
        if( track ) track.stop()
      }
    }

    ////////////////////////////////////////////////////////////
    // Create producer for video
    ////////////////////////////////////////////////////////////
    if( !this._mediasoupDevice.canProduce('video') ) {
      logger.warn( 'cannot produce video:%o', this._mediasoupDevice )
    } else {
      let track

      try {
        track = stream.getVideoTracks()[0]

        const encodings = this._useSimulcast ? VIDEO_SIMULCAST_ENCODINGS : undefined
        const codecOptions = {
          videoGoogleStartBitrate: 1_000
        }

        videoProducer = await this._sendTransport.produce({
          track,
          encodings,
          codecOptions,
          appData: {
            mediaId
          }
        })
        logger.debug( 'videoProducerId:%s', videoProducer.id )

        videoProducer.on( 'transportclose', () => {
          this._producers.delete( videoProducer.id )
        })

        videoProducer.on( 'trackended', async () => {
          videoProducer.close()

          await this._protoo.request( 'closeProducer', {
            producerId: videoProducer.id
          })
          .then( () => {
            this._producers.delete( videoProducer.id )
          })
          .catch( err => {
            logger.error( 'Error closing video producer:%o', err )
          })
        })

        this._producers.set( videoProducer.id, videoProducer )
      } catch(err) {
        logger.error( 'error while prducing video:%o', err )
        if( track ) track.stop()
      }
    }

    return {
      audioProducerId: audioProducer ? audioProducer.id : null,
      videoProducerId: videoProducer ? videoProducer.id : null,
      mediaId
    }
  }

  async getStudioPatterns() {
    return await this._protoo.request( 'getStudioPatterns' )
      .catch( err => { throw err })
  }

  async getStudioPatternId() {
    return await this._protoo.request( 'getStudioPatternId' )
      .catch( err => { throw err })
  }

  async setStudioPatternId({ patternId }) {
    return await this._protoo.request( 'setStudioPatternId', { patternId } )
      .catch( err => { throw err })
  }

  async getStudioSize() {
    return await this._protoo.request( 'getStudioSize' )
      .catch( err => { throw err })
  }

  async getStudioLayout() {
    return await this._protoo.request( 'getStudioLayout' )
      .catch( err => { throw err })
  }

  async addStudioLayout( { peerId, mediaId, audioProducerId, videoProducerId, videoWidth, videoHeight } ) {
    await this._protoo.request( 'addStudioLayout', { peerId, mediaId, audioProducerId, videoProducerId, videoWidth, videoHeight } )
      .catch( err => { throw err })
  }

  async deleteStudioLayout( { peerId, mediaId, audioProducerId, videoProducerId } ) {
    await this._protoo.request( 'deleteStudioLayout', { peerId, mediaId, audioProducerId, videoProducerId } )
      .catch( err => { throw err })
  }

  async toMainInStudioLayout( layoutIdx ) {
    await this._protoo.request( 'toMainInStudioLayout', { layoutIdx } )
      .catch( err => { throw err })
  }

  async pauseConsumer( consumerId ) {
    await this._protoo.request( 'pauseConsumer', { consumerId })
      .catch( err => { throw err })
  }

  async resumeConsumer( consumerId ) {
    await this._protoo.request( 'resumeConsumer', { consumerId })
      .catch( err => { throw err })
  }



  close() {
    this._protoo.close()
    this._closed = true

    if (this._sendTransport) {
      this._sendTransport.close()
      this._sendTransport = null
    }

    if (this._recvTransport) {
      this._recvTransport.close()
      this._recvTransport = null
    }
  }

  async muteAudio() {
    // todo 
  }

  async unmuteAudio() {
    // todo
  }

  async starScreenShare() {
    // todo ( in mediasoup-demo, enableShare() )
  }

  async stopScreenShare() {
    // todo ( in mediasoup-demo, disableShare() )
  }

  async setMaxSendingSpatialLayer( spatialLayer ) {
    // todo
  }

  async setConsumerPreferredLayers( consumerId, spatialLayer, temporalLayer ) {
    // todo
  }

  async setConsumerPriority( consumerId, priority ) {
    // todo
  }

  async requestConsumerKeyFrame( consumerId ) {
    // todo
  }

  async changeDisplayName( dispalyName ) {
    // todo
  }

  async _joinRoom() {
    logger.debug('_joinRoom()')

    try {
      // create mediasoupDevice which includes browser info
      this._mediasoupDevice = new mediasoupClient.Device()
      logger.debug('"_joinRoom()" this._mediasoupDevice: %o', this._mediasoupDevice )

      // retrieve codec list to negotiate
      const routerRtpCapabilities = await this._protoo.request('getRouterRtpCapabilities')
      logger.debug('"_joinRoom()" routerRtpCapabilities: %o', routerRtpCapabilities )

      // load rtpCapbilities( codec list ) into mediasoupDevice
      await this._mediasoupDevice.load( { routerRtpCapabilities })

      ////////////////////////////////////////////////////////////
      // create mediasoup Transport for producer
      ////////////////////////////////////////////////////////////
      {
        const transportInfo = await this._protoo.request( 'createWebRtcTransport', {
          forceTcp        : false,
          producing       : true,
          consuming       : false,
          sctpCapabilities: this._mediasoupDevice.sctpCapabilities
        })

        const { 
          id, iceParameters, iceCandidates, dtlsParameters, sctpParameters 
        } = transportInfo

        logger.debug('create transport for producer' )
        logger.debug('  iceParameters : %o', iceParameters )
        logger.debug('  iceCandidates : %o', iceCandidates )
        logger.debug('  dtlsParameters: %o', dtlsParameters )
        logger.debug('  sctpParameters: %o', sctpParameters )
        

        this._sendTransport = this._mediasoupDevice.createSendTransport({
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters            : { ...dtlsParameters, role: 'auto' },
          sctpParameters,
          iceServers                : [],
          proprietaryConstraints    : PC_PROPRIETARY_CONSTRAINTS,
          additionalSettings        : {
            encodedInsertableStreams: false
          }
        })

        logger.debug('sendTransport created.')

        this._sendTransport.on( 'connect', ( { dtlsParameters }, callback, errback ) => {
          this._protoo.request( 'connectWebRtcTransport', {
              transportId: this._sendTransport.id,
              dtlsParameters
            })
            .then( obj => {
              logger.debug('sendTransport - connectted:%o', obj)
              callback( obj )
            })
            .catch( errback )
        })

        this._sendTransport.on( 'produce', ( { kind, rtpParameters, appData }, callback, errback ) => {
          this._protoo.request( 'produce', {
            transportId: this._sendTransport.id,
            kind,
            rtpParameters,
            appData
          })
          .then( ({ id }) => {
            logger.debug( 'sendTransport - produce:%s', id )
            callback({ id }) 
          })
          .catch( errback )
        })

        this._sendTransport.on( 'producedata', ( { sctpStreamParameters, label, protocol, appData }, callback, errback ) => {
          this._protoo.request( 'produceData', {
            transportId: this._sendTransport.id,
            sctpStreamParameters,
            label,
            protocol,
            appData
          })
          .then( ({ id }) => callback( { id } ) )
          .catch( errback )
        })
      }

      ////////////////////////////////////////////////////////////
      // create mediasoup Transport for consumer
      ////////////////////////////////////////////////////////////
      {
        const transportInfo = await this._protoo.request( 'createWebRtcTransport', {
          forceTcp        : false,
          producing       : false,
          consuming       : true,
          sctpCapabilities: this._mediasoupDevice.sctpCapabilities
        })

        const {
          id, iceParameters, iceCandidates, dtlsParameters, sctpParameters
        } = transportInfo

        this._recvTransport = this._mediasoupDevice.createRecvTransport( {
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters: { ...dtlsParameters, role: 'auto' },
          sctpParameters,
          iceServers: [],
          additionalSettings: {
            encodedInsertableStreams: false
          }
        })

        this._recvTransport.on( 'connect', ( { dtlsParameters }, callback, errback ) => {
          this._protoo.request( 'connectWebRtcTransport', {
            transportId: this._recvTransport.id,
            dtlsParameters
          })
          .then( callback )
          .catch( errback)
        })
      }

      ////////////////////////////////////////////////////////////
      // Join into the room.
      ////////////////////////////////////////////////////////////
      logger.debug("attempt to join into the room:%o", this._mediasoupDevice)
      {
        const { peers } = await this._protoo.request( 'join', {
          displayName: this._displayName,
          device: this._device,
          rtpCapabilities: this._mediasoupDevice.rtpCapabilities,
          sctpCapabilities: this._mediasoupDevice.sctpCapabilities
        })

        this.emit( 'joined', peers )
      }
      logger.debug("joined.")
    } catch(err) {
      logger.error( '_joinRoom() error. %o', err )
      this.close()
    }
  }

}