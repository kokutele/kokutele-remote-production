import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { BsFillPlayFill } from 'react-icons/bs'
import { Button } from 'antd'

import Studio from "../components/studio"

import Logger from "../libs/logger"
import { useAppContext } from "../libs/reducer"

const urlParams = new URLSearchParams( window.location.search )

const logger = new Logger('studio-viewer')
const disableAutoPlay = urlParams.has('disableAutoPlay')
const muted = urlParams.has('muted')

export default function StudioViewer( props ) {
  const [ _showPlayButton, changeShowPlayButton ] = useState( disableAutoPlay )
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
      { !_showPlayButton ? (
      <Studio 
        style={{ height: "100vh", width: "100vw", background: "#000", position: 'absolute', top: 0 }} 
        playAudio={ !muted ? true : false } 
        hideAlert={true} 
        viewer={true}
      />
      ):(
      <div
        style={{ height: "100vh", width: "100vw", background: "#000", position: 'absolute', top: 0 }} 
      >
        <div
          style={{ height: "100vh", width: "100vw", display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
        >
          <Button type="primary" onClick={() => changeShowPlayButton( false )} danger>
            <BsFillPlayFill />
          </Button>
        </div>
      </div>
      )}
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