import { useEffect, useState } from 'react'
import { Alert, Col, Collapse, Divider, Row } from 'antd'

import Studio from './studio'
import StudioPatterns from './studio-patterns'
import LikeButton from './like-button'
import Captions from './captions'
import Covers from './covers'
import Sources from './sources'

import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'

import './room.css'

const { Panel } = Collapse

const logger = new Logger('Room')
const showDebug = process.env.NODE_ENV === 'development'

export default function Room( props ) {
  const { appData, state, createRoomClient, joinRoom, createProducer, setRoomId, close } = useAppContext()
  const [ _errMessage, setErrMessage ] = useState('')
  const { displayName, stream, roomId } = props
  
  useEffect( () => {
    const peerId = createRoomClient({ displayName, roomId })

    setRoomId( roomId )

    logger.debug("client created:%o", appData.roomClient )

    joinRoom()
      .then( async () => {
        await createProducer({ peerId, displayName, stream })
      } )
      .catch( err => setErrMessage( err.message ))

    return async function cleanup() {
      await close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ displayName, roomId ])

  // useEffect( () => {
  //   if( state.status === 'READY' ) {
  //     fetch( `${apiEndpoint}/guestId/${roomId}` )
  //       .then( res => res.text() )
  //       .then( guestId => setGuestId( guestId ))
  //       .catch( err => setErrMessage( err.message ))
  //   }
  // }, [ state.status, roomId ])

  return (
    <div className='Room'>
      { _errMessage !== '' && (
        <Alert type="error" closable showIcon message={ _errMessage } />
      )}
      <div className='studio-container'>
        <Studio style={{ maxHeight: "70vh"}} />
      </div>
      <div className='container' style={{ textAlign: "center" }}>
        <Row gutter={16}>
          <Col offset={1} span={2} style={{ textAlign: "left"}}>
            <Captions />
            <Covers />
          </Col>
          <Col offset={0} span={18} style={{ textAlign: "center" }}>
            <StudioPatterns />
          </Col>
          <Col offset={1} span={2} style={{ textAlign: "center"}}>
            <LikeButton roomId={roomId} />
          </Col>
        </Row>
      </div>
      <Divider />
      <div className='container'>
        <Sources roomId={roomId} />
      </div>
      
      { showDebug && (
      <div className='debug'>
        <Collapse bordered={true} style={{ background: "rgba( 255, 255, 255, 0.5 )", fontSize: "0.75em" }}>
          <Panel header="debug window">
              <pre style={{ background: "rgba( 255, 255, 255, 0.5 )"}}>
                {JSON.stringify(state, null, 2)}
              </pre>
          </Panel>
        </Collapse>
     </div>
      )}
    </div>
  )
}