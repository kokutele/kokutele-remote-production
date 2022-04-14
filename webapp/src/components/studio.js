import { useEffect, useRef } from 'react'
import { Alert } from 'antd'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import './studio.css'

const logger = new Logger('studio')

export default function Studio( props ) {
  const { getStudioLayout, getStudioSize, state, appData } = useAppContext()
  const { playAudio } = props
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
      if( !state.studio.layout.find( item => item.videoProducerId === videoProducerId ) ) {
        _videoEls.current.delete( videoProducerId )
      }
    }

    for( const audioProducerId of _audioEls.current.keys() ) {
      if( !state.studio.layout.find( item => item.audioProducerId === audioProducerId ) ) {
        _audioEls.current.delete( audioProducerId )
      }
    }

    state.studio.layout.forEach( item => {
      if( !_videoEls.current.has( item.videoProducerId ) ) {
        const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.videoProducerId )

        let stream
        if( item.videoProducerId === state.videoProducerId ) {
          stream = appData.myStream
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
        videoEl.muted = !playAudio

        videoEl.onloadedmetadata = async () => {
          await videoEl.play()
        }

        _videoEls.current.set( item.videoProducerId, videoEl )
      }
    
      if( playAudio ) {
        if( !_audioEls.current.has( item.audioProducerId ) ) {
          const consumer = Array.from( appData.roomClient.consumers.values() ).find( consumer => consumer.producerId === item.audioProducerId )

          let stream
          if( item.audioProducerId !== state.audioProducerId ) {
            if( !consumer ) {
              logger.warn('no consumer found for %s', item.audioProducerId )
              return
            } else {
              const track = consumer.track
              stream = new MediaStream( [ track ] )
            }
          }

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
  }, [ playAudio, state.studio.layout, state.videoProducerId, state.audioProducerId, state.peers, appData ])

  useEffect(() => {
    if( state.status !== 'READY' ) return 

    let reqId

    const render = () => {
      _ctx.current.clearRect( 0, 0, state.studio.width, state.studio.height )
      state.studio.layout.forEach( item => {
        const videoProducerId = item.videoProducerId
        const videoEl = _videoEls.current.get( videoProducerId )
        if( videoEl ) {
          _ctx.current.drawImage( videoEl, item.posX, item.posY, item.width, item.height )
        }
      })

      reqId = requestAnimationFrame( render )
    }

    render()

    return function cleanup(){
      if( reqId ) cancelAnimationFrame( reqId )
      reqId = null
    }
  }, [ state.status, state.studio.layout, state.studio.height, state.studio.width ])

  return (
    <div className="Studio">
      <div className="wrapper" style={ props.style }>
        <canvas ref={ _canvasEl }></canvas>
        { state.studio.layout.length === 0 && (
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