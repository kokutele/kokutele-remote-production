import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button,Card, Col, Divider, Input, Row, Typography } from 'antd'
import { apiEndpoint } from '../libs/url-factory'

const { Title } = Typography

export default function Entrance( props ) {
  const [ _url, setUrl ] = useState('')
  const [ _name, setName ] = useState('')

  useEffect(() => {
    fetch( `${apiEndpoint}/studio` )
      .then( res => res.json() )
      .then( ({ name }) =>  setUrl(`${window.location.pathname}/${name}`) )
      .catch( err => { throw err })
  }, [])

  const handleChange =  useCallback( e => {
    setName( e.target.value )
  }, [])

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
                <Row gutter={16}>
                  <Col offset={2} span={18}>
                    <Input type="text" onChange={handleChange} value={_name}></Input>
                  </Col>
                  <Col span={4}>
                    <Link to={_name}>
                      <Button type="primary">Enter</Button>
                    </Link>
                  </Col>
                </Row>
             </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}