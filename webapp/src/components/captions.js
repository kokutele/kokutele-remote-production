import { useEffect, useMemo, useState, useRef } from 'react'
import { Button, Card, Drawer, Form, Input, Radio, Typography } from 'antd'
import Logger from '../libs/logger'
import { apiEndpoint } from '../libs/url-factory'

import { CgTranscript } from 'react-icons/cg'
import { BiTrash } from 'react-icons/bi'

import { useAppContext } from '../libs/reducer'

const { Paragraph } = Typography
const logger = new Logger('Captions')

export default function Captions(props) {
  const [ _showDrawer, setShowDrawer ] = useState( false )

  const { state, setCaption, setCaptions } = useAppContext()
  const _setCaptions = useRef( setCaptions )
  const _form = useRef( null )

  const _url = useMemo( () => {
    return `${apiEndpoint}/studio/${state.roomId}/captions`
  }, [state.roomId])


  useEffect(() => {
    if(!state.roomId) return

    fetch( _url )
      .then( async res => {
        if( res.ok ) {
          const captions = await res.json()
          _setCaptions.current( captions )
        } else {
          throw new Error( `fetch error - ${res.status}` )
        }
      })
      .catch( err => {
        logger.warn( "Error - %o", err )
      })
  }, [state.roomId, _url ])

  return(
    <div className='Captions'>
      <Button onClick={() => setShowDrawer( true )} type='default' icon={<CgTranscript />}>&nbsp;Captions</Button>
      <Drawer title="captions" placement='left' onClose={() => setShowDrawer( false )} visible={ _showDrawer } >
        <Paragraph>
          <Card title="Select caption">
            <Radio.Group onChange={ e => setCaption(e.target.value) } value={ state.caption }>
              <div>
                <Radio value=''>none</Radio>
              </div>
              { state.captions.map( ( item, idx ) => (
                <div key={idx}>
                  <Radio value={item.caption} key={idx}>{item.caption}</Radio>
                  <Button icon={<BiTrash/>} shape="circle" type="text" onClick={() => {
                    fetch(_url, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: item.id })
                    })
                      .then(res => {
                        if (!res.ok) throw new Error(`DELETE fetch error:${res.status}`)

                        if( state.caption === item.caption ) {
                          setCaption('')
                        }
                      })
                      .catch(err => {
                        logger.warn('Failed fetch:%o', err)
                      })
                  }} danger/>
                </div>
              ) )}
            </Radio.Group>
          </Card>
        </Paragraph>
        <Paragraph>
          <Card title="Add caption">
            <Form
              ref={_form}
              name="caption"
              onFinish={ values => {
                logger.debug('set caption:%o', values )
                fetch( _url, {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify( { caption: values.text })
                })
                .then( res => {
                  if( !res.ok ) throw new Error(`POST fetch error:${res.status}`)
                })
                .catch( err => {
                  logger.warn('Failed fetch:%o', err )
                })
                .finally(() => {
                  if (_form.current) _form.current.resetFields()
                })
              }}
              onFinishFailed={ err => {
                logger.warn('set caption error:%o', err )
              }}
              autoComplete="off"
            >
              <Form.Item
                label="text"
                name="text"
                rules={[{required:true, message: 'Please input caption text!'}]}
              >
                <Input />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType='submit'>
                  add
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Paragraph>
      </Drawer>
    </div>
  )
}