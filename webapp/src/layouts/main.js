import Room from "../components/room"
import { useParams } from 'react-router-dom'

export default function Main( props ) {
  const { name } = useParams()
  return (
    <div className="Main">
      <p>{name}</p>
      <Room />
    </div>
  )
}