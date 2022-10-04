import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "antd";

import { useAppContext } from "../libs/reducer";
import { apiEndpoint } from "../libs/url-factory";

import SwitchMedia from "../components/switch-media";

import { RiVideoAddFill } from 'react-icons/ri'
import { AiFillSetting }  from 'react-icons/ai'
import { MdCancel }       from 'react-icons/md'
//import { MdVolumeUp, MdVolumeOff } from 'react-icons/md'
import { BsMicFill, BsMicMuteFill } from 'react-icons/bs'

import Logger from "../libs/logger";

import './guest.css'

const logger = new Logger('guest')

export default function Guest( props ) {
  const { guestId } = useParams()
  const { state, appData, createRoomClient, joinRoom, createProducer, deleteProducer } = useAppContext()

  const [ _roomId, setRoomId ] = useState('')
  const [ _status, setStatus ] = useState('IDLE')
  const [ _deviceId, setDeviceId ] = useState({ video: 'default', audio: 'default' })
  const [ _localStreamId, setLocalStreamId ] = useState()
  const [ _isSettingVisible, setIsSettingVisible ] = useState( false )
  const [ _muted, setMuted ] = useState( true )
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

  
  const handleStartVideoTalk = useCallback( async ( videoDeviceId = 'default', audioDeviceId = 'default' ) => {
    logger.debug('handleStartVideoTalk - %s', _localStreamId )

    setMuted( false )

    if( _localStreamId ) {
      const localMedia = state.localMedias.find( item => item.localStreamId === _localStreamId )
      await deleteProducer( localMedia )

      if( _stream.current ) {
        const tracks = _stream.current.getTracks()

        for( const track of tracks ) {
          track.stop()
        }
        _stream.current = null
      }
    }

    if( _stream.current ) return

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { deviceId: videoDeviceId }, 
      audio: { deviceId: audioDeviceId } 
    })
    _videoEl.current.muted = true
    _videoEl.current.srcObject = stream

    const audioTrack = stream.getAudioTracks()[0]
    if( audioTrack ) audioTrack.enabled = false

    _videoEl.current.onloadedmetadata = async () => {
      await _videoEl.current.play()

      const displayName = 'guest'
      const peerId = createRoomClient({ roomId: _roomId, displayName })

      joinRoom()
        .then( async () => {
          const localStreamId = await createProducer({ peerId, displayName, stream })
          setLocalStreamId( localStreamId )
          setStatus('PRODUCING')
        } )
        .catch( err => alert( err.message ))
    }
    _stream.current = stream
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _roomId, _localStreamId ])

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
    if( !_stream.current ) return

    const audioTrack = _stream.current.getAudioTracks()[0]
    if( audioTrack ) audioTrack.enabled = !_muted
  }, [_muted])



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
      if( !_audioEls.current.has( audioConsumerId ) && appData.roomClient.consumers.has( audioConsumerId ) ) {
        const el = document.createElement( 'audio' )
        el.playsInline = true
        const track = appData.roomClient.consumers.get( audioConsumerId ).track
        const stream = new MediaStream( [ track ])
        el.srcObject = stream

        _audioEls.current.set( audioConsumerId, el )

        el.onloadedmetadata = async () => {
          await el.play()
          logger.debug( 'consumerId:%s', audioConsumerId )
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.audioConsumers ])
  
  useEffect(() => {
    state.videoConsumers.forEach( async item => {
      if( appData.roomClient.consumers.has( item.consumerId )) {
        await appData.roomClient.pauseConsumer( item.consumerId )
        logger.debug('videoConsumer - paused:%s', item.consumerId )
      }
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
              handleStartVideoTalk={ ( _videoId, _audioId ) => {
                handleCancelVideoTalk()
                handleStartVideoTalk( _videoId, _audioId )
              }}
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
          <div className='mute'>
            <Button
              type='link'
              danger={ _muted ? true : false }
              shape='circle'
              size="large"
              style={{ coloe: '#fff', fontSize: '1em' }}
              onClick={ () => setMuted( !_muted ) }
            >
              { _muted ? <BsMicMuteFill /> : <BsMicFill /> }
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}