import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "antd";

import { useAppContext } from "../libs/reducer";
import { apiEndpoint } from "../libs/url-factory";

import { RiVideoAddFill } from 'react-icons/ri'

import './guest.css'

export default function Guest( props ) {
  const { guestId } = useParams()
  const { state, appData, createRoomClient, joinRoom, createProducer } = useAppContext()

  const [ _roomId, setRoomId ] = useState('')
  const _videoEl = useRef()
  const _audioEls = useRef( new Map() )

  useEffect( () => {
    fetch( `${apiEndpoint}/roomId/${encodeURIComponent(guestId)}` )
      .then( res => res.text() )
      .then( roomId => setRoomId( roomId ))
      .catch( err => { throw err })
  }, [ guestId ])

  const handleStartVideoTalk = useCallback( async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    _videoEl.current.muted = true
    _videoEl.current.srcObject = stream

    _videoEl.current.onloadedmetadata = async () => {
      await _videoEl.current.play()

      const displayName = 'guest'
      const peerId = createRoomClient({ roomId: _roomId, displayName })

      joinRoom()
        .then( () => {
          createProducer({ peerId, displayName, stream })
        } )
        .catch( err => alert( err.message ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _roomId ])

  useEffect( () => {
    for( const consumerId of _audioEls.current.keys() ) {
      if( !state.audioConsumers.find( item => item.consumerId === consumerId ) ) {
        const el = _audioEls.current.get( consumerId )
        el.pause()
        el.remove()
        _audioEls.current.delete( consumerId )
        console.log('removed', consumerId )
      }
    }

    state.audioConsumers.forEach( item => {
      const audioConsumerId = item.consumerId
      if( !_audioEls.current.has( audioConsumerId ) ) {
        const el = document.createElement( 'audio' )
        el.playsInline = true
        const track = appData.roomClient.consumers.get( audioConsumerId ).track
        const stream = new MediaStream( [ track ])
        el.srcObject = stream

        _audioEls.current.set( audioConsumerId, el )

        el.onloadedmetadata = async () => {
          await el.play()
          console.log( 'consumerId:%s', audioConsumerId )
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.audioConsumers ])


  return (
    <div className="Guest" style={{position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', background: "#000"}}>
      <div className="wrapper">
        <div className="video-view">
          <video ref={_videoEl} playsInline />
        </div>
        <div className="controller">
          {state.status === 'IDLE' && (
          <Button icon={<RiVideoAddFill/>} onClick={ handleStartVideoTalk } type="primary" danger style={{fontWeight: "bold"}}>
            &nbsp;Join
          </Button>
          )}
        </div>
      </div>
    </div>
  )
}