import { useEffect, useState } from 'react'
import { Alert, Col, Collapse, Divider, Row, Space } from 'antd'

import Studio from './studio'
import StudioPatterns from './studio-patterns'
import LikeButton from './like-button'
import Deselect from './deselect'
import Captions from './captions'
import Backgrounds from './backgrounds'
import Covers from './covers'
import CoverIndicator from './cover-indicator'
import Sources from './sources'

import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'

import './room.css'

const { Panel } = Collapse

const logger = new Logger('Room')
const showDebug = process.env.NODE_ENV === 'development'

export default function Room( props ) {
  const { appData, state, createRoomClient, joinRoom, createProducer, close } = useAppContext()
  const [ _errMessage, setErrMessage ] = useState('')
  const { displayName, stream, roomId } = props
  
  useEffect( () => {
    //const peerId = createRoomClient({ displayName, roomId })
    createRoomClient({ displayName, roomId })

    // setRoomId( roomId )

    logger.debug("client created:%o", appData.roomClient )

    joinRoom()
      .then( async () => {
        await createProducer({ stream })
      } )
      .catch( err => setErrMessage( err.message ))

    return async function cleanup() {
      await close()
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
      <CoverIndicator />
      <div className='container' style={{ textAlign: "center" }}>
        <Row gutter={16}>
          <Col offset={1} span={2} style={{ textAlign: "left"}}>
            <Space direction='vertical'>
              <Backgrounds />
              <Captions />
              <Covers />
            </Space>
          </Col>
          <Col offset={0} span={18} style={{ textAlign: "center" }}>
            <StudioPatterns />
          </Col>
          <Col offset={1} span={2} style={{ textAlign: "center"}}>
            <Space direction='vertical'>
              <LikeButton roomId={roomId} />
              <Deselect />
            </Space>
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