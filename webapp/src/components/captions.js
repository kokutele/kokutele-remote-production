import { useState } from 'react'
import { Button, Drawer, Radio, Typography } from 'antd'
import { captions } from '../config'

import { CgTranscript } from 'react-icons/cg'

import { useAppContext } from '../libs/reducer'

const { Paragraph } = Typography

export default function Captions(props) {
  const [ _showDrawer, setShowDrawer ] = useState( false )

  const { state, setCaption } = useAppContext()

  return(
    <div className='Captions'>
      <Button onClick={() => setShowDrawer( true )} type='default' icon={<CgTranscript />}>&nbsp;Captions</Button>
      <Drawer title="captions" placement='left' onClose={() => setShowDrawer( false )} visible={ _showDrawer } >
        <Paragraph>
          Select caption shown below. When you don't wanna have any caption, choose `none`.
        </Paragraph>

        <Radio.Group onChange={ e => setCaption(e.target.value) } value={ state.caption }>
          <Radio value=''>none</Radio><br/>
          { captions.map( ( caption, idx ) => (
            <Radio value={caption} key={idx}>{caption}</Radio>
          ) )}
        </Radio.Group>
      </Drawer>
    </div>
  )
}