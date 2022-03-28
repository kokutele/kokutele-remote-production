import { Typography } from 'antd'
const { Title } = Typography

export default function Header( props ) {
  return (
    <div className="Header">
        <Title level={1}>kokutele remote production</Title>
    </div>
  )
}