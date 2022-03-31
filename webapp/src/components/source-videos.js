import { useEffect, useRef } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'

const logger = new Logger('source-video')

export default function SourceVideos( props ) {
  const { appData, state } = useAppContext()
  const _videoArea = useRef()

  useEffect( () => {
    if( state.status === 'READY' ) {
      const $video = document.createElement('video')
      $video.playsInline = true
      $video.muted = true
      $video.dataset.consumerId = 'my-video'
      $video.srcObject = appData.myStream
      $video.onclick = ev => {
        alert( ev.target.dataset.consumerId )
      }

      $video.onloadedmetadata = async () => {
        await $video.play()
        _videoArea.current.appendChild( $video )
      }
    }
  }, [ state.status, appData.myStream ])

  useEffect( () => {
    logger.debug( 'state.videoConsumers:%o', state.videoConsumers )
    const currentConsumerIds = Array.from( _videoArea.current.childNodes )
      .map( elem => elem.dataset.consumerId )
      .filter( id => id !== 'my-video' )

    const appendIds = state.videoConsumers.filter( consumerId => (
      !currentConsumerIds.includes( consumerId )
    ))

    const removeIds = currentConsumerIds.filter( consumerId => (
      !state.videoConsumers.includes( consumerId )
    ))

    appendIds.forEach( consumerId => {
      const consumer = appData.roomClient.consumers.get( consumerId )

      if( consumer ) {
        const track = consumer.track
        const stream = new MediaStream( [ track ] )

        const $video = document.createElement('video')
        $video.playsInline = true
        $video.muted = true
        $video.dataset.consumerId = consumerId
        $video.srcObject = stream
        $video.onclick = ev => {
          alert( ev.target.dataset.consumerId )
        }

        $video.onloadedmetadata = async () => {
          await $video.play()
          _videoArea.current.appendChild( $video )
        }
      }
    })

    removeIds.forEach( consumerId => {
      Array.from( _videoArea.current.childNodes )
        .filter( elem => elem.dataset.consumerId === consumerId )
        .forEach( elem => {
          _videoArea.current.removeChild( elem )
        })
    })

  }, [ state.videoConsumers, appData.roomClient.consumers ])
  return (
    <div className="SourceVideos">
      <div className='video-area' ref={ _videoArea } />
    </div>
  )
}