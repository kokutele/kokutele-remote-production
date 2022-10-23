import { useCallback, useRef, useState, useEffect } from 'react'
import { Button, Drawer, Form, Input, Typography } from 'antd'

import { BsCardImage } from 'react-icons/bs'

import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import { apiEndpoint } from '../libs/url-factory'

const { Paragraph } = Typography
const logger = new Logger('covers.js')

export default function Covers(props) {
  const _formRef = useRef()
  const [ _showDrawer, setShowDrawer ] = useState( false )
  const [ _urls, setUrls ] = useState( [] )

  const { state, setCoverUrl } = useAppContext()

  useEffect(() => {
    if( !state.roomId ) return 

    fetch( `${apiEndpoint}/studio/${state.roomId}/covers`)
      .then( async res => {
        if( res.ok ) {
          const arr = await res.json()
          setUrls( arr )
        } else {
          throw new Error( res.status )
        }
      })
  }, [ state.roomId ])

  const onFinish = useCallback( obj => {
    if( !obj.coverUrl ) return 

    fetch(`${apiEndpoint}/studio/${state.roomId}/covers`, {
      method: 'post',
      headers: { 'Content-Type': 'application/json '},
      body: JSON.stringify({ url: obj.coverUrl })
    }).then( async res => {
      if( res.ok ) {
        const arr = await res.json()
        setUrls( arr )
      } else {
        throw new Error( `onFinish: ${res.status}` )
      }
    })

    _formRef.current.resetFields()
  }, [ state.roomId ])

  const deleteUrl = useCallback( id => {
    if( !id ) return 

    fetch(`${apiEndpoint}/studio/${state.roomId}/covers`, {
      method: 'delete',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id })
    }).then( async res => {
      if( res.ok ) {
        const arr = await res.json()
        setUrls( arr )
      } else {
        throw new Error( `deleteUrl: ${res.status}` )
      }
    } )
  }, [ state.roomId ])

  return(
    <div className='Covers'>
      <Button onClick={() => setShowDrawer( true )} type='default' icon={<BsCardImage />}>&nbsp;Covers</Button>
      <Drawer title="covers" placement='left' onClose={() => setShowDrawer( false )} visible={ _showDrawer } >
        <Paragraph>
          Select cover image shown below.
        </Paragraph>
        <Paragraph>
          add image url:<br />
          <Form size="small" ref={_formRef} onFinish={onFinish}>
            <Form.Item name="coverUrl" rules={[{ required: true, message: 'Input cover url.'}]}>
              <Input type="url" placeholder="image url" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType='submit'>add</Button>
            </Form.Item>
          </Form>
        </Paragraph>
        <Paragraph>
          { _urls.map( ( item, idx ) => (
            <div key={idx}>
              {item.id}:{item.url}
              <Button type="link" onClick={() => deleteUrl(item.id)}>delete</Button>
            </div>
          ))}
        </Paragraph>
      </Drawer>
    </div>
  )
}