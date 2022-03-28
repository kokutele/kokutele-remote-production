import { useCallback, useRef, useState } from 'react'
import { Alert, Button } from 'antd'
import pokemon from 'pokemon'
import RoomClient from '../libs/room-client'
import Logger from '../libs/logger'

import './room.css'

const logger = new Logger('Room')

export default function Room( props ) {
  const [ _status, setStatus ] = useState('IDLE')
  const [ _errMessage, setErrMessage ] = useState('')
  const [ _peerId, setPeerId ] = useState('')
  const [ _displayName, setDisplayName ] = useState( pokemon.random() )
  const _myVideo = useRef()
  
  const handleStart = useCallback( async () => {
    setStatus('INITIALIZING')
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    const client = RoomClient.create({ stream, displayName: _displayName })
    setPeerId( client.peerId )
    logger.debug("client created:%o", client )

    _myVideo.current.srcObject = stream
    _myVideo.current.onloadedmetadata = async () => {
      await _myVideo.current.play()

      await client.join()
        .catch( err => setErrMessage( err.message ))
      logger.debug("joined room")
    }

    setStatus('READY')
  }, [ _displayName ])

  return (
    <div className='Room'>
      { _errMessage !== '' && (
        <Alert type="error" closable showIcon message={ _errMessage } />
      )}
      <div>
        displayName: { _displayName }, peerId: { _peerId }, status: { _status }
      </div>
      { _status === 'IDLE' && (
        <div>
          <Button type="primary" onClick={ handleStart }>start</Button>
        </div>
      )}
      <div className='my-video'>
        <video ref={ _myVideo } playsInline/>
      </div>
    </div>
  )
}