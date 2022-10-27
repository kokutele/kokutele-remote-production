import { useCallback, useRef, useState, useEffect } from 'react'
import { Button, Card, Col, Drawer, Form, Input, Row, Typography } from 'antd'

import { BsCardImage } from 'react-icons/bs'
import { BiTrash } from 'react-icons/bi'

import { useAppContext } from '../libs/reducer'
import { apiEndpoint } from '../libs/url-factory'

import './backgrounds.css'

const { Paragraph } = Typography

export default function Backgrounds(props) {
  const _formRef = useRef()
  const [ _showDrawer, setShowDrawer ] = useState( false )
  const [ _urls, setUrls ] = useState( [] )

  const { state, setBackgroundUrl } = useAppContext()

  useEffect(() => {
    if( !state.roomId ) return 

    fetch( `${apiEndpoint}/studio/${state.roomId}/backgrounds`)
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
    if( !obj.backgroundUrl ) return 

    fetch(`${apiEndpoint}/studio/${state.roomId}/backgrounds`, {
      method: 'post',
      headers: { 'Content-Type': 'application/json '},
      body: JSON.stringify({ url: obj.backgroundUrl })
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

    fetch(`${apiEndpoint}/studio/${state.roomId}/backgrounds`, {
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
    <div className='Backgrounds'>
      <Button onClick={() => setShowDrawer( true )} type='default' icon={<BsCardImage />}>&nbsp;Backgrounds</Button>
      <Drawer title="backgrounds" placement='left' onClose={() => setShowDrawer( false )} visible={ _showDrawer } >
        <Paragraph>
          <Card title="Select background image">
            <Row gutter={4}>
              <Col span={8}>
                <div className='background-wrapper'>
                  <div className='background-body' data-selected={ !state.studio.backgroundUrl } onClick={() => setBackgroundUrl('')}>
                    None
                  </div>
                </div>
              </Col>
              { _urls.map( ( item, idx ) => (
              <Col span={8} key={idx}>
                <div className='background-wrapper' onClick={() => setBackgroundUrl( item.url ) }>
                  <div className='background-body' data-selected={ state.studio.backgroundUrl === item.url }>
                    <img src={item.url} alt={`cover-${idx}`} />
                  </div>
                  <div className='delete'>
                    <Button 
                      danger
                      icon={<BiTrash />}
                      onClick={() => deleteUrl(item.id)} 
                      shape="circle"
                      size="small" 
                      type="primary" 
                    />
                  </div>
                </div>
              </Col>
              ))}
            </Row>
          </Card>
        </Paragraph>
        <Paragraph>
          <Card title="Add image url">
            <Form size="small" ref={_formRef} onFinish={onFinish}>
              <Form.Item name="backgroundUrl" rules={[{ required: true, message: 'Input background url.'}]}>
                <Input type="url" placeholder="image url" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType='submit'>add</Button>
              </Form.Item>
            </Form>
          </Card>
        </Paragraph>
      </Drawer>
    </div>
  )
}