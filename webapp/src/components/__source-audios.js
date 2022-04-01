import { useEffect, useRef } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'

const logger = new Logger('source-audio')

export default function SourceAudios( props ) {
  const { appData, state } = useAppContext()
  const _audioArea = useRef()

  useEffect( () => {
    logger.debug( 'state.audioConsumers:%o', state.audioConsumers )
    const currentConsumerIds = Array.from( _audioArea.current.childNodes )
      .map( elem => elem.dataset.consumerId )

    const appendIds = state.audioConsumerIds.filter( consumerId => (
      !currentConsumerIds.includes( consumerId )
    ))

    const removeIds = currentConsumerIds.filter( consumerId => (
      !state.audioConsumerIds.includes( consumerId )
    ))

    appendIds.forEach( consumerId => {
      const consumer = appData.roomClient.consumers.get( consumerId )

      if( consumer ) {
        const track = consumer.track
        const stream = new MediaStream( [ track ] )

        const $audio = document.createElement('audio')
        $audio.muted = false
        $audio.dataset.consumerId = consumerId
        $audio.srcObject = stream

        $audio.onloadedmetadata = async () => {
          await $audio.play()
          _audioArea.current.appendChild( $audio )
        }
      }
    })

    removeIds.forEach( consumerId => {
      Array.from( _audioArea.current.childNodes )
        .filter( elem => elem.dataset.consumerId === consumerId )
        .forEach( elem => {
          _audioArea.current.removeChild( elem )
        })
    })

  }, [ state.audioConsumerIds, appData.roomClient.consumers ])
  return (
    <div className="SourceAudios">
      <div className='audio-area' ref={ _audioArea } />
    </div>
  )
}