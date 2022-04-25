import { useEffect } from "react"
import { useParams } from "react-router-dom"

import Studio from "../components/studio"

import Logger from "../libs/logger"
import { useAppContext } from "../libs/reducer"

const logger = new Logger('studio-viewer')

export default function StudioViewer( props ) {
  const { name } = useParams()
  const { state, appData, createRoomClient, joinRoom, setStatusReady } = useAppContext()
  
  useEffect( () => {
    ( async () => {
      try {
        createRoomClient({ roomId: name ,displayName: 'studio-viewer' })

        logger.debug("client created:%o", appData.roomClient )

        await joinRoom()
        setStatusReady()
      } catch( err ) {
        logger.error( err.message )
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  return (
    <div className="StudioViewer">
      <Studio style={{ height: "100vh", width: "100vw", background: "#000", position: 'absolute', top: 0 }} playAudio={true} hideAlert={true} />
      { process.env.NODE_ENV === 'development' && (
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