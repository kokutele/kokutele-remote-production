import { useEffect, useRef } from 'react'
import { Alert } from 'antd'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import './studio.css'

const logger = new Logger('studio')

export default function Studio( props ) {
  const { 
    getStudioLayout, 
    getStudioSize, 
    state, 
    appData 
  } = useAppContext()

  const { playAudio, hideAlert } = props
  const _canvasEl = useRef()
  const _ctx = useRef()
  const _videoEls = useRef( new Map() )
  const _audioEls = useRef( new Map() )

  useEffect( () => {
    logger.debug( state.status )
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
    for( const videoProducerId of _videoEls.current.keys() ) {
      if( !state.studio.layout
        .filter( item => ( item.width !== 0 && item.height !== 0 ))
        .find( item => item.videoProducerId === videoProducerId ) 
      ) {
        const videoElem = _videoEls.current.get( videoProducerId )
        videoElem.pause()
        videoElem.remove()
        _videoEls.current.delete(videoProducerId)
      }
    }

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

    state.studio.layout
      .filter( item => ( item.width !== 0 && item.height !== 0 ))
      .forEach( item => {
      if( !_videoEls.current.has( item.videoProducerId ) ) {
        const localMedia = state.localMedias.find( media => media.videoProducerId === item.videoProducerId )
        logger.debug( 'consumers:%o', appData.roomClient.consumers )
        setTimeout( () => {
          logger.debug( 'consumers:%o', appData.roomClient.consumers )
        }, 1000 )
        const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.videoProducerId )

        let stream
        if( localMedia ) {
          stream = appData.localStreams.get( localMedia.localStreamId )
        } else {
          if( !consumer ) {
            logger.warn('no consumer found for %s', item.videoProducerId )
            return
          } else {
            const track = consumer.track
            stream = new MediaStream( [ track ] )
          }
        }

        const videoEl = document.createElement( 'video' )
        videoEl.srcObject = stream
        videoEl.muted = true

        videoEl.onloadedmetadata = async () => {
          await videoEl.play()
        }

        _videoEls.current.set( item.videoProducerId, videoEl )
      }
    
      if( playAudio ) {
        if( !_audioEls.current.has( item.audioProducerId ) ) {
          const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.audioProducerId )

          if( !consumer ) {
            logger.warn('no consumer found for %s', item.audioProducerId )
            return
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
    })
  }, [ playAudio, state.studio.layout, state.localMedias, state.audioConsumers, state.videoConsumers, state.peers, appData ])

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
          // _ctx.current.drawImage( videoEl, item.posX, item.posY, item.width, item.height )
          const height = item.height
          const width = Math.floor( videoEl.videoWidth * height / videoEl.videoHeight )
          const posY = item.posY
          const posX = item.posX + Math.floor(( item.width - width ) / 2 )

          _ctx.current.drawImage( videoEl, posX, posY, width, height )
          if( state.studio.patternId > 1 && idx > 0 ) {
            _ctx.current.rect( posX, posY, width, height )
          }
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