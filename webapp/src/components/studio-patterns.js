import { useEffect } from "react";
import { Radio } from "antd";
import { useAppContext } from "../libs/reducer";

import Logger from "../libs/logger";

const logger = new Logger( 'studio-patterns' )

export default function StudioPatterns( props ) {
  const {
    getStudioPatterns,
    getStudioPatternId,
    setStudioPatternId,
    state
  } = useAppContext()

  useEffect( () => {
    if( state.status === 'READY' ) {
      getStudioPatterns()
      getStudioPatternId()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ state.status ])

  return (
    <div className="StudioPatterns">
      <Radio.Group 
        value={ state.studio && state.studio.patternId }
        onChange={ e => { logger.debug( e.target.value ); setStudioPatternId( e.target.value )}}
        buttonStyle="solid"
      >
        { state.studio && state.studio.patterns.map( ( pattern, idx ) => (
          <Radio.Button key={idx} value={pattern.id}>{pattern.label}</Radio.Button>
        ))}
      </Radio.Group>
    </div>
  )
}