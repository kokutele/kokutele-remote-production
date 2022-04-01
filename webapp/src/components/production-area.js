import { useEffect } from 'react'
import { useAppContext } from '../libs/reducer'
import Logger from '../libs/logger'
import './production-area.css'

const logger = new Logger('production-area')

export default function ProductionArea( props ) {
  const { getProductionLayout, state } = useAppContext()

  logger.debug('state:%o', state )

  useEffect( () => {
    if( state.status === 'READY' ) {
      getProductionLayout()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.status ])

  return (
    <div className="ProductionArea"></div>
  )
}