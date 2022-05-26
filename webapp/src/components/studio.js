import { useEffect, useRef } from 'react'
import { Alert } from 'antd'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import { Mutex } from 'async-mutex'
import './studio.css'

const logger = new Logger('studio')
const mutext = new Mutex()

export default function Studio( props ) {
  const { 
    getStudioLayout, 
    getStudioSize, 
    state, 
    appData 
  } = useAppContext()

  const { playAudio, hideAlert, viewer } = props
  const _canvasEl = useRef()
  const _ctx = useRef()
  const _videoEls = useRef( new Map() )
  const _audioEls = useRef( new Map() )

  useEffect( () => {
    if( state.status === 'READY' ) {
      _ctx.current = _canvasEl.current.getContext('2d')
      getStudioSize()
      getStudioLayout()
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
        if( !state.studio.layout
          .filter( item => ( item.width !== 0 && item.height !== 0 ))
          .find( item => item.videoProducerId === videoProducerId ) 
        ) {
          const videoElem = _videoEls.current.get( videoProducerId )
          videoElem.pause()
          videoElem.remove()
          _videoEls.current.delete(videoProducerId)

          const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === videoProducerId )
          if( consumer ) {
            await appData.roomClient.setPreferredLayers( consumer.id, 0 )
              .catch( err => console.warn( 'setPreferredLayers:%o', err ))
          }
        }
      }

      // delete audio elements which is not included in layout object.
      for( const audioProducerId of _audioEls.current.keys() ) {
        if( !state.studio.layout
          .filter( item => ( item.width !== 0 && item.height !== 0 ))
          .find( item => item.audioProducerId === audioProducerId ) 
        ) {
          const audioElem = _audioEls.current.get( audioProducerId )
          audioElem.pause()
          audioElem.remove()
          _audioEls.current.delete(audioProducerId)
        }
      }

      // create new video and audio elements which is not exist.
      const layout = state.studio.layout
        .filter( item => ( item.width !== 0 && item.height !== 0 ))

      for( const item of layout ) {
        if( !_videoEls.current.has( item.videoProducerId ) ) {
          const localMedia = state.localMedias.find( media => media.videoProducerId === item.videoProducerId )
          const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.videoProducerId )

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

              await appData.roomClient.setPreferredLayers(consumer.id, 1)
                .catch(err => console.warn('setPreferredLayers:%o', err))

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
        
        if( playAudio ) {
          if( !_audioEls.current.has( item.audioProducerId ) ) {
            const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.audioProducerId )

            if( consumer ) {
              // when viewer is true, call resumeConsumer to obtain track
              if( viewer ) {
                await appData.roomClient.resumeConsumer( consumer.id )
              }

              const track = consumer.track
              const stream = new MediaStream( [ track ] )

              const audioEl = document.createElement( 'audio' )
              audioEl.srcObject = stream
              audioEl.muted = false

              audioEl.onloadedmetadata = async () => {
                logger.debug('audio played')
                await audioEl.play()
              }

              _audioEls.current.set( item.audioProducerId, audioEl )
            }
          }
        }
      }
      

      // when viewer is true, pause unused consumer
      if( viewer ) {
        for( const item of state.videoConsumers ) {
          if( !_videoEls.current.has( item.producerId ) ) {
            logger.debug('pause video consumer:%s', item.consumerId )
            await appData.roomClient.pauseConsumer( item.consumerId )
          }
        }

        for( const item of state.audioConsumers ) {
          if( !_audioEls.current.has( item.producerId ) ) {
            logger.debug('pause audio consumer:%s', item.consumerId )
            await appData.roomClient.pauseConsumer( item.consumerId )
          }
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ playAudio, state.studio.layout, state.localMedias, state.audioConsumers, state.videoConsumers, state.peers, viewer ])

  useEffect(() => {
    if( state.status !== 'READY' ) return 

    let reqId

    const render = () => {
      _ctx.current.clearRect( 0, 0, state.studio.width, state.studio.height )

      _ctx.current.beginPath()
      _ctx.current.strokeStyle = '#fff'
      state.studio.layout.forEach( ( item, idx ) => {
        const videoProducerId = item.videoProducerId
        const videoEl = _videoEls.current.get( videoProducerId )
        if( videoEl ) {
          const sw = videoEl.videoWidth
          const sh = Math.floor( videoEl.videoWidth * item.height / item.width )
          const sx = 0
          const sy = Math.floor( ( videoEl.videoHeight - sh ) / 2 )

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
      })
      _ctx.current.stroke()

      reqId = requestAnimationFrame( render )
    }

    render()

    return function cleanup(){
      if( reqId ) cancelAnimationFrame( reqId )
      reqId = null
    }
  }, [ state.status, state.studio.layout, state.studio.patternId, state.studio.height, state.studio.width ])

  return (
    <div className="Studio">
      <div className="wrapper" style={ props.style }>
        <canvas ref={ _canvasEl }></canvas>
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