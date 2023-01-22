import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Input, Row, Select, Switch } from 'antd'
// import AudioStreamMeter from 'audio-stream-meter'
import pokemon from 'pokemon'


import './media-selector.css'

const { Option } = Select

export default function MediaSelector(props) {
  const { setStream } = props

  const [ _isReady, setIsReady ] = useState( false )
  const [ _useMedia, setUseMedia ] = useState( true )
  const [ _videoDevices, setVideoDevices ] = useState( [] )
  const [ _audioDevices, setAudioDevices ] = useState( [] )
  const [ _errMessage, setErrMessage ] = useState( '' )
  const [ _displayName, setDisplayName ] = useState( pokemon.random() )

  const _videoEl = useRef()
  const _stream = useRef()

  useEffect( () => {
    ( async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia( { video: true, audio: true } )

        _videoEl.current.srcObject = stream

        _videoEl.current.onloadedmetadata = async () => {
          try {
            await _videoEl.current.play()
            setIsReady( true )

            const list = await navigator.mediaDevices.enumerateDevices()

            setVideoDevices( list.filter( item => item.kind === 'videoinput' ))
            setAudioDevices( list.filter( item => item.kind === 'audioinput' ))
          } catch( err ) {
            setErrMessage( err.message )
          }
        }
        _stream.current = stream

        setStream( _stream.current, '', false )
      } catch( err ) {
        setErrMessage('permission for accessing webcam denied. check your browser setting')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClick = useCallback( () => {
    if( _useMedia ) {
      setStream( _stream.current, _displayName, true )
    } else {
      if( _stream.current && _stream.current instanceof MediaStream ) {
        const tracks = _stream.current.getTracks()
        for( let t of tracks ) {
          t.stop()
        }
        _stream.current = null
      }
      setStream( null, _displayName, true )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _displayName, _useMedia ])

  const handleVideoChange = useCallback( async deviceId => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId }, audio: false })
      const track = stream.getVideoTracks()[0]

      const oldTrack = _stream.current.getVideoTracks()[0]
      oldTrack.stop()
      _stream.current.removeTrack( oldTrack )

      _stream.current.addTrack( track )

      setErrMessage( '' )
    } catch( err ) {
      setErrMessage('permission for accessing webcam denied. check your browser setting')
    }
  }, [] )

  const handleAudioChange = useCallback( async deviceId => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: { deviceId } })
      const track = stream.getAudioTracks()[0]

      const oldTrack = _stream.current.getAudioTracks()[0]
      oldTrack.stop()
      _stream.current.removeTrack( oldTrack )

      _stream.current.addTrack( track )
    } catch( err ) {
      setErrMessage('permission for accessing microphone denied. check your browser setting')
    }
  }, [] )


  return (
    <div className="MediaSelector">
      <div className="container">
        <div className="wrapper" style={{marginTop: "10vh"}}>
          <Row>
            <Col offset={3} span={18}>
              <Card title={(
                <>
                  Virtual studio: check webcam<br/>
                  <div style={{ textAlign: "right" }}>
                  use cam&nbsp;<Switch checked={_useMedia} onChange={setUseMedia} />
                  </div>
                </>
              )}>
                  { ( _useMedia && _errMessage !== '' ) && (
                    <Alert type="error" message={_errMessage} showIcon />
                  )}
                  <Row gutter={16}>
                    <Col span={14}>
                      <div style={{ visibility: _useMedia ? 'visible': 'hidden' }}>
                        <div className='video-wrapper'>
                          <video ref={ _videoEl } muted playsInline />
                        </div>
                      </div>
                    </Col>
                    <Col span={10}>
                      video:<br/>
                      <Select disabled={!_useMedia} defaultValue="default" style={{ width: "100%"}} onChange={ handleVideoChange }>
                        { _videoDevices.map( ( item , idx ) => (
                          <Option key={idx} value={item.deviceId}>{item.label}</Option>
                        ))}
                      </Select><br/>
                      audio:<br/>
                      <Select disabled={!_useMedia} defaultValue="default" style={{ width: "100%"}} onChange={ handleAudioChange }>
                        { _audioDevices.map( ( item, idx ) => (
                          <Option key={idx} value={item.deviceId}>{item.label}</Option>
                        ))}
                      </Select><br/>
                      {/*
                      <Progress percent={ _volume } showInfo={false} strokeColor={ _volume < 80 ? 'green' : 'red' } />
                      */}
                      displayName:<br/>
                      <Input disabled={!_useMedia} value={ _displayName } onChange={ e => setDisplayName( e.target.value ) } />
                    </Col>
                  </Row>
                <div style={{ marginTop: "11.5px", textAlign: "center" }}>
                  <Row gutter={16}>
                    <Col span={12} style={{ textAlign: "right" }}>
                      Are you ready?
                    </Col>
                    <Col span={12} style={{ textAlign: "left" }}>
                      <Button type="primary" onClick={ handleClick } disabled={ !_isReady || !!_errMessage }>Yes, I'm ready</Button>
                    </Col>
                  </Row>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}