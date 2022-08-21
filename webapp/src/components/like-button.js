import { useCallback, useState } from 'react'
import { Button } from 'antd'
import { apiEndpoint } from '../libs/url-factory'

import { AiFillLike } from 'react-icons/ai'
import Logger from '../libs/logger'

const logger = new Logger('like-button')

export default function LikeButton( props ) {
  const { roomId } = props
  const [ _disabled, setDisabled ] = useState( false )

  const sendReaction = useCallback( async () => {
    const url = `${apiEndpoint}/reaction/${roomId}`

    setDisabled( true )
    await fetch( url, { method: 'POST' } )
      .catch( err => logger.earn( err.message ) )
    setDisabled( false )
  }, [ roomId ])

  return(
    <div className='LikeButton'>
      <Button type="primary" shape='circle' onClick={sendReaction} disabled={_disabled}>
        <AiFillLike />
      </Button>
    </div>
  )
}