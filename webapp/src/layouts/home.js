import { Link } from 'react-router-dom'
import { Button } from 'antd'

export default function Home(props) {
  return (
    <div className="Home" style={{textAlign: "center"}}>
      <h1 style={{
        color:'#CEAC5C',
        padding: "1em 0 .5em 0",
        margin: 0,
        fontSize: '72pt',
        fontWeight: 'normal',
        fontFamily: "'Lobster', cursive",
      }}>Kokutele Studio</h1>
      <h3
        style={{
          fontSize: "24pt",
          padding: "0.2em 0 1.5em 0",
        }}
      >Open Source Virtual Studio</h3>
 
      <nav>
        <Button type="primary">
          <Link to="/virtual-studio">enter Virtual Studio</Link>
        </Button>
      </nav>
    </div>
  )
}