import { useEffect } from "react"

import Studio from "../components/studio"

import Logger from "../libs/logger"
import { useAppContext } from "../libs/reducer"

const logger = new Logger('studio-viewer')

export default function StudioViewer( props ) {
  const { state, appData, createRoomClient, joinRoom } = useAppContext()
  
  useEffect( () => {
    ( async () => {
      try {
        createRoomClient({ stream: null ,displayName: 'studio-viewer' })

        logger.debug("client created:%o", appData.roomClient )

        await joinRoom()
      } catch( err ) {
        logger.error( err.message )
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  return (
    <div className="StudioViewer">
      <Studio style={{ height: "100vh" }} playAudio={true} />
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