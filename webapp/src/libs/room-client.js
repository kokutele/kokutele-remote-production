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
  // { scaleResolutionDownBy: 2, maxBitrate: 500_000 },
  { scaleResolutionDownBy: 1, maxBitrate: 2_500_000 }
]

const SCREEN_SHARING_SIMULCAST_ENCODINGS = [
  { dtx: true, maxBitrate: 1_500_000 },
  { dtx: true, maxBitrate: 6_000_000 }
]


/**
 * 
 * @module RoomClient
 * @extends EventEmitter
 */
export default class RoomClient extends EventEmitter {
  /**
   * 
   * 
   * @param {Object} props
   * @param {String} props.displayName
   * @param {String} props.roomId
   * @param {Boolean} [props.useSimulcast] - default `false`
   * @returns {RoomClient}
   */
  static create( { displayName, roomId, useSimulcast } ) {
    const peerId = randomString()
    const _useSimulcast = !!useSimulcast

    return new RoomClient( { peerId, roomId, displayName, useSimulcast: _useSimulcast })
  }

  /**
   * 
   * @constructor
   * @param {object} props 
   * @param {string} props.peerId
   * @param {string} props.roomId
   * @param {string} props.displayName
   * @param {boolean} props.useSimulcast
   */
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

  /**
   * peer id
   * 
   * @type {string}
   */
  get peerId() {
    return this._peerId
  }

  /**
   * display name
   * 
   * @type {string}
   */
  get displayName() {
    return this._displayName
  }

  /**
   * consumers
   * 
   * @type {object}
   */
  get consumers() {
    return this._consumers
  }

  /**
   * audio producer
   * 
   * @type {object}
   */
  get audioProducer() {
    return this._audioProducer
  }

  /**
   * video producer
   * 
   * @type {object}
   */
  get videoProducer() {
    return this._videoProducer
  }

  /**
   * join
   * 
   * @fires module:RoomClient#newConsumer
   * @fires module:RoomClient#leaveConsumer
   * 
   * @returns {Promise<NULL>}
   */
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

              await this.setPreferredLayers( consumer.id, 0 )
                .catch( err => console.warn( 'setPreferredLayers:%o', err ))


