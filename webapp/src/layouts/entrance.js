import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button,Card, Col, Divider, Form, Input, Row, Typography } from 'antd'
import { apiEndpoint } from '../libs/url-factory'

const { Title } = Typography

export default function Entrance( props ) {
  const [ _url, setUrl ] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    fetch( `${apiEndpoint}/studio` )
      .then( res => res.json() )
      .then( ({ name }) =>  setUrl(`${window.location.pathname}/${name}`) )
      .catch( err => { throw err })
  }, [])

  const handleFinish = useCallback( values => {
    const { studioname } = values
    navigate( `${location.pathname}/${studioname}` )
  }, [ navigate, location.pathname ] )

  return (
    <div className="Entrance">
      <div className="container">
        <div className="wrapper" style={{marginTop: "10vh"}}>
          <Row>
            <Col offset={6} span={12}>
              <Card style={{width:"100%"}} title="Entrance of Virtual Studio">
                <Title level={4}>Create studio</Title>
                <Row gutter={16}>
                  <Col offset={10} span={4}>
                    <Link to={_url} style={{textAlign:"center"}}>
                      <Button type="primary">Create</Button>
                    </Link>
                  </Col>
                </Row>
                <Divider plain>or</Divider>
                <Title level={4}>Enter existing studio name</Title>
                <Form
                  name="existing-room"
                  labelCol={{ span: 6 }}
                  wrapperCol={{ span: 18 }}
                  initialValues={{ remember: true }}
                  onFinish={ handleFinish }
                  autoComplete="off"
                >
                  <Form.Item
                    label="Name"
                    name="studioname"
                    rules={[{ required: true, message: 'Input studio name' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                    <Button type="primary" htmlType='submit'>Enter</Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}