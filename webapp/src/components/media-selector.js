import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Input, Row, Select } from 'antd'
// import AudioStreamMeter from 'audio-stream-meter'
import pokemon from 'pokemon'


import Logger from '../libs/logger'

import './media-selector.css'

const { Option } = Select
const logger = new Logger('media-selector')

// const AudioContext = window.AudioContext || window.webkitAudioContext

export default function MediaSelector(props) {
  const { setStream } = props

  const [ _videoDevices, setVideoDevices ] = useState( [] )
  const [ _audioDevices, setAudioDevices ] = useState( [] )
  // const [ _volume, setVolume ] = useState( 0 )
  const [ _displayName, setDisplayName ] = useState( pokemon.random() )

  const _videoEl = useRef()
  const _stream = useRef()
  // const _meter = useRef( null )

  // const updateAudioMeter = useCallback( () => {
    // if( !_stream.current ) return

    // if( _meter.current ) {
    //   _meter.current.close.bind( _meter.current )
    // }

    // const audioContext = new AudioContext()

    // const audioStream = audioContext.createMediaStreamSource( _stream.current )
    // _meter.current = AudioStreamMeter.audioStreamProcessor( audioContext, () => {
    //   setVolume( Math.trunc( _meter.current.volume * 100 ))
    // })

    // audioStream.connect( _meter.current )
  // }, [])



  useEffect( () => {
    ( async () => {
      const stream = await navigator.mediaDevices.getUserMedia( { video: true, audio: true } )

      _videoEl.current.srcObject = stream

      _videoEl.current.onloadedmetadata = async () => {
        await _videoEl.current.play()

        const list = await navigator.mediaDevices.enumerateDevices()

        setVideoDevices( list.filter( item => item.kind === 'videoinput' ))
        setAudioDevices( list.filter( item => item.kind === 'audioinput' ))
      }
      _stream.current = stream

      setStream( _stream.current, '', false )
      // updateAudioMeter()
    })()

    // return function cleanup() {
    //   if( _meter.current ) {
    //     logger.debug( 'cleanup - close audio meter')
    //     _meter.current.close.bind( _meter.current )
    //   }
    // }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClick = useCallback( () => {
    logger.debug('handleClick - displayName:%s', _displayName )
    setStream( _stream.current, _displayName, true )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ _displayName ])

  const handleVideoChange = useCallback( async deviceId => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId }, audio: false })
    const track = stream.getVideoTracks()[0]

    const oldTrack = _stream.current.getVideoTracks()[0]
    oldTrack.stop()
    _stream.current.removeTrack( oldTrack )

    _stream.current.addTrack( track )

    // updateAudioMeter()
  }, [] )

  const handleAudioChange = useCallback( async deviceId => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: { deviceId } })
    const track = stream.getAudioTracks()[0]

    const oldTrack = _stream.current.getAudioTracks()[0]
    oldTrack.stop()
    _stream.current.removeTrack( oldTrack )

    _stream.current.addTrack( track )

    // updateAudioMeter()
  }, [] )


  return (
    <div className="MediaSelector">
      <div className="container">
        <div className="wrapper" style={{marginTop: "10vh"}}>
          <Row>
            <Col offset={3} span={18}>
              <Card title="Virtual studio: check webcam">
                <Row gutter={16}>
                  <Col span={14}>
                    <div className='video-wrapper'>
                      <video ref={ _videoEl } muted />
                    </div>
                  </Col>
                  <Col span={10}>
                    video:<br/>
                    <Select defaultValue="default" style={{ width: "100%"}} onChange={ handleVideoChange }>
                      { _videoDevices.map( ( item , idx ) => (
                        <Option key={idx} value={item.deviceId}>{item.label}</Option>
                      ))}
                    </Select><br/>
                    audio:<br/>
                    <Select defaultValue="default" style={{ width: "100%"}} onChange={ handleAudioChange }>
                      { _audioDevices.map( ( item, idx ) => (
                        <Option key={idx} value={item.deviceId}>{item.label}</Option>
                      ))}
                    </Select><br/>
                    {/*
                    <Progress percent={ _volume } showInfo={false} strokeColor={ _volume < 80 ? 'green' : 'red' } />
                    */}
                    displayName:<br/>
                    <Input value={ _displayName } onChange={ e => setDisplayName( e.target.value ) } />
                  </Col>
                </Row>
                <div style={{ marginTop: "11.5px", textAlign: "center" }}>
                  <Row gutter={16}>
                    <Col span={12} style={{ textAlign: "right" }}>
                      Are you ready?
                    </Col>
                    <Col span={12} style={{ textAlign: "left" }}>
                      <Button type="primary" onClick={ handleClick }>Yes, I'm ready</Button>
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