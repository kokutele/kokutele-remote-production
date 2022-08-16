import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "antd";

import { useAppContext } from "../libs/reducer";
import { apiEndpoint } from "../libs/url-factory";

import SwitchMedia from "../components/switch-media";

import { RiVideoAddFill } from 'react-icons/ri'
import { AiFillSetting }  from 'react-icons/ai'
import { MdCancel }       from 'react-icons/md'

import Logger from "../libs/logger";

import './guest.css'

const logger = new Logger('guest')

export default function Guest( props ) {
  const { guestId } = useParams()
  const { state, appData, createRoomClient, joinRoom, createProducer, replaceStream } = useAppContext()

  const [ _roomId, setRoomId ] = useState('')
  const [ _status, setStatus ] = useState('IDLE')
  const [ _deviceId, setDeviceId ] = useState({ video: 'default', audio: 'default' })
  const [ _isSettingVisible, setIsSettingVisible ] = useState( false )
  const _videoEl = useRef()
  const _audioEls = useRef( new Map() )
  const _stream = useRef()

  useEffect( () => {
    fetch( `${apiEndpoint}/roomId/${guestId}` )
      .then( res => res.text() )
      .then( roomId => setRoomId( roomId ))
      .catch( err => { throw err })
  }, [ guestId ])

  useEffect( () => {
    window.parent.postMessage({
      type: 'status',
      value: _status
    }, '*')
  }, [ _status ])

  useEffect( () => {
    if( !_stream.current ) return
    ( async () => {
      logger.debug('deviceId - video:%s, audio:%s', _deviceId.video, _deviceId.audio)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: _deviceId.video }, 
          audio: { deviceId: _deviceId.audio } 
        })
        const audioTrack = stream.getAudioTracks()[0]
        const videoTrack = stream.getVideoTracks()[0]

        const oldAudioTrack = _stream.current.getAudioTracks()[0]
        oldAudioTrack.stop()
        _stream.current.removeTrack( oldAudioTrack )

        const oldVideoTrack = _stream.current.getVideoTracks()[0]
        oldVideoTrack.stop()
        _stream.current.removeTrack( oldVideoTrack )

        _stream.current.addTrack( audioTrack )
        _stream.current.addTrack( videoTrack )

        replaceStream( _stream.current )
      } catch( err ) {
        logger.warn('Error while changing track:%o', err)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _deviceId.video, _deviceId.audio ])

  const handleStartVideoTalk = useCallback( async () => {
    if( _status !== 'IDLE' ) return

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { deviceId: _deviceId.video }, 
      audio: { deviceId: _deviceId.audio } 
    })
    _videoEl.current.muted = true
    _videoEl.current.srcObject = stream

    _videoEl.current.onloadedmetadata = async () => {
      await _videoEl.current.play()

      const displayName = 'guest'
      const peerId = createRoomClient({ roomId: _roomId, displayName })

      joinRoom()
        .then( () => {
          createProducer({ peerId, displayName, stream })
          setStatus('PRODUCING')
        } )
        .catch( err => alert( err.message ))
    }
    _stream.current = stream
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _status, _roomId, _deviceId.video, _deviceId.audio ])

  const handleCancelVideoTalk = useCallback( () => {
    if( _status !== 'PRODUCING' ) return

    const tracks = _stream.current.getTracks()

    for( const track of tracks ) {
      track.stop()
    }
    _stream.current = null

    appData.roomClient.close()
    setStatus('IDLE')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _status ])



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
  
  useEffect(() => {
    state.videoConsumers.forEach( async item => {
      await appData.roomClient.pauseConsumer( item.consumerId )
      logger.debug('videoConsumer - paused:%s', item.consumerId )
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.videoConsumers ])


  return (
    <div className="Guest" style={{position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', background: "#000"}}>
      <div className="wrapper">
        <div className="video-view">
          <video ref={_videoEl} playsInline />
        </div>
        <div className="controller">
          { _status === 'IDLE' && (
          <Button icon={<RiVideoAddFill/>} onClick={ handleStartVideoTalk } type="primary" danger style={{fontWeight: "bold"}}>
            &nbsp;Join
          </Button>
          )}
        </div>
        { _status === 'PRODUCING' && (
        <div>

          <div className="operation">
            <Button
              type="primary"
              onClick={() => {
                setIsSettingVisible( true )
              }}
            >
              <AiFillSetting size={24}/>
            </Button>
            <SwitchMedia 
              deviceId={ _deviceId } 
              setDeviceId={ setDeviceId } 
              visible={ _isSettingVisible }
              setVisible={ setIsSettingVisible }
            />
          </div>
          <div className="cancel">
            <Button
              type='primary'
              onClick={ handleCancelVideoTalk }
              danger
            >
              <MdCancel size={24} />
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}