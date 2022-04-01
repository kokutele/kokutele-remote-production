import { useEffect, useRef } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'

import './source-videos.css'

const logger = new Logger('source-video')

export default function SourceVideos( props ) {
  const { appData, state } = useAppContext()
  const _videoArea = useRef()

  useEffect( () => {
    if( state.status === 'READY' ) {
      const $div = document.createElement('div')
      $div.dataset.peerId          = state.peerId
      $div.dataset.audioConsumerId = 'my-audio'
      $div.dataset.videoConsumerId = 'my-video'
      $div.dataset.audioProducerId = state.audioProducerId
      $div.dataset.videoProducerId = state.videoProducerId
      $div.style.position = 'relative'
      $div.style.width = '240px'
      $div.style.aspectRatio = 'calc( 16 / 9 )'
      // $div.style.textAlign = 'center'
      $div.style.background = '#000'
      $div.onclick = ev => {
        alert( ev.target.dataset.peerId)
      }
 
      const $video = document.createElement('video')
      $video.playsInline = true
      $video.muted = true
      $video.srcObject = appData.myStream
      // $video.style.position = 'absolute'
      $video.style.height = '100%'
      $video.style.margin = '0 auto'

      $video.onloadedmetadata = async () => {
        await $video.play()
      }
      $div.appendChild( $video )
      
      const $displayName = document.createElement('div')
      $displayName.style.background = '#00f'
      $displayName.style.color = '#fff'
      $displayName.style.fontWeight = 'bold'
      $displayName.style.position = 'absolute'
      $displayName.textContent = state.displayName
      $div.appendChild( $displayName )

      _videoArea.current.appendChild( $div )
    }
  }, [ state.status, appData.myStream ])

  useEffect( () => {
    logger.debug( 'state.videoConsumers:%o', state.videoConsumerIds )
    const currentConsumerIds = Array.from( _videoArea.current.childNodes )
      .map( elem => elem.dataset.consumerId )
      .filter( id => id !== 'my-video' )

    const appendIds = state.videoConsumerIds.filter( consumerId => (
      !currentConsumerIds.includes( consumerId )
    ))

    const removeIds = currentConsumerIds.filter( consumerId => (
      !state.videoConsumerIds.includes( consumerId )
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

  }, [ state.videoConsumerIds, appData.roomClient.consumers ])
  return (
    <div className="SourceVideos">
      <div className='video-area' ref={ _videoArea } />
    </div>
  )
}