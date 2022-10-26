import { useEffect, useRef } from 'react'
import { Alert } from 'antd'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import { Mutex } from 'async-mutex'

import { isNumber } from '../libs/util'
import { logo } from '../config'

import thumbUp from '../assets/thumb-up64.png'
import heart from '../assets/heart.png'
import clap from '../assets/clapping.png'
import './studio.css'

const logger = new Logger('studio')
const mutext = new Mutex()

const thumbUpImage = new Image()
thumbUpImage.src = thumbUp
const heartImage = new Image()
heartImage.src = heart
const clapImage = new Image()
clapImage.src = clap

const icons = [
  thumbUpImage, 
  heartImage, 
  clapImage,
]

const IS_VIEWER = window.location.pathname.includes('/viewer/')

export default function Studio( props ) {
  const { 
    getStudioLayout, 
    getStudioSize, 
    getCaption,
    getCoverUrl,
    getStudioPatternId,
    getStudioPatterns,
    setLogo,
    state, 
    appData 
  } = useAppContext()

  const { playAudio, hideAlert, viewer, videoIdx } = props
  const _canvasEl = useRef()
  const _ctx = useRef()
  const _videoEls = useRef( new Map() )
  const _audioEls = useRef( new Map() )
  const _reactions = useRef( [] )

  useEffect( () => {
    if( state.status === 'READY' ) {
      ( async () => {
        _ctx.current = _canvasEl.current.getContext('2d')
        await getStudioPatterns()
        await getStudioPatternId()
        await getStudioSize()
        await getStudioLayout()
        await getCaption()
        await getCoverUrl()
        await setLogo( logo )
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.status ])

  useEffect( () => {
    _canvasEl.current.height = state.studio.height
    _canvasEl.current.width = state.studio.width
  }, [state.studio.height, state.studio.width ])

  useEffect( () => {
    mutext.runExclusive( async () => {
      // delete video elements which is not included in layout object.
      for( const videoProducerId of _videoEls.current.keys() ) {
        const consumer = Array.from( appData.roomClient.consumers.values() )
          .find( consumer => consumer.producerId === videoProducerId )
        const included = state.studio.layout.find( item => item.videoProducerId === videoProducerId )

        if( !included ) {
          const videoElem = _videoEls.current.get( videoProducerId )

          if( videoElem ) {
            videoElem.pause()
            videoElem.remove()
          }
          _videoEls.current.delete(videoProducerId)

          if( consumer ) {
            await appData.roomClient.setPreferredLayers( consumer.id, 0 )
              .catch( err => console.warn( 'setPreferredLayers:%o', err ))
          }
        }
      }

      // create new video and audio elements which is not exist.
      const layout = state.studio.layout
        .filter( item => ( item.width !== 0 && item.height !== 0 ))

      for( let idx = 0; idx < layout.length; idx++ ) {
        const item = layout[idx]
        const localMedia = state.localMedias
          .find( media => media.videoProducerId === item.videoProducerId )
        const consumer = Array.from( appData.roomClient.consumers.values() )
          .find( consumer => consumer.producerId === item.videoProducerId )

        // only main video will be got as high quality
        if( consumer && ( ( state.studio.patternId === 1 && layout.length <= 4 ) || idx === 0 ) ) {
          await appData.roomClient.setPreferredLayers(consumer.id, 1)
            .catch(err => console.warn('setPreferredLayers:%o', err))
        } else if ( consumer && idx > 0 ) {
          await appData.roomClient.setPreferredLayers(consumer.id, 0)
            .catch(err => console.warn('setPreferredLayers:%o', err))
        }

        if( !_videoEls.current.has( item.videoProducerId ) ) {
          let stream
          if( localMedia ) {
            stream = appData.localStreams.get( localMedia.localStreamId )
          } else {
            if( consumer ) {
              // when viewer is true, call resumeConsumer to obtain track
              if (viewer) {
                logger.debug('consumer:%o', consumer)
                await appData.roomClient.resumeConsumer(consumer.id)
              }

              const track = consumer.track
              stream = new MediaStream( [ track ] )
            }
          }

          if( stream ) {
            const videoEl = document.createElement( 'video' )
            videoEl.srcObject = stream
            videoEl.muted = true

            videoEl.onloadedmetadata = async () => {
              await videoEl.play()
            }

            _videoEls.current.set( item.videoProducerId, videoEl )

            if( consumer ) {
              await appData.roomClient.getPreferredLayers( consumer.id )
                .then( layers => {
                  logger.debug( 'layers for consumerId:%s is %o', consumer.id, layers )
                }).catch( err => {
                  logger.error( 'getPreferredLayers:%o', err )
                })
            }
          }
        }
      }

      if( playAudio ) {
        // delete audio elements which is not included in layout object.
        for( const consumerId of _audioEls.current.keys() ) {
          if( !appData.roomClient.consumers.has( consumerId ) ) {
            const audioElem = _audioEls.current.get( consumerId )
            audioElem.pause()
            audioElem.remove()
            _audioEls.current.delete(consumerId)
            logger.debug('deleted audioEl:%s', consumerId )
          }
        }


        //const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.audioProducerId )
        state.audioConsumers 
          .filter( item => !_audioEls.current.has( item.consumerId ) )
          .forEach( async item => {
            logger.debug('audioConsumer - %s:%o', item.consumerId, appData.roomClient.consumers.get( item.consumerId ))
            // when viewer is true, call resumeConsumer to obtain track
            if( viewer ) {
              await appData.roomClient.resumeConsumer( item.consumerId )
            }

            const track = appData.roomClient.consumers.get( item.consumerId ).track
            const stream = new MediaStream( [ track ] )

            const audioEl = document.createElement( 'audio' )
            audioEl.srcObject = stream
            audioEl.muted = false

            audioEl.onloadedmetadata = async () => {
              await audioEl.play()
            }

            _audioEls.current.set( item.consumerId, audioEl )
          })
      }

      // when viewer is true, pause unused consumer
      if( viewer ) {
        for( const item of state.videoConsumers ) {
          if( !_videoEls.current.has( item.producerId ) ) {
            logger.debug('pause video consumer:%s', item.consumerId )
            await appData.roomClient.pauseConsumer( item.consumerId )
          }
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ playAudio, state.studio.layout, state.studio.patternId, state.localMedias, state.audioConsumers, state.videoConsumers, state.peers, viewer ])

  useEffect(() => {
    if( state.status !== 'READY' ) return 
    const duration = 2000

    for( let i = 0; i < state.studio.reactions.sum; i++ ) {
      setTimeout( () => {
        const id = Date.now()
        const width = Math.floor(_canvasEl.current.width / ( 3 + Math.random() ))
        _reactions.current.push({
          id,
          x: _canvasEl.current.width,
          y: Math.floor(_canvasEl.current.height / 3 * Math.random()) + 50,
          width,
          max: Math.floor( width * ( 0.8 + 0.2 * Math.random() ) ),
          icon: icons[ Math.floor( icons.length * Math.random() )]
        })

        setTimeout(() => {
          _reactions.current = _reactions.current.filter( item => item.id !== id )
        }, duration)
      }, Math.floor(Math.random() * 1000))
    }

    let reqId

    const render = () => {
      _ctx.current.clearRect( 0, 0, state.studio.width, state.studio.height )

      _ctx.current.beginPath()
      _ctx.current.strokeStyle = '#fff'
      const pattern = state.studio.patterns[ state.studio.patternId ]
      const type = pattern ? pattern.type : null

      state.studio.layout.forEach( ( item, idx ) => {
        if( isNumber( videoIdx ) ) {
          if( videoIdx !== idx ) return
          console.log( pattern )
          
          const videoProducerId = item.videoProducerId
          const videoEl = _videoEls.current.get( videoProducerId )
          if( videoEl ) {
            const sw = type === 'horizontal' ?
              videoEl.videoWidth :
              Math.floor( videoEl.videoHeight * state.studio.height / state.studio.width ) 
            const sh = type === 'horizontal' ?
              Math.floor( videoEl.videoWidth * state.studio.height / state.studio.width ) :
              videoEl.videoHeight
            const sx = type === 'horizontal' ? 
              0 :
              Math.floor( ( videoEl.videoWidth - sw ) / 2 ) 
            const sy = type === 'horizontal' ?
              Math.floor( ( videoEl.videoHeight - sh ) / 2 ) :
              0

            const w = type === 'horizontal' ? state.studio.width : Math.floor( state.studio.height * 9 / 16 )
            const h = state.studio.height
            const posX = type === 'horizontal' ? 0 : Math.floor( ( state.studio.width - w ) / 2 )
            const posY = 0

            _ctx.current.drawImage( 
              videoEl,
              sx, sy, sw, sh,
              posX, posY, w, h 
            )
          }
        } else {
          const videoProducerId = item.videoProducerId
          const videoEl = _videoEls.current.get( videoProducerId )
          if( videoEl ) {
            const sw = type === 'horizontal' ?
              videoEl.videoWidth :
              Math.floor( videoEl.videoHeight * item.width / item.height ) 
            const sh = type === 'horizontal' ?
              Math.floor( videoEl.videoWidth * item.height / item.width ) :
              videoEl.videoHeight
            const sx = type === 'horizontal' ? 
              0 :
              Math.floor( ( videoEl.videoWidth - sw ) / 2 ) 
            const sy = type === 'horizontal' ?
              Math.floor( ( videoEl.videoHeight - sh ) / 2 ) :
              0

            _ctx.current.drawImage( 
              videoEl, 
              sx, sy, sw, sh,
              item.posX, item.posY, item.width, item.height 
            )
          }
          if( state.studio.patternId === 1 || idx > 0 ) {
            _ctx.current.lineWidth = 3
            _ctx.current.strokeStyle = 'yellow'
            _ctx.current.rect( item.posX, item.posY, item.width, item.height )
          }
        }
      })

      _ctx.current.stroke()
      
      // draw reactions
      // _ctx.current.scale( 1.5, 1.5 )
      _reactions.current.forEach( item => {
        const dx = Math.floor(Math.sin(( Date.now() - item.id ) / duration * Math.PI) * item.width )
        item.x = Math.floor( type === 'vertical' ? _canvasEl.current.width * 2 / 3 : _canvasEl.current.width ) - ( dx > item.max ? item.max : dx )
        _ctx.current.drawImage( item.icon, item.x, item.y )
      })
      // _ctx.current.scale( 1, 1 )

      // draw caption
      if( state.caption !== '' ) {
        _ctx.current.font = 'bold 48px sans-serif';
        const { width }= _ctx.current.measureText( state.caption )
        _ctx.current.fillStyle = '#bd3634'
        _ctx.current.fillRect( 0, _canvasEl.current.height - 48 - 50, width + 20, 88 )
        _ctx.current.fillRect( width + 30, _canvasEl.current.height - 48 - 50, 20, 88 )
        //_ctx.current.fillStyle = '#000'
        _ctx.current.fillStyle = '#fff'
        _ctx.current.fillText( state.caption, 10, _canvasEl.current.height - 30  )
      }

      // draw logo
      if( state.logo !== '' ) {
        _ctx.current.font = "bold 48px 'Dosis', sans-serif";
        const { width }= _ctx.current.measureText( state.logo )
        _ctx.current.fillStyle = 'rgba( 189, 54, 52, 0.5 )'
        _ctx.current.fillText( state.logo, _canvasEl.current.width - width - 10, 58  )
      }

      reqId = requestAnimationFrame( render )
    }

    render()

    return function cleanup(){
      if( reqId ) cancelAnimationFrame( reqId )
      reqId = null
    }
  }, [ 
    videoIdx,
    state.status, 
    state.studio.layout, state.studio.patternId, state.studio.height, state.studio.width, 
    state.studio.patterns,
    state.studio.reactions.sum, state.studio.reactions.lastUpdated,
    state.caption, state.logo ])

  return (
    <div className="Studio">
      <div className="wrapper" style={ props.style }>
        <canvas ref={ _canvasEl }></canvas>
        { ( IS_VIEWER && !!state.studio.coverUrl ) && (
          <div className='cover-area'>
            <img src={state.studio.coverUrl} alt="cover" />
          </div>
        ) }
        { !hideAlert && state.studio.layout.length === 0 && (
          <div className='alert'>
            <Alert 
              description="Click media shown below to add here for live streaming."
              message="Virtual Studio" 
              type="info"   
              showIcon 
            />
          </div>
        )}
      </div>
    </div>
  )
}