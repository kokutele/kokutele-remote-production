import { Card } from "antd";
import { useAppContext } from "../libs/reducer";
import './cover-indicator.css'

export default function CoverIndicator() {
  const { state } = useAppContext()

  return (
    <div className="CoverIndicator" data-visible={!!state.studio.coverUrl}>
      <Card
        cover={<div className="img-wrapper"><img className="img" src={state.studio.coverUrl} alt="cover indicator" /></div>}
      >
        <Card.Meta
          description="Displaying cover image"
        />
      </Card>
    </div>
  )
}