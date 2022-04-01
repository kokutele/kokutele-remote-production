import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from "../libs/logger"

import './source-video.css'

const logger = new Logger('source-video')

export default function SourceVideo( props ) {
  const { state, appData, addProductionLayout, leaveProductionLayout } = useAppContext()
  const [ _videoWidth , setVideoWidth  ] = useState( 0 )
  const [ _videoHeight, setVideoHeight ] = useState( 0 )

  const {
    id, displayName, audioConsumerId, audioProducerId, videoConsumerId, videoProducerId,
  } = props

  const {
    roomClient, myStream
  } = appData

  const _videoEl = useRef( null )

  const handleClick = useCallback( () => {
    if( !audioProducerId || !videoProducerId ) {
      logger.warn( 'Meida not ready yet' )
    } else {
      if( 
        !state.productionLayout
          .find( item => ( 
            item.peerId === id && 
            item.audioProducerId === audioProducerId && 
            item.videoProducerId === videoProducerId 
          )) 
      ) {
        addProductionLayout({ 
          peerId: id, 
          audioProducerId, 
          videoProducerId,
          videoWidth: _videoWidth,
          videoHeight: _videoHeight
        })
      } else {
        leaveProductionLayout( {
          peerId: id, 
          audioProducerId,
          videoProducerId
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ audioProducerId, videoProducerId, _videoWidth, _videoHeight, state.productionLayout ])

  useEffect( () => {
    let stream

    if( _videoEl.current && myStream ) {
      if( _videoEl.current.srcObject ) {
        stream = _videoEl.current.srcObject
      } else {
        stream = new MediaStream()
        _videoEl.current.srcObject = stream
      }

      if( !!audioConsumerId ) {
        if( audioConsumerId === 'my-audio' ) {
          const audioTrack = myStream.getAudioTracks()[0]
          _videoEl.current.muted = true
          stream.addTrack( audioTrack )
        } else {
          const audioTrack = roomClient.consumers.get( audioConsumerId ).track
          stream.addTrack( audioTrack )
        }
      }

      if( !!videoConsumerId ) {
        const videoTrack = videoConsumerId === 'my-video' ?
          myStream.getVideoTracks()[0] :
          roomClient.consumers.get( videoConsumerId ).track
        stream.addTrack( videoTrack )
      }

      _videoEl.current.onloadedmetadata = async () => {
        if( videoConsumerId ) {
          const videoWidth = _videoEl.current.videoWidth
          const videoHeight = _videoEl.current.videoHeight

          setVideoWidth( videoWidth )
          setVideoHeight( videoHeight )

          logger.debug('videoWidth: %d, videoHeight: %d', videoWidth, videoHeight )
        }
        await _videoEl.current.play()
      }
    }
  }, [ audioConsumerId, videoConsumerId, roomClient.consumers, myStream ])

  logger.debug( 'props: %o', props )
  return (
    <div className="SourceVideo">
      <div className="videoWrapper">
        <video ref={ _videoEl } onClick={handleClick} />
        <div className="meta">
          {displayName}
        </div>
      </div>
    </div>
  )
}