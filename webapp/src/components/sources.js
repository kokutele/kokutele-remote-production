import { useState, useEffect } from "react"
import { Col, Row } from 'antd'
import SourceVideo from "./source-video"
import AddSource from "./add-source"
import { useAppContext } from "../libs/reducer"
import Logger from "../libs/logger"

import './sources.css'

const logger = new Logger('sources')

export default function Sources() {
  const { state } = useAppContext()
  const [ _sources, setSources ] = useState([])

  useEffect(() => {
    const sources = [ { 
      id: state.peerId,
      displayName: state.displayName,
      audioProducerId: state.audioProducerId,
      videoProducerId: state.videoProducerId,
      audioConsumerId: 'my-audio',
      videoConsumerId: 'my-video',
    }, ...state.peers ]

    logger.debug( 'sources:%o', sources )
    setSources( sources )
  }, [ state.peerId, state.displayName, state.audioProducerId, state.videoProducerId, state.peers])

  return(
    <div className="Sources">
      <Row gutter={16}>
      { _sources.filter( item => item.displayName !== 'studio-viewer' ).map( ( source, idx ) => (
        <Col key={idx} xs={8} md={6} lg={4}>
          <SourceVideo key={idx} { ...source }/>
        </Col>
      ))}
        <Col xs={8} md={6} lg={4}>
          <AddSource />
        </Col>
      </Row>
    </div>
  )
}