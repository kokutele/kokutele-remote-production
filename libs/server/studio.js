const  Logger = require('../logger')
const config = require('../../config')

const MediaMixer = {} // for future use, maybe.  `= require('../../mixer')`
const logger = new Logger('studio')

const layoutPatterns = [
  { 
    id: 0, 
    label: "main only",
    type: 'horizontal'
  },
  { 
    id: 1, 
    label: "tile",
    type: 'horizontal'
  },
  { 
    id: 2, 
    label: "large and small",
    type: 'horizontal'
  },
  { 
    id: 3, 
    label: "p-in-p",
    type: 'horizontal'
  },
  { 
    id: 4, 
    label: "vertical-main",
    type: 'vertical'
  },
  { 
    id: 5, 
    label: "vertical-tile",
    type: 'vertical'
  },
  { 
    id: 6, 
    label: "vertical-p-in-p",
    type: 'vertical'
  },
]

class Studio {
  constructor( props ) {
    this._mediasoupRouter = props.mediasoupRouter
    this._height = props.height
    this._width  = props.width 
    this._rtmpUrl = props.rtmpUrl
    this._coverUrl = ''
    this._backgroundUrl = ''
    this._useMixer = props.useMixer
    this._patternId = layoutPatterns[0].id

    this._mixer = this._useMixer ? new MediaMixer( this._width, this._height, this._rtmpUrl ) : null
    logger.info('mixer instanceated. width:%d, height:%d, rtmpUrl: %s', this._width, this._height, this._rtmpUrl )

    this._plainTransports = new Map()
    this._consumers = new Map()

    this._layout = []
    this._participants = []
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

  get participants() {
    return this._participants
  }

  get patternId() {
    return this._patternId
  }

  set patternId( id ) {
    this._patternId = id
  }

  get patterns() {
    return layoutPatterns
  }

  get coverUrl() {
    return this._coverUrl
  }

  get backgroundUrl() {
    return this._backgroundUrl
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

  toMain( layoutIdx ) {
    this._layout = [ this._layout[layoutIdx], ...this._layout.filter( ( item, idx ) => idx !== layoutIdx ) ]
    this._calcLayout()
  }

  deletePeer( peerId ) {
    this._layout = this._layout.filter( item => item.peerId !== peerId )
    this._calcLayout()
  }

  setCoverUrl( url ) {
    this._coverUrl = url
  }

  setBackgroundUrl( url ) {
    this._backgroundUrl = url
  }

  addParticipant( { peerId, mediaId, displayName, audio, video } ) {
    this._participants = [ ...this._participants, { peerId, mediaId, displayName, audio, video }]
  }

  updateParticipantAudio( mediaId, audio )  {
    this._participants = this._participants.map( item => (
      item.mediaId === mediaId ? { ...item, audio } : item
    ))
  }

  updateParticipantVideo( mediaId, video )  {
    this._participants = this._participants.map( item => (
      item.mediaId === mediaId ? { ...item, video } : item
    ))
  }

  deleteParticipantsByPeerId( peerId ) {
    this._participants = this._participants.filter( item => item.peerId !== peerId )
  }

  deleteParticipantByMediaId( mediaId ) {
    this._participants = this._participants.filter( item => item.mediaId !== mediaId )
  }

  calcLayout() {
    this._calcLayout()
  }

  _calcLayout() {
    // todo - test code
    if( this._layout.length === 0 ) return 

    if( this._patternId === 0 ) {
      this._calcMainOnlyLayout()
    } else if( this._patternId === 1 ) {
      this._calcTileLayout()
    } else if( this._patternId === 2 ) {
      this._calcLargeAndSmallLayout()
    } else if( this._patternId === 3 ) {
      this._calcPinPLayout()
    } else if( this._patternId === 4 ) {
      this._calcVerticalMain()
    } else if( this._patternId === 5 ) {
      this._calcVerticalTile()
    } else if( this._patternId === 6 ) {
      this._calcVerticalPinP()
    }

    logger.info( '"_calcLayout()" - layout:%o', this._layout )
  }

  _calcMainOnlyLayout() {
    for( let i = 0; i < this._layout.length; i++ ) {
      const height = i === 0 ? this._height : 0
      const width  = i === 0 ? this._width : 0 // Math.floor( this._layout[0].videoWidth * height / this._layout[0].videoHeight ) : 0
      const posX = 0 // i === 0 ? Math.floor( ( this._width - width ) / 2 ) : 0
      const posY = 0

      this._layout[i] = { ...this._layout[i], posX, posY, width, height }
    }
  }

  _calcTileLayout() {
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
          const width = _width

          const posX = x * _width
          const posY = y * _height + paddingY

          this._layout[idx] = { ...this._layout[idx], posX, posY, width, height }
        }
      }
    }
  }

  _calcLargeAndSmallLayout() {
    for( let i = 0; i < this._layout.length; i++ ) {
      let width, height
      const numSub = 6

      if( i > numSub ) {
        width = 0; height = 0
      } else {
        height = i === 0 ? Math.floor( this._height * ( numSub - 1 ) / numSub ) : Math.floor( this._height * 1 / numSub )
        width  = Math.floor( this._width * height / this._height )
      }
      const posX = i === 0 ? 0 : Math.floor( this._width * ( numSub - 1 ) / numSub )
      const posY = i === 0 ? Math.floor( ( this._height - height ) / 2 ) : ( i - 1 ) * height

      this._layout[i] = { ...this._layout[i], posX, posY, width, height }
    }
  }

  _calcPinPLayout() {
    for( let i = 0; i < this._layout.length; i++ ) {
      let width, height
      if( i > 5 ) {
        width = 0; height = 0;
      } else {
        height = i === 0 ? this._height : Math.floor( this._height * 1 / 5 * 0.9 )
        width  = Math.floor( this._width * height / this._height )
      }
      const posX = i === 0 ? 
        0 : 
        Math.floor( this._width / 5 ) * ( i - 1 ) + Math.floor((( this._width / 5 ) - width ) / 2 )
      const posY = i === 0 ? 0 : this._height - height - Math.floor( this._height / 25 )

      this._layout[i] = { ...this._layout[i], posX, posY, width, height }
    }
  }

  _calcVerticalMain() {
    for( let i = 0; i < this._layout.length; i++ ) {
      const height = i === 0 ? this._height : 0
      const width  = i === 0 ? Math.floor( this._height * 9 / 16 ) : 0 // Math.floor( this._layout[0].videoWidth * height / this._layout[0].videoHeight ) : 0
      const posX = Math.floor( ( this._width - width ) / 2 ) // i === 0 ? Math.floor( ( this._width - width ) / 2 ) : 0
      const posY = 0

      this._layout[i] = { ...this._layout[i], posX, posY, width, height }
    }
  }

  _calcVerticalTile() {
    const numCol = Math.ceil( Math.sqrt( this._layout.length ) ) 
    const numRow = ( this._layout.length > ( numCol * ( numCol - 1 ) ) ) ? numCol : numCol - 1
    const _width = Math.floor( this._height * 9 / 16 )

    const width = Math.floor( _width / numCol )
    const height = Math.floor( this._height / numCol )

    const paddingX = Math.floor( ( this._width - _width ) / 2 )
    const paddingY = numRow < numCol ? Math.floor( height / 2 ) : 0

    for( let y = 0; y < numRow; y++ ) {
      for( let x = 0; x < numCol; x++ ) {
        const idx = x + y * numCol

        if( idx < this._layout.length ) {
          const posX = x * width + paddingX
          const posY = y * height + paddingY

          this._layout[idx] = { ...this._layout[idx], posX, posY, width, height }
        }
      }
    }
  }

  _calcVerticalPinP() {
    for( let i = 0; i < this._layout.length; i++ ) {
      let width, height
      if( i > 5 ) {
        width = 0; height = 0;
      } else {
        //height = i === 0 ? this._height : Math.floor( this._height * 1 / 5 * 0.9 )
        //width  = Math.floor( this._width * height / this._height )
        height = i === 0 ? this._height : Math.floor( this._height * 1 / 5 * 0.9 )
        width  = Math.floor( height * this._height / this._width )
      }
      const offsetX = 25, offsetY = 125
      const padX = Math.floor( ( this._width - this._height * this._height / this._width ) / 2 ) 
      const posXs = [
        padX, 
        padX + offsetX, 
        padX + this._height * this._height / this._width - width - offsetX,
        padX + offsetX, 
        padX + this._height * this._height / this._width - width - offsetX,
      ]
      const posX = posXs[i]

      const posYs = [
        0,
        offsetY,
        offsetY,
        height + offsetY + 15,
        height + offsetY + 15,
      ]
      const posY = posYs[i]

      this._layout[i] = { ...this._layout[i], posX, posY, width, height }
    }
  }


}

module.exports = Studio