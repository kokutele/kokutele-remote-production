import { Typography } from 'antd'
const { Title } = Typography

export default function Header( props ) {
  return (
    <div className="Header">
      <div className='container'>
        <Title level={1} style={{
          color:'#CEAC5C',
          fontWeight: 'normal',
          fontFamily: "'Lobster', cursive",
        }}>Kokutele Studio</Title>
      </div>
    </div>
  )
}