import { useCallback, useEffect, useState } from "react";
import { Button } from 'antd'
import { useAppContext } from "../libs/reducer";

export default function Deselect(){
  const { state, deleteStudioLayout } = useAppContext() 
  const [ _disabled, setDisabled ] = useState( true )

  useEffect(() => {
    setDisabled( state.studio.layout.length === 0 )
  }, [ state.studio.layout ])

  const onClick = useCallback( () => {
    state.studio.layout.forEach( item => {
      const { peerId, audioProducerId, videoProducerId, mediaId } = item
      deleteStudioLayout({
        peerId, audioProducerId, videoProducerId, mediaId
      })
    })
  }, [ state.studio.layout, deleteStudioLayout ])

  return (
    <div className='Deselect'>
      <Button type='primary' onClick={onClick} disabled={_disabled} danger>Deselect</Button>
    </div>
  )
}