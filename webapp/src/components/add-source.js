import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Popover } from 'antd'
import { GrAddCircle } from 'react-icons/gr'
import { RiUserAddFill } from 'react-icons/ri'
import { VscFileMedia } from 'react-icons/vsc'

import { useAppContext } from '../libs/reducer'

import Logger from '../libs/logger'

import './add-source.css'

const logger = new Logger('add-source')

const SelectVideoFile = props => {
  const { appData } = useAppContext()
  const { visible, setModalVisibility } = props
  const _inputEl = useRef( null )
  const _videoEl = useRef( '' )
  const _videoWrapper = useRef( null )

  useEffect( () => {
    if( visible ) {
      logger.debug( 'appData.localVideos: %o', appData.localVideos )
      logger.debug( 'appData.localStreams: %o', appData.localStreams )
      const inputEl = document.createElement('input')
      inputEl.type = 'file'
      inputEl.addEventListener( 'change', e => {
        const file = e.target.files[0]

        const url = URL.createObjectURL( file )
        logger.debug( 'change event fired. file:%s', url )

        const videoEl = document.createElement( 'video' )
        videoEl.src = url
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ visible ])

  return (
    <Modal 
      title="Add video file" 
      visible={ visible } 
      zIndex={2000}
      onOk={ async () => {
        if( _videoEl.current ) {
          const id = `localvideo-${Date.now()}`
          const videoEl = _videoEl.current.cloneNode()
          appData.localVideos.set( id, videoEl )
          const stream = videoEl.captureStream()
          appData.localStreams.set( id, stream )
        }
        setModalVisibility( false )
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

const MediaButtons = props => {
  const style = { width: "120px", marginBottom: "2px" }
  const [ _isSelectFileVisible, setIsSelectFileVisible ] = useState( false )
  return (
    <div className='MediaButtons'>
      <SelectVideoFile visible={ _isSelectFileVisible } setModalVisibility={ setIsSelectFileVisible } />
      <div className='wrapper'>
        <Button icon={<VscFileMedia />}  style={style} type='primary' onClick={ () => {
          setIsSelectFileVisible( true ) 
        }}>&nbsp;File</Button><br />
        <Button icon={<RiUserAddFill />} style={style} type='primary'>&nbsp;Invite</Button>
      </div>
    </div>
  )
}

export default function AddSource( props ) {
  return (
    <div className="AddSource">
      <div className='wrapper'>
        <span>Add media</span>
        <Popover content={<MediaButtons />} trigger="click" placement='topLeft'>
          <Button type="text" shape='circle' icon={<GrAddCircle />}></Button>
        </Popover>
      </div>
    </div>
  )
}