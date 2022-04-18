const  Logger = require('../logger')
const config = require('../../config')

const MediaMixer = {} // for future use, maybe.  `= require('../../mixer')`
const logger = new Logger('studio')

class Studio {
  constructor( props ) {
    this._mediasoupRouter = props.mediasoupRouter
    this._height = props.height
    this._width  = props.width 
    this._rtmpUrl = props.rtmpUrl
    this._useMixer = props.useMixer

    this._mixer = this._useMixer ? new MediaMixer( this._width, this._height, this._rtmpUrl ) : null
    logger.info('mixer instanceated. width:%d, height:%d, rtmpUrl: %s', this._width, this._height, this._rtmpUrl )

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

  start() {
    if( this._mixer ) {
      this._mixer.start()
      // for debugging purpose.
      const name = this._mixer.addTestVideoSrc( 18, 1, 1, 320, 240, 3 )
      const name2 = this._mixer.addTestVideoSrc( 0, 320, 240, 320, 240, 3 )
    }
  }

  async addMedia({ peerId, videoHeight, videoWidth, mediaId, audioProducerId, videoProducerId }) {
    let isExist = !!this._layout.find( item => (
      item.peerId === peerId && item.audioProducerId === audioProducerId && item.videoProducerId === videoProducerId && item.mediaId === mediaId
    ))
        
    if( !isExist ) {
      this._layout = [ ...this._layout, { peerId, audioProducerId, videoProducerId, videoWidth, videoHeight, mediaId }]

      this._calcLayout()
    }
  }

  deleteMedia({ peerId, mediaId, audioProducerId, videoProducerId }) {
    this._layout = this._layout.filter( item => ( 
      !( item.peerId === peerId && item.audioProducerId === audioProducerId && item.videoProducerId === videoProducerId && item.mediaId === mediaId )
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