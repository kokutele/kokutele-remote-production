import SourceVideo from "./source-video"
import { useAppContext } from "../libs/reducer"
import Logger from "../libs/logger"

import './sources.css'

const logger = new Logger('sources')

export default function Sources() {
  const { state } = useAppContext()
  logger.debug( "state:%o", state )

  const sources = [ { 
    id: state.peerId,
    displayName: state.displayName,
    audioProducerId: state.audioProducerId,
    videoProducerId: state.videoProducerId,
    audioConsumerId: 'my-audio',
    videoConsumerId: 'my-video',
  }, ...state.peers ]

  logger.debug( 'sources:%o', sources )

  return(
    <div className="Sources">
      { sources.filter( item => item.displayName !== 'studio-viewer' ).map( ( source, idx ) => (
        <SourceVideo key={idx} { ...source }/>
      ))}
    </div>
  )
}