              /**
               * leave consumer
               * 
               * @event module:RoomClient#leaveConsumer
               * @type {object}
               * @property {string} id - id of consumer
               * @property {string} kind - `video` or `audio`
               */
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
        switch( notification.method ) {
          case 'producerScore': {
            /**
             * @event module:RoomClient#produceScore
             * @type {object}
             * @property {string} producerId
             * @property {number} score
             * 
             */
            const { producerId, score } = notification.data
            this.emit('producerScore', { producerId, score })
            break
          }
          case 'newPeer': {
            /**
             * @event module:RoomClient#newPeer
             * @type {object}
             * 
             */
            const peer = notification.data
            this.emit('newPeer', peer )
            break
          }
          case 'peerClosed': {
            /**
             * @event module:RoomClient#peerClosed
             * @type {string}
             */
            const { peerId } = notification.data
            this.emit('peerClosed', peerId )
            break
          }
          case 'peerDisplayNameChanged': {
            /**
             * @event module:RoomClient#peerDisplayNameChanged
             * @type {object}
             * @property {string} peerId
             * @property {string} dispalyName
             * @property {string} oldDisplayName
             * 
             */
            const { peerId, displayName, oldDisplayName } = notification.data
            this.emit('peerDisplayNameChanged', { peerId, displayName, oldDisplayName })
            break
          }
          case 'studioLayoutUpdated': {
            /**
             * @event module:RoomClient#studioLayoutUpdated
             * @type {object}
             * 
             */
            this.emit('studioLayoutUpdated', notification.data )
            break
          }
          case 'studioPatternIdUpdated': {
            /**
             * @event module:RoomClient#studioPatternIdUpdated
             * @type {string}
             * 
             */
            this.emit('studioPatternIdUpdated', notification.data )
            break
          }
          case 'studioParticipantsUpdated': {
            /**
             * @event module:RoomClient#studioParticipantsUpdated
             * @type {object}
             * 
             */
            this.emit('studioParticipantsUpdated', notification.data )
            break
          }
          case 'reactionsUpdated': {
            /**
             * @event module:RoomClient#reactionsUpdated
             * @type {object}
             */
            this.emit('reactionsUpdated', notification.data )
            break
          }
          case 'setCaption': {
            /**
             * @event module:RoomClient#setCaption
             * @type {string}
             */
            this.emit('setCaption', notification.data )
            break
          }
          case 'setCoverUrl': {
            /**
             * @event module:RoomClient#setCoverUrl
             * @type {string}
             */
            this.emit('setCoverUrl', notification.data )
            break
          }
          case 'updatedCoverUrls': {
            /**
             * @event module:RoomClient#setCoverUrls
             */
            this.emit('setCoverUrls', notification.data )
            break
          }
          case 'setBackgroundUrl': {
            /**
             * @event module:RoomClient#setBackgroundUrl
             * @type {string}
             */
            this.emit('setBackgroundUrl', notification.data )
            break
          }
          case 'updatedBackgroundUrls': {
            /**
             * @event module:RoomClient#setBackgroundUrls
             */
            this.emit('setBackgroundUrls', notification.data )
            break
          }
          case 'downlinkBwe': {
            /**
             * @event module:RoomClient#downlinkBwe
             * @type {object}
             * 
             */
            this.emit('downlinkBwe', notification.data )
            // logger.debug('"downlinkBwe" event:%o', notification.data)
            break
          }
          case 'consumerClosed': {
            const { consumerId } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            consumer.close()
            this._consumers.delete( consumerId )

            /**
             * @event module:RoomClient#leaveConsumer
             * @type {object}
             */
            this.emit('leaveConsumer', consumer )

            break
          }
          case 'consumerPaused': {
            const { consumerId } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            consumer.pause()

            /**
             * @event module:RoomClient#consumerPaused
             * @type {string}
             */
            this.emit('consumerPaused', consumerId )

            break
          }
          case 'consumerResumed': {
            const { consumerId } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            consumer.resume()

            /**
             * @event module:RoomClient#consumerResumed
             * @type {string}
             */
            this.emit('consumerResumed', consumerId )

            break
          }
          case 'consumerLayersChanged': {
            const { consumerId, spatialLayer, temporalLayer } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            /**
             * @event module:RoomClient#consumerLayersChanged
             * @type {object}
             * @property {string} consumerId
             * @property {number} spatialLayer
             * @property {number} temporalLayer
             */
            this.emit( 'consumerLayersChanged', { consumerId, spatialLayer, temporalLayer })

            break
          }
          case 'consumerScore': {
            const { consumerId, score } = notification.data
            const consumer = this._consumers.get( consumerId )

            if( !consumer ) break

            /**
             * @event module:RoomClient#consumerScore
             * @type {object}
             * @property {string} consumerId
             * @property {number} score
             */
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

            /**
             * @event module:RoomClient#dataConsumerClosed
             * @type {object}
             * @property {string} dataConsumerId
             * @property {string} peerId
             * 
             */
            this.emit( 'dataConsumerClosed', { dataConsumerId, peerId } )
            break
          }
          case 'activeSpeaker': {
            const { peerId } = notification.data

            /**
             * @event module:RoomClient#activeSpeaker
             * @type {string}
             */
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
   * @param {Boolean} [isCapture] - default false
   * @return {Promise<Object>} - { audioProducerId:String, videoProducerId:String }
   */
  async createProducer( stream, isCapture ) {
    const _isCapture = !!isCapture
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

        const encodings = this._useSimulcast ? ( _isCapture ? SCREEN_SHARING_SIMULCAST_ENCODINGS : VIDEO_SIMULCAST_ENCODINGS ) : undefined
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

  /**
   * replace stream
   * 
   * @param {MediaStream} stream  
   */
  async replaceStream( stream ) {
    const videoTrack = stream.getVideoTracks()[0]
    const audioTrack = stream.getAudioTracks()[0]

    for( const producer of this._producers.values() ) {
      if( producer.kind === 'audio' && audioTrack ) {
        producer.replaceTrack( { track: audioTrack } )
      }

      if( producer.kind === 'video' && videoTrack ) {
        producer.replaceTrack( { track: videoTrack } )
      }
    }
  }

  /**
   * close producer
   * 
   * @param {string} producerId 
   */
  async closeProducer( producerId ) {
    const producer = this._producers.get( producerId )

    if( producer ) {
      producer.close()
      await this._protoo.request( 'closeProducer', { producerId } )
        .then( () => this._producers.delete( producerId ))
        .catch( err => {
          logger.error( 'Error closing producer:%o', err )
          throw err
        })
    }
  }

  /**
   * get preferred layers of the consumer
   * 
   * @param {string} consumerId 
   * @returns {object} - preferred layers data
   */
  async getPreferredLayers( consumerId ) {
    const consumer = this._consumers.get( consumerId )

    if( consumer ) {
      const layers = await this._protoo.request('getPreferredLayers', { consumerId } )
        .catch( err => { throw err } )
      return layers
    } else {
      throw new Error( `No consumer found:${consumerId}` )
    }
  }

  /**
   * get current layers of the consumer
   * 
   * @param {string} consumerId 
   * @returns {object} - current layers data
   */
  async getCurrentLayers( consumerId ) {
    const consumer = this._consumers.get( consumerId )

    if( consumer ) {
      const layers = await this._protoo.request('getCurrentLayers', { consumerId } )
        .catch( err => { throw err } )
      return layers
    } else {
      throw new Error( `No consumer found:${consumerId}` )
    }
  }

  /**
   * set preferred layers of the consumer
   * 
   * @param {string} consumerId 
   * @param {number} spatialLayer 
   */
  async setPreferredLayers( consumerId, spatialLayer ) {
    const consumer = this._consumers.get( consumerId )

    if( consumer ) {
      await this._protoo.request('setPreferredLayers', { consumerId, spatialLayer } )
        .catch( err => { throw err } )
    } else {
      throw new Error( `No consumer found:${consumerId}` )
    }
  }

  /**
   * get studio patterns
   * 
   * @returns {object} - studio patterns data
   */
  async getStudioPatterns() {
    return await this._protoo.request( 'getStudioPatterns' )
      .catch( err => { throw err })
  }

  /**
   * get studio pattern id
   * 
   * @returns {string} - studio pattern id
   */
  async getStudioPatternId() {
    return await this._protoo.request( 'getStudioPatternId' )
      .catch( err => { throw err })
  }

  /**
   * set studio pattern id
   * 
   * @param {object} props 
   * @param {number} props.patternId
   * @returns {object} - @@@
   */
  async setStudioPatternId({ patternId }) {
    return await this._protoo.request( 'setStudioPatternId', { patternId } )
      .catch( err => { throw err })
  }

  /**
   * get studio size
   * 
   * @returns {object} - { width, height }
   */
  async getStudioSize() {
    return await this._protoo.request( 'getStudioSize' )
      .catch( err => { throw err })
  }

  /**
   * get studio layout
   * 
   * @returns {object} - current studio layout data
   */
  async getStudioLayout() {
    return await this._protoo.request( 'getStudioLayout' )
      .catch( err => { throw err })
  }

  /**
   * set caption data
   * 
   * @param {string} caption 
   * @returns {object} - @@@
   */
  async setCaption( caption ) {
    return await this._protoo.request( 'setCaption', { caption })
      .catch( err => { throw err })
  }

  /**
   * get caption data
   * 
   * @returns {object} - { caption:String }
   */
  async getCaption() {
    return await this._protoo.request( 'getCaption' )
      .catch( err => { return { caption: '' } })
  }

  /**
   * set cover url
   * 
   * @param {string} url 
   * @returns {object} - @@@
   */
  async setCoverUrl( url ) {
    return await this._protoo.request( 'setCoverUrl', { coverUrl: url } )
      .catch( err => { throw err })
  }

  /**
   * get cover url
   * 
   * @returns {object} - { coverUrl:String }
   */
  async getCoverUrl() {
    return await this._protoo.request( 'getCoverUrl' )
      .catch( err => { return { coverUrl: '' }})
  }

  /**
   * set background url
   * 
   * @param {string} url 
   * @returns {object} - @@@
   */
  async setBackgroundUrl( url ) {
    return await this._protoo.request( 'setBackgroundUrl', { backgroundUrl: url } )
      .catch( err => { throw err })
  }

  /**
   * get background url
   * 
   * @returns {object} - { coverUrl:String}
   */
  async getBackgroundUrl() {
    return await this._protoo.request( 'getBackgroundUrl' )
      .catch( err => { return { coverUrl: '' }})
  }

  /**
   * add media to studio layout
   * 
   * @param {object} props 
   * @param {string} props.peerId
   * @param {string} props.mediaId
   * @param {string} props.audioProducerId
   * @param {string} props.videoProducerId
   * @param {number} props.videoWidth
   * @param {number} props.videoHeight
   */
  async addStudioLayout( { peerId, mediaId, audioProducerId, videoProducerId, videoWidth, videoHeight } ) {
    await this._protoo.request( 'addStudioLayout', { peerId, mediaId, audioProducerId, videoProducerId, videoWidth, videoHeight } )
      .catch( err => { throw err })
  }

  /**
   * delete media from studio layout
   * 
   * @param {object} props 
   * @param {string} props.peerId
   * @param {string} props.mediaId
   * @param {string} props.audioProducerId
   * @param {string} props.videoProducerId
   * 
   */
  async deleteStudioLayout( { peerId, mediaId, audioProducerId, videoProducerId } ) {
    await this._protoo.request( 'deleteStudioLayout', { peerId, mediaId, audioProducerId, videoProducerId } )
      .catch( err => { throw err })
  }

  /**
   * get studio participants
   * 
   * @returns {object} - participants data
   */
  async getStudioParticipants() {
    return this._protoo.request( 'getStudioParticipants' )
      .catch( err => { throw err })
  }
  
  /**
   * add participants
   * 
   * @param {object} props 
   * @param {string} props.mediaId
   * @param {string} props.peerId
   * @param {string} props.displayName
   * @param {boolean} props.audio
   * @param {boolean} props.video
   * @returns {object} - @@@
   */
  async addParticipant( { mediaId, peerId, displayName, audio, video }) {
    return this._protoo.request( 'addParticipant', { mediaId, peerId, displayName, audio, video } )
      .catch( err => { throw err })
  }

  /**
   * update participant audio status
   * 
   * @param {object} props 
   * @param {string} props.mediaId 
   * @param {boolean} props.audio 
   * @returns {object} - @@@
   */
  async updateParticipantAudio( { mediaId, audio }) {
    return this._protoo.request( 'updateParticipantAudio', { mediaId, audio } )
      .catch( err => { throw err })
  }

  /**
   * update participant video status
   * 
   * @param {object} props 
   * @param {string} props.mediaId 
   * @param {boolean} props.video 
   * @returns {object} - @@@
   */
  async updateParticipantVideo( { mediaId, video }) {
    return this._protoo.request( 'updateParticipantVideo', { mediaId, video } )
      .catch( err => { throw err })
  }

  /**
   * delete participant by mediaId
   *  
   * @param {object} props 
   * @param {string} props.mediaId
   * @returns {object} - @@@
   */
  async deleteParticipantByMediaId( { mediaId } ) {
    return this._protoo.request( 'deleteParticipantByMediaId', { mediaId } )
      .catch( err => { throw err })
  }

  /**
   * set the media at main in studio layout
   * 
   * @param {number} layoutIdx 
   */
  async toMainInStudioLayout( layoutIdx ) {
    await this._protoo.request( 'toMainInStudioLayout', { layoutIdx } )
      .catch( err => { throw err })
  }

  /**
   * pause the consumer 
   * 
   * @param {string} consumerId 
   */
  async pauseConsumer( consumerId ) {
    await this._protoo.request( 'pauseConsumer', { consumerId })
      .catch( err => { throw err })
  }

  /**
   * resume the consumer 
   * 
   * @param {string} consumerId 
   */
  async resumeConsumer( consumerId ) {
    await this._protoo.request( 'resumeConsumer', { consumerId })
      .catch( err => { throw err })
  }


  /**
   * close
   */
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

  async setMaxSendingSpatialLayer( spatialLayer ) {
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
          id, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy
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
          iceServers,
          iceTransportPolicy,
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
              logger.debug('sendTransport - connected:%o', obj)
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
          sctpCapabilities: this._mediasoupDevice.sctpCapabilities,
        })

        const {
          id, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy
        } = transportInfo

        logger.debug('transportInfo:%o', transportInfo )

        this._recvTransport = this._mediasoupDevice.createRecvTransport( {
          id,
          iceParameters,
          iceCandidates,
          dtlsParameters: { ...dtlsParameters, role: 'auto' },
          sctpParameters,
          iceServers,
          iceTransportPolicy,
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

        /**
         * @event module:RoomClient#joined
         * @type {object}
         */
        this.emit( 'joined', peers )
      }
      logger.debug("joined.")
    } catch(err) {
      logger.error( '_joinRoom() error. %o', err )
      this.close()
    }
  }
}


/**
 * 
 * @event module:RoomClient#newConsumer
 * @type {object}
 * @property {string} peerId - peer id
 * @property {string} producerId - producer id
 * @property {string} id - id of this consumer
 * @property {string} kind - kind ( `video` or `audio` )
 * @property {string} type - @@@
 * @property {boolesn} producerPaused - true if producer is paused
 * @property {object} appData - arbitrary app data
 * 
 */

