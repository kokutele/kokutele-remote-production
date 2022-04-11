import { useCallback, useState, useRef } from "react"

import MediaSelector from "../components/media-selector"
import Room from "../components/room"
import { useParams } from 'react-router-dom'

export default function Dashboard( props ) {
  const { name } = useParams()
  const [ _gotStream, setGotStream ] = useState( false )
  const [ _displayName, setDisplayName ] = useState( '' )
  const _stream = useRef()

  const setStream = useCallback( ( stream, displayName ) => {
    if( !_gotStream ) {
      _stream.current = stream
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