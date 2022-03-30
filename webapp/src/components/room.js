import { useCallback, useRef, useState } from 'react'
import { Alert, Button, Typography } from 'antd'
import pokemon from 'pokemon'
import RoomClient from '../libs/room-client'
import Logger from '../libs/logger'

import './room.css'

const { Title } = Typography
const logger = new Logger('Room')

export default function Room( props ) {
  const [ _status, setStatus ] = useState('IDLE')
  const [ _peers, setPeers ] = useState( [] )
  const [ _errMessage, setErrMessage ] = useState('')
  const [ _peerId, setPeerId ] = useState('')
  const [ _displayName, setDisplayName ] = useState( pokemon.random() )
  const _myVideo = useRef()
  const _remoteVideos = useRef()
    , _remoteAudios = useRef()
  
  const handleStart = useCallback( async () => {
    setStatus('INITIALIZING')
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    const client = RoomClient.create({ stream, displayName: _displayName })
    setPeerId( client.peerId )
    logger.debug("client created:%o", client )

    _myVideo.current.srcObject = stream
    _myVideo.current.onloadedmetadata = async () => {
      await _myVideo.current.play()

      client.on("joined", peers => {
        setPeers( peers )
      })

      client.on( "newPeer", peer => {
        setPeers( peers => [ ...peers, peer ] )
      })

      client.on( "peerClosed", peerId => {
        setPeers( peers => peers.filter( peer => peer.id !== peerId ))
      })

      client.on( "newConsumer", consumer => {
        logger.debug( "newConsumer:%o", consumer )
        const track = consumer.consumer.track
        const stream = new MediaStream( [ track ] )

        logger.debug( "newConsumer - track:%o, stream:%o", track, stream )
        logger.debug( "newConsumer - check track:%o", stream.getTracks() )

        switch( consumer.kind ) {
          case 'audio': {
            const elem = document.createElement('audio')
            elem.playsInline = true
            elem.srcObject = stream
            _remoteAudios.current.appendChild( elem )

            elem.onloadedmetadata = async () => {
              await elem.play()
            }

            break
          }
          case 'video': {
            const elem = document.createElement('video')
            elem.playsInline = true
            elem.srcObject= stream
            _remoteVideos.current.appendChild( elem )

            elem.onloadedmetadata = async () => {
              await elem.play()
            }

            break
          }
          default: {
            logger.warn( "newConsumer - unknown consumer type:%s", consumer.kind)
          }
        }
      })

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
        <video ref={ _myVideo } playsInline muted/>
      </div>
      <div className='remote-videos' ref={ _remoteVideos }></div>
      <div className='remote-audios' ref={ _remoteAudios }></div>
      <div>
        <Title level={5}>peers</Title>
        <div>
          <pre>{JSON.stringify( _peers, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}