import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from "../libs/logger"

import './source-video.css'

const logger = new Logger('source-video')

// https://www.schemecolor.com/after-the-searching.php
const videoFrameColors = [
  '#FFA809',
  '#D54E6F',
  '#29317C',
  '#01C6A2',
  '#FDDB01'
]

export default function SourceVideo( props ) {
  const { state, appData, addStudioLayout, deleteStudioLayout, toMainInStudioLayout } = useAppContext()
  const [ _videoWidth , setVideoWidth  ] = useState( 0 )
  const [ _videoHeight, setVideoHeight ] = useState( 0 )
  const [ _layoutIdx, setLayoutIdx ] = useState( -1 )

  const {
    id, displayName, audioConsumerId, audioProducerId, videoConsumerId, videoProducerId, localStreamId, mediaId, idx 
  } = props

  const {
    roomClient, localStreams
  } = appData

  const _wrapperEl = useRef( null )
  const _videoEl = useRef( null )

  // when video is clicked, toggle adding or deleting from studio layout.
  const handleClick = useCallback( () => {
    if( !videoProducerId ) {
      logger.warn( 'Meida not ready yet' )
    } else {
      if( 
        !state.studio.layout
          .find( item => ( 
            item.peerId === id && 
            item.audioProducerId === audioProducerId && 
            item.videoProducerId === videoProducerId 
          )) 
      ) {
        addStudioLayout({ 
          peerId: id, 
          audioProducerId, 
          videoProducerId,
          mediaId,
          videoWidth: _videoWidth,
          videoHeight: _videoHeight
        })
      } else {
        deleteStudioLayout( {
          peerId: id, 
          audioProducerId,
          videoProducerId,
          mediaId
        })
        setLayoutIdx( -1 )
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ audioProducerId, videoProducerId, mediaId, _videoWidth, _videoHeight, state.studio.layout ])

  // when audioConsumerId and videoConsumerId got, we will render video for it.
  //
  // todo - for iOS, need to consider about autoPlay policy.
  useEffect( () => {
    let audioTrack, videoTrack

    if( _videoEl.current ) {
      const stream = new MediaStream()

      if( localStreamId ) {
        audioTrack = localStreams.get( localStreamId ).getAudioTracks()[0]
        videoTrack = localStreams.get( localStreamId ).getVideoTracks()[0]
        logger.debug( 'audioTrack:%o, videoTrack:%o', audioTrack, videoTrack )
        _videoEl.current.muted = true
      } else {
        audioTrack = audioConsumerId ? roomClient.consumers.get( audioConsumerId ).track : null
        videoTrack = videoConsumerId ? roomClient.consumers.get( videoConsumerId ).track : null
      }

      if( videoTrack ) {
        if( audioTrack ) stream.addTrack( audioTrack )
        if( videoTrack ) stream.addTrack( videoTrack )

        _videoEl.current.srcObject = stream
        _videoEl.current.playsInline = true
        _videoEl.current.onloadedmetadata = async () => {
          const videoWidth = _videoEl.current.videoWidth
          const videoHeight = _videoEl.current.videoHeight

          setVideoWidth( videoWidth )
          setVideoHeight( videoHeight )

          logger.debug('videoWidth: %d, videoHeight: %d', videoWidth, videoHeight )

          await _videoEl.current.play()
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ audioConsumerId, videoConsumerId, localStreamId ])

  // draw boder for video which is including in studio layout.
  useEffect( () => {
    if( state.status !== 'READY' ) return

    // check if video and audio is included in studio layout
    const obj = state.studio.layout.find( item => (
      item.videoProducerId === videoProducerId && item.audioProducerId === audioProducerId 
    ))

    // when they are included, we will draw border with color, otherwise with white.
    if( obj ) {
      const layoutIdx = state.studio.layout.indexOf( obj )
      setLayoutIdx( layoutIdx )
      _wrapperEl.current.style.border = `3px solid ${videoFrameColors[ layoutIdx % videoFrameColors.length ]}`
    } else {
      _wrapperEl.current.style.border = '3px solid #fff'
    }
  }, [ state.status, state.studio.layout, audioProducerId, videoProducerId ])

  return (
    <div className="SourceVideo">
      <div className="videoWrapper" ref={ _wrapperEl }>
        <video ref={ _videoEl } onClick={handleClick} className={ idx === 0 ? 'mycam' : 'other' } />
        { _layoutIdx > -1 && (
        <div 
          className="layout-num" 
          style={{background: `${videoFrameColors[ _layoutIdx % videoFrameColors.length ]}`}}
          onClick={() => {
            if( _layoutIdx !== 0 ) {
              toMainInStudioLayout( _layoutIdx )
            }
          }}
        >{_layoutIdx === 0 ? "Main" : `Sub-${_layoutIdx}`}</div>
        )}
        <div className="meta">
          {displayName}
        </div>
      </div>
    </div>
  )
}