import { useCallback, useRef, useState, useEffect } from 'react'
import { Button, Card, Col, Drawer, Form, Input, Row, Typography } from 'antd'

import { BsCardImage } from 'react-icons/bs'
import { BiTrash } from 'react-icons/bi'

import { useAppContext } from '../libs/reducer'
import { apiEndpoint } from '../libs/url-factory'

import './covers.css'

const { Paragraph } = Typography

export default function Covers(props) {
  const _formRef = useRef()
  const [ _showDrawer, setShowDrawer ] = useState( false )

  const { state, setCoverUrl, setCoverUrls } = useAppContext()

  useEffect(() => {
    if( !state.roomId ) return 

    fetch( `${apiEndpoint}/studio/${state.roomId}/covers`)
      .then( async res => {
        if( res.ok ) {
          const arr = await res.json()
          setCoverUrls( arr )
        } else {
          throw new Error( res.status )
        }
      })
  }, [ state.roomId ])

  const onFinish = useCallback( obj => {
    if( !obj.coverUrl ) return 

    const isExist = !!state.coverUrls.find( item => item.url === obj.coverUrl )
    if( isExist ) {
      _formRef.current.resetFields()
      return
    }

    fetch(`${apiEndpoint}/studio/${state.roomId}/covers`, {
      method: 'post',
      headers: { 'Content-Type': 'application/json '},
      body: JSON.stringify({ url: obj.coverUrl })
    }).then( async res => {
      if( res.ok ) {
        const arr = await res.json()
        setCoverUrls( arr )
      } else {
        throw new Error( `onFinish: ${res.status}` )
      }
    })

    _formRef.current.resetFields()
  }, [ state.roomId, state.coverUrls ])

  const deleteUrl = useCallback( id => {
    if( !id ) return 

    const item = state.coverUrls.find( item => item.id === id ) || { url: '' }
    const isSelected = ( item.url === state.studio.coverUrl )

    if( isSelected ) {
      setCoverUrl('')
    }

    fetch(`${apiEndpoint}/studio/${state.roomId}/covers`, {
      method: 'delete',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id })
    }).then( async res => {
      if( res.ok ) {
        const arr = await res.json()
        setCoverUrls( arr )
      } else {
        throw new Error( `deleteUrl: ${res.status}` )
      }
    } )
  }, [ state.roomId, state.coverUrls, state.studio.coverUrl ])

  return(
    <div className='Covers'>
      <Button onClick={() => setShowDrawer( true )} type='default' icon={<BsCardImage />}>&nbsp;Covers</Button>
      <Drawer title="covers" placement='left' onClose={() => setShowDrawer( false )} visible={ _showDrawer } >
        <Paragraph>
          <Card title="Select cover image">
            <Row gutter={4}>
              <Col span={8}>
                <div className='cover-wrapper'>
                  <div className='cover-body' data-selected={ !state.studio.coverUrl } onClick={() => setCoverUrl('')}>
                    None
                  </div>
                </div>
              </Col>
              { state.coverUrls.map( ( item, idx ) => (
              <Col span={8} key={idx}>
                <div className='cover-wrapper'>
                  <div className='cover-body' data-selected={ state.studio.coverUrl === item.url } onClick={() => setCoverUrl( item.url )}>
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
              <Form.Item name="coverUrl" rules={[{ required: true, message: 'Input cover url.'}]}>
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