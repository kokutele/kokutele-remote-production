import { useEffect, useState } from 'react'
import { Alert, Divider } from 'antd'

import Studio from './studio'
import StudioPatterns from './studio-patterns'
import Sources from './sources'

import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'


import './room.css'

const logger = new Logger('Room')
const showDebug = process.env.NODE_ENV === 'development'

export default function Room( props ) {
  const { appData, state, createRoomClient, joinRoom, createProducer, close } = useAppContext()
  const [ _errMessage, setErrMessage ] = useState('')
  const { displayName, stream, roomId } = props
  
  useEffect( () => {
    const peerId = createRoomClient({ displayName, roomId })

    logger.debug("client created:%o", appData.roomClient )

    joinRoom()
      .then( () => {
        createProducer({ peerId, displayName, stream })
      } )
      .catch( err => setErrMessage( err.message ))

    return function cleanup() {
      close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ displayName, roomId ])

  return (
    <div className='Room'>
      { _errMessage !== '' && (
        <Alert type="error" closable showIcon message={ _errMessage } />
      )}
      <div className='studio-container'>
        <Studio style={{ maxHeight: "70vh"}} />
      </div>
      <div className='container' style={{ textAlign: "center" }}>
        <StudioPatterns />
      </div>
      <Divider />
      <div className='container'>
        <Sources />
      </div>
      
      { showDebug && (
      <div className='debug'>
        <strong>debug window</strong>
        <pre>
          {JSON.stringify( state, null, 2 )}
        </pre>
      </div>
      )}
    </div>
  )
}