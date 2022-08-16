import { useEffect, useState } from 'react'
import { Modal, Select } from 'antd'

import { FaMicrophone, FaVideo } from 'react-icons/fa'

const { Option } = Select

export default function SwitchMedia( props ) {
  const { deviceId, setDeviceId, setVisible, visible } = props

  const [ _videoId, setVideoId ] = useState( deviceId.video )
  const [ _audioId, setAudioId ] = useState( deviceId.audio )
  const [ _videoDevices, setVideoDevices ] = useState([])
  const [ _audioDevices, setAudioDevices ] = useState([])


  useEffect( () => {
    ( async () => {
      const list = await navigator.mediaDevices.enumerateDevices()
      console.log( list )

      setVideoDevices( list.filter( item => item.kind === 'videoinput') )
      setAudioDevices( list.filter( item => item.kind === 'audioinput') )
    })()
  }, [])

  return (
    <Modal
      style={{ top: 20 }}
      zIndex={1002}
      visible={visible}
      title="settings"
      onOk={ () => {
        setDeviceId({ video: _videoId, audio: _audioId })
        setVisible( false )
      }}
      onCancel={ () => setVisible( false )}
    >
      <div>
        <FaVideo />&nbsp;
        <Select style={{ width: "70%"}} value={_videoId} onChange={ val => setVideoId( val )}>
          { _videoDevices.map( ( item, idx ) => (
            <Option key={idx} value={item.deviceId}>{item.label}</Option>
          ))}
        </Select>
      </div>
      <div>
        <FaMicrophone />&nbsp;
        <Select style={{ width: "70%"}} value={_audioId} onChange={ val => setAudioId( val )}>
          { _audioDevices.map( ( item, idx ) => (
            <Option key={idx} value={item.deviceId}>{item.label}</Option>
          ))}
        </Select>
      </div>
    </Modal>
  )
}