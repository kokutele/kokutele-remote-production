import { useEffect, useRef } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import './studio.css'

const logger = new Logger('studio')

export default function Studio( props ) {
  const { getStudioLayout, getStudioSize, state, appData } = useAppContext()
  const _canvasEl = useRef()
  const _ctx = useRef()
  const _videoEls = useRef( new Map() )

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
    for( const videoProducerId of _videoEls.current.keys() ) {
      if( !state.studio.layout.find( item => item.videoProducerId === videoProducerId ) ) {
        _videoEls.current.delete( videoProducerId )
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
        videoEl.muted = true

        videoEl.onloadedmetadata = async () => {
          await videoEl.play()
        }

        _videoEls.current.set( item.videoProducerId, videoEl )
      }
    })
  }, [ state.studio.layout, state.videoProducerId, appData ])

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
      if( reqId ) {
        cancelAnimationFrame( reqId )
      }
    }
  }, [ state.status, state.studio.layout, state.studio.height, state.studio.width ])

  return (
    <div className="Studio">
      <canvas ref={ _canvasEl }></canvas>
      {/*
      <div className='debug-studio'>
        <pre>
          {JSON.stringify( state.studio, null, 2 )}
        </pre>
      </div>
    */}
    </div>
  )
}