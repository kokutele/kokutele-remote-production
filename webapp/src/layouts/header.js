import { Typography } from 'antd'
const { Title } = Typography

export default function Header( props ) {
  return (
    <div className="Header">
      <div className='container'>
        <h1 style={{
          color:'#CEAC5C',
          padding: 0,
          margin: 0,
          height: '46px',
          fontWeight: 'normal',
          fontFamily: "'Lobster', cursive",
        }}>Kokutele Studio</h1>
      </div>
    </div>
  )
}