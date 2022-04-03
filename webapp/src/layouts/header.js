import { Typography } from 'antd'
const { Title } = Typography

export default function Header( props ) {
  return (
    <div className="Header">
        <Title level={1} style={{
          color:'#CEAC5C',
          fontWeight: 'normal',
          fontFamily: "'Lobster', cursive",
          paddingLeft: "3px"
        }}>Kokutele Studio</Title>
    </div>
  )
}