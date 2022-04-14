import { useCallback, useEffect, useState, useRef } from "react"
import { useParams } from 'react-router-dom'

import MediaSelector from "../components/media-selector"
import Room from "../components/room"
import Logger from "../libs/logger"

const logger = new Logger('dashboard')

export default function Dashboard( props ) {
  const { name } = useParams()
  const [ _gotStream, setGotStream ] = useState( false )
  const [ _displayName, setDisplayName ] = useState( '' )
  const _stream = useRef()

  useEffect( () => {
    return function cleanup() {
      logger.debug('cleanup - stream:%o', _stream.current )
      if( _stream.current ) {
        const tracks = _stream.current.getTracks()

        for( const track of tracks ) {
          track.stop()
        }
      }
    }
  }, [])

  const setStream = useCallback( ( stream, displayName, ready ) => {
    logger.debug('setStream - stream:%o, displayName:%s, ready:%o', stream, displayName, ready)
    _stream.current = stream
    
    if( ready && !_gotStream ) {
      setDisplayName( displayName )
      setGotStream( true )
    }
  }, [ _gotStream ])

  return (
    <div className="Dashboard">
      { _gotStream ? (
        <Room displayName={ _displayName } roomId={ name } stream={ _stream.current } />
      ):(
        <MediaSelector setStream={ setStream } />
      )}
    </div>
  )
}