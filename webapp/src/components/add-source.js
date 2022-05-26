import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, Popover, message } from 'antd'
import { GrAddCircle } from 'react-icons/gr'
import { RiUserAddFill } from 'react-icons/ri'
import { VscFileMedia } from 'react-icons/vsc'
import { MdOutlineScreenShare } from 'react-icons/md'

import { useAppContext } from '../libs/reducer'
import { apiEndpoint } from '../libs/url-factory'

import Logger from '../libs/logger'

import './add-source.css'

const logger = new Logger('add-source')

const SelectVideoFile = props => {
  const { appData, state, createProducer } = useAppContext()
  const { visible, setModalVisibility } = props

  const [ _filename, setFilename ] = useState('')
  const _inputEl = useRef( null )
  const _videoEl = useRef( '' )
  const _videoWrapper = useRef( null )
  const _url = useRef( null )

  useEffect( () => {
    if( visible ) {
      const inputEl = document.createElement('input')
      inputEl.type = 'file'
      inputEl.addEventListener( 'change', e => {
        const file = e.target.files[0]
        setFilename( file.name )

        _url.current = URL.createObjectURL( file )
        logger.debug( 'change event fired. file:%s', _url.current )

        const videoEl = document.createElement( 'video' )
        videoEl.src = _url.current
        videoEl.loop = true
        videoEl.addEventListener('loadedmetadata', async e => {
          await videoEl.play()
        }, false)

        if( _videoEl.current ) {
          _videoWrapper.current.removeChild( _videoEl.current )
          _videoEl.current.remove()
          _videoEl.current = null
        }
        _videoWrapper.current.appendChild( videoEl )
        _videoEl.current = videoEl
      },false )

      _inputEl.current = inputEl
    } else {
      if( _inputEl.current ) {
        _inputEl.current.remove()
        _inputEl.current = null
      }
      if( _videoEl.current ) {
        _videoWrapper.current.removeChild( _videoEl.current )
        _videoEl.current.remove()
        _videoEl.current = null
      }
      _url.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ visible ])

  return (
    <Modal 
      title="Add video file" 
      visible={ visible } 
      zIndex={2000}
      onOk={ () => {
        if( _url.current ) {
          const videoEl = document.createElement('video')
          videoEl.src = _url.current
          videoEl.loop = true

          videoEl.onloadedmetadata = async () => {
            await videoEl.play()
            const stream = videoEl.captureStream()
            const streamId = await createProducer({
              peerId: state.peerId,
              displayName: _filename,
              stream
            })
            appData.localVideos.set( streamId, videoEl )
            setModalVisibility( false )
          }
        }
      }} 
      onCancel={ () => {
        setModalVisibility( false ) 
      }}
    >
      <Button type="default" icon={<VscFileMedia />} onClick={ () => _inputEl.current.click() }>&nbsp;select file</Button>
      <div className='videoWrapper' ref={ _videoWrapper }  />
    </Modal>
  )
}

const InviteLinks = props => {
  const { visible, setModalVisibility, roomId } = props
  const { state } = useAppContext()
  const [ _guestId, setGuestId ] = useState('')

  useEffect( () => {
    if( state.status === 'READY' ) {
      fetch( `${apiEndpoint}/guestId/${roomId}` )
        .then( res => res.text() )
        .then( guestId => setGuestId( guestId ))
        .catch( err => message.error( err.message ))
    }
  }, [ roomId, state.status ])

  return (
    <Modal 
      title="Invite Links" 
      visible={ visible } 
      zIndex={2000}
      onOk={ () => {
        setModalVisibility( false )
      }} 
      onCancel={ () => {
        setModalVisibility( false ) 
      }}
    >
      Dashboard url:<br />
      <Input value={`${window.origin}/virtual-studio/${roomId}`} readOnly /><br/>
      Guest url:<br />
      <Input value={`${window.origin}/guest-room/${_guestId}`} readOnly /><br/>
      Viewer url:<br />
      <Input value={`${window.origin}/viewer/${roomId}`} readOnly /><br/>
    </Modal>
  )
}

const MediaButtons = props => {
  const { roomId, setVisible } = props
  const { state, createProducer } = useAppContext()
  const style = { width: "120px", marginBottom: "2px" }
  const [ _isSelectFileVisible, setIsSelectFileVisible ] = useState( false )
  const [ _isInviteLinksVisible, setIsInviteLinksVisible ] = useState( false )

  const handleScreenCapture = useCallback( async () => {
    const options = {
      video: { "cursor": "always" },
      audio: true
    }

    const stream = await navigator.mediaDevices.getDisplayMedia( options )
      .catch( err => {
        logger.error( '[Error] getDisplayMedia:%o', err )
        message.error( err.message )
        return null
      })

    if( stream ) {
      logger.debug('getDisplayMedia - stream:%o', stream)
      await createProducer({
        peerId: state.peerId,
        displayName: 'screen capture',
        stream,
        isCapture: true
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.peerId])

  return (
    <div className='MediaButtons'>
      <SelectVideoFile visible={ _isSelectFileVisible } setModalVisibility={ setIsSelectFileVisible } />
      <InviteLinks visible={ _isInviteLinksVisible } setModalVisibility={ setIsInviteLinksVisible } roomId={roomId} />
      <div className='wrapper'>
        <Button icon={<MdOutlineScreenShare />} style={style} type='primary' onClick={ () => {
          setVisible( false )
          handleScreenCapture() 
        }}>&nbsp;Capture</Button><br/>
        <Button icon={<VscFileMedia />}  style={style} type='primary' onClick={ () => {
          setVisible( false )
          setIsSelectFileVisible( true ) 
        }}>&nbsp;File</Button><br />
        <Button icon={<RiUserAddFill />} style={style} type='primary' onClick={ () => {
          setVisible( false )
          setIsInviteLinksVisible( true )
        }}>&nbsp;Invite</Button>
      </div>
    </div>
  )
}

export default function AddSource( props ) {
  const [ _visible, setVisible ] = useState( false )
  const { roomId } = props
  return (
    <div className="AddSource">
      <div className='wrapper'>
        <span>Add media</span>
        <Popover 
          content={
            <MediaButtons 
              roomId={roomId} 
              setVisible={setVisible} 
            />
          } 
          visible={_visible} 
          onVisibleChange={ visible => setVisible( visible )} 
          trigger="click" 
          placement='topLeft'
        >
          <Button type="text" shape='circle' icon={<GrAddCircle />}></Button>
        </Popover>
      </div>
    </div>
  )
}