import { useCallback, useEffect, useState, useRef } from "react"
import { useParams } from 'react-router-dom'
import { Alert, Modal, Input } from "antd"

import MediaSelector from "../components/media-selector"
import Room from "../components/room"

import { apiEndpoint } from "../libs/url-factory"
import Logger from "../libs/logger"

const logger = new Logger('dashboard')

export default function Dashboard( props ) {
  const { name } = useParams()
  const [ _gotStream, setGotStream ] = useState( false )
  const [ _displayName, setDisplayName ] = useState( '' )
  const [ _authenticated, setAuthenticated ] = useState( false )
  const [ _passcode, setPasscode ] = useState( '' )
  const [ _passcodeError, setPasscodeError ] = useState( '' )
  const [ _loaded, setLoaded ] = useState( false )
  const _stream = useRef()

  useEffect( () => {
    fetch( `${apiEndpoint}/studio/${name}` )
      .then( res => {
        if( res.status === 200 ) {
          setAuthenticated( true )
        }
        setLoaded( true )
      })

    return function cleanup() {
      logger.debug('cleanup - stream:%o', _stream.current )
      if( _stream.current ) {
        const tracks = _stream.current.getTracks()

        for( const track of tracks ) {
          track.stop()
        }
      }
    }
  }, [ name ])

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
      <Modal 
        closable={false}
        cancelButtonProps={{ disabled: true }}
        title={"passcode required."} 
        visible={ !_authenticated && _loaded }
        onOk={ () => {
          fetch( `${apiEndpoint}/studio/${name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify( { passcode: _passcode })
          }).then( res => {
            if( res.status === 200 ) {
              setPasscodeError('')
              setAuthenticated( true )
            } else {
              setPasscodeError('wrong passcode')

            }
          })
        }}
      >
        Enter passcode:<br />
        { _passcodeError !== '' && ( <Alert type="error" message={_passcodeError} showIcon />)}
        <Input.Password 
          placeholder="Enter passcode here"
          onChange={ e => setPasscode( e.target.value ) } 
          value={_passcode} 
        />
      </Modal>
      { _gotStream ? (
        <Room displayName={ _displayName } roomId={ name } stream={ _stream.current } />
      ):(
        <MediaSelector setStream={ setStream } />
      )}
    </div>
  )
}