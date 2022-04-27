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
    const remoteMedias = state.videoConsumers.map( videoConsumer => {
      const videoConsumerId = videoConsumer.consumerId
      const videoProducerId = videoConsumer.producerId
      const peerId  = videoConsumer.peerId
      const mediaId = videoConsumer.mediaId

      const audioConsumer = state.audioConsumers.find( item => item.mediaId === mediaId )
      const audioConsumerId = audioConsumer ? audioConsumer.consumerId : null
      const audioProducerId = audioConsumer ? audioConsumer.producerId : null

      const peer = state.peers.find( item => item.id === peerId )

      return peer ? {
        id: peerId,
        displayName: peer.displayName,
        audioProducerId,
        videoProducerId,
        mediaId,
        audioConsumerId,
        videoConsumerId
      }: null
    } ).filter( item => item !== null )
    const sources = [ 
      ...state.localMedias,
      ...remoteMedias
    ]

    logger.debug( 'sources:%o', sources )
    setSources( sources )
  }, [ state.localMedias, state.peers, state.audioConsumers, state.videoConsumers ])

  return(
    <div className="Sources">
      <Row gutter={16}>
      { _sources.filter( item => item.displayName !== 'studio-viewer' ).map( ( source, idx ) => (
        <Col key={idx} xs={8} md={6} lg={4}>
          <SourceVideo key={idx} idx={idx} { ...source }/>
        </Col>
      ))}
        <Col xs={8} md={6} lg={4}>
          <AddSource />
        </Col>
      </Row>
    </div>
  )
}