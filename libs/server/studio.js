const  Logger = require('../logger')
const config = require('../../config')

const logger = new Logger('studio')

class Studio {
  constructor( props ) {
    this._mediasoupRouter = props.mediasoupRouter
    this._height = props.height || 1080
    this._width  = props.width  || 1920

    this._plainTransports = new Map()
    this._consumers = new Map()

    this._layout = []
  }

  get height() {
    return this._height
  }

  get width() {
    return this._width
  }

  get layout() {
    return this._layout
  }

  async addMedia({ peerId, videoHeight, videoWidth, audioProducerId, videoProducerId }) {
    let isExist = !!this._layout.find( item => (
      item.peerId === peerId && item.audioProducerId === audioProducerId && item.videoProducerId === videoProducerId
    ))
        
    if( !isExist ) {
      this._layout = [ ...this._layout, { peerId, audioProducerId, videoProducerId, videoWidth, videoHeight }]

      const audioTransport = await this._mediasoupRouter.createPlainTransport({
        listenIp: config.mediasoup.plainTransportOptions.listenIp.ip,
        rtcpMux: false
      })
      await audioTransport.connect({ ip:'127.0.0.1', port: 5000, rtcpPort: 5001 })
      this._plainTransports.set( audioProducerId, audioTransport )

      logger.info( 'audioTransport.tuple:%o', audioTransport.tuple )
      logger.info( 'audioTransport.rtcpTuple:%o', audioTransport.rtcpTuple )
      const videoTransport = await this._mediasoupRouter.createPlainTransport({
        listenIp: config.mediasoup.plainTransportOptions.listenIp.ip,
        rtcpMux: false
      })
      await videoTransport.connect({ ip:'127.0.0.1', port: 5002, rtcpPort: 5003 })
      this._plainTransports.set( videoProducerId, videoTransport )

      logger.info( 'videoTransport.tuple:%o', videoTransport.tuple )
      logger.info( 'videoTransport.rtcpTuple:%o', videoTransport.rtcpTuple )
      const rtpCapabilities = this._mediasoupRouter.rtpCapabilities

      const audioConsumer = await audioTransport.consume( { producerId: audioProducerId, rtpCapabilities, paused: false } ) // todo - paused:true
      this._consumers.set( audioProducerId, audioConsumer )
      const videoConsumer = await videoTransport.consume( { producerId: videoProducerId, rtpCapabilities, paused: false } ) // todo - paused:true
      this._consumers.set( videoProducerId, videoConsumer )

      this._calcLayout()
    }
  }

  deleteMedia({ peerId, audioProducerId, videoProducerId }) {
    this._layout = this._layout.filter( item => ( 
      item.peerId !== peerId && item.audioProducerId !== audioProducerId && item.videoProducerId !== videoProducerId 
    ))
    this._calcLayout()
  }

  deletePeer( peerId ) {
    this._layout = this._layout.filter( item => item.peerId !== peerId )
    this._calcLayout()
  }

  _calcLayout() {
    // todo - test code
    if( this._layout.length === 0 ) return 

    const numCol = Math.ceil( Math.sqrt( this._layout.length ) ) 
    const numRow = ( this._layout.length > ( numCol * ( numCol - 1 ) ) ) ? numCol : numCol - 1

    const _width = Math.floor( this._width / numCol )
    const _height = Math.floor( this._height / numCol )

    const paddingY = numRow < numCol ? Math.floor( _height / 2 ) : 0

    for( let y = 0; y < numRow; y++ ) {
      for( let x = 0; x < numCol; x++ ) {
        const idx = x + y * numCol

        if( idx < this._layout.length ) {
          const height = _height
          const width = Math.floor( this._layout[idx].videoWidth * _height / this._layout[idx].videoHeight )

          const posX = x * _width + ( _width > width ? Math.floor( ( _width - width ) / 2 ) : 0 )
          const posY = y * _height + paddingY

          this._layout[idx] = { ...this._layout[idx], posX, posY, width, height }
        }
      }
    }

    logger.info( '"_calcLayout()" - numCol:%d, numRow:%d, layout:%o', numCol, numRow, this._layout )
  }
}

module.exports = Studio