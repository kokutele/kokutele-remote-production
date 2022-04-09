import { Link } from 'react-router-dom'

export default function Home(props) {
  return (
    <div className="Home">
      <h2>Home</h2>
      <nav>
        <ul><Link to="/virtual-studio">Virtual Studio</Link></ul>
        <ul><Link to="/viewer">Virtual Studio Viewer</Link></ul>
      </nav>
    </div>
  )
}