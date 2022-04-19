import { useContext } from 'react';
import RoomClient from './room-client';
import { AppContext } from '../App'
import Logger from './logger';

const logger = new Logger("reducer")

export const initialState = {
  status: 'IDLE',
  peerId: '',
  displayName: '',
  localMedias: [], // Array<{ id, displayName, audioProducerId, videoProducerId, localStreamId }>
  peers: [],
  audioConsumers: [],
  videoConsumers: [],
  studio: {
    width: 0,
    height: 0,
    layout: [],
    patterns: [],
    patternId: 0, 
  }
}

export const reducer = ( state, action ) => {
  switch( action.type ) {
    case 'INIT': {
      return initialState
    }
    case 'SET_STATUS': {
      return { ...state, status: action.value }
    }
    case 'SET_PEERID': {
      return { ...state, peerId: action.value }
    }
    case 'SET_DISPLAY_NAME': {
      return { ...state, displayName: action.value }
    }
    case 'SET_PEERS': {
      return { ...state, peers: action.value }
    }
    case 'ADD_PEER': {
      return { ...state, peers: [...state.peers, action.value ]}
    }
    case 'ADD_LOCAL_MEDIA': {
      return { ...state, localMedias: [ ...state.localMedias, action.value ] }
    }
    case 'DELETE_PEER': {
      return { 
        ...state, 
        peers: state.peers.filter( peer => peer.id !== action.value )
      }
    }
    case 'ADD_AUDIO_CONSUMER': {
      const { consumerId, producerId, peerId, mediaId } = action.value
      return { ...state, audioConsumers: [ ...state.audioConsumers, { consumerId, producerId, peerId, mediaId }]}
    }
    case 'ADD_VIDEO_CONSUMER': {
      const { consumerId, producerId, peerId, mediaId } = action.value
      return { ...state, videoConsumers: [ ...state.videoConsumers, { consumerId, producerId, peerId, mediaId }]}
    }
    case 'DELETE_AUDIO_CONSUMER': {
      const consumerId = action.value
      return { ...state, audioConsumers: state.audioConsumers.filter( item => item.consumerId !== consumerId ) }
    }
    case 'DELETE_VIDEO_CONSUMER': {
      const consumerId = action.value
      return { ...state, videoConsumers: state.videoConsumers.filter( item => item.consumerId !== consumerId ) }
    }
    case 'SET_STUDIO_PATTERNS': {
      const patterns = action.value
      return { ...state, studio: { ...state.studio, patterns }}
    }
    case 'SET_STUDIO_PATTERN_ID': {
      const patternId = action.value
      return { ...state, studio: { ...state.studio, patternId }}
    }
    case 'SET_STUDIO_SIZE': {
      const { width, height } = action.value
      const studio = { ...state.studio, width, height }
      return { ...state, studio }
    }
    case 'SET_STUDIO_LAYOUT': {
      const studio = { ...state.studio, layout: action.value }
      return { ...state, studio }
    }
    default: {
      return state
    }
  }
}

export const useAppContext = () => {
  const { appData, dispatch, state } = useContext( AppContext )

  const createRoomClient = ( { displayName, roomId } ) => {
    const client = RoomClient.create( { displayName, roomId })

    logger.debug( '"createRoomClient":%o', client )

    dispatch({ type: 'SET_ROOMID', value: roomId })
    dispatch({ type: 'SET_PEERID', value: client.peerId })
    dispatch({ type: 'SET_DISPLAY_NAME', value: displayName })
    dispatch({ type: 'SET_STATUS', value: 'INITIALIZING'})

    _setRoomClientHandler( client, dispatch )

    appData.roomClient = client

    return client.peerId
  }

  const joinRoom = async () => {
    await appData.roomClient.join()
      .catch( err => { throw err })

    logger.debug( 'joinRoom - roomClient:%o', appData.roomClient )
  }

  const close = async () => {
    appData.roomClient.close()
    appData.roomClient = null

    for( const stream of appData.localStreams.values() ) {
      const tracks = stream.getTracks()
      for( const track of tracks ) {
        track.stop()
      }
    }
    appData.localStreams.clear()

    for( const elem of appData.localVideos.values() ) {
      await elem.pause()
      elem.remove()
    }
    appData.localVideos.clear()

    dispatch({ type: 'INIT' })
  }

  const createProducer = async ({ peerId, displayName, stream }) => {
    const { 
      audioProducerId, 
      videoProducerId,
      mediaId
    } = await appData.roomClient.createProducer( stream )
      .catch( err => { throw err } )

    logger.debug( 'createProducer - audioProducerId:%s, videoProducerId: %s', audioProducerId, videoProducerId )

    const localStreamId = `localvideo-${Date.now()}`
    appData.localStreams.set( localStreamId, stream )
    logger.debug( 'localStreams added:%o', appData.localStreams )
    logger.debug( 'state:%o', state )
    dispatch({ 
      type: 'ADD_LOCAL_MEDIA', 
      value: {
        id: peerId,
        displayName,
        audioProducerId,
        videoProducerId,
        mediaId,
        localStreamId
      }
    })

    dispatch({ type: 'SET_STATUS', value: 'READY'})
  }

  const getStudioSize = async () => {
    try {
      const size = await appData.roomClient.getStudioSize()
      logger.debug('"getStudioSize()":%o', size )
      dispatch({ type: 'SET_STUDIO_SIZE', value: size })
    } catch(err) {
      logger.error( 'getStudioSize():%o', err )
    }
  }

  const getStudioPatterns = async () => {
    try {
      const studioPatterns = await appData.roomClient.getStudioPatterns()
      dispatch({ type: 'SET_STUDIO_PATTERNS', value: studioPatterns })
    } catch(err) {
      logger.error( 'getStudioPatterns():%o', err )
    }
  }

  const getStudioPatternId = async () => {
    try {
      const { patternId } = await appData.roomClient.getStudioPatternId()
      logger.debug( 'getStudioPatternId:%d', patternId )
      dispatch({ type: 'SET_STUDIO_PATTERN_ID', value: patternId })
    } catch(err) {
      logger.error( 'getStudioPatternId():%o', err )
    }
  }

  const setStudioPatternId = async patternId => {
    try {
      await appData.roomClient.setStudioPatternId( { patternId } )
    } catch(err) {
      logger.error( 'setStudioPatternId():%o', err )
    }
  }

  const getStudioLayout = async () => {
    try {
      const layout = await appData.roomClient.getStudioLayout()
      logger.debug('"getStudioLayout()":%o', layout )
      dispatch({ type: 'SET_STUDIO_LAYOUT', value: layout })
    } catch( err ) {
      logger.error( 'getStudioLayout():%o', err )
    }
  }

  const addStudioLayout = async ({ peerId, audioProducerId, videoProducerId, videoWidth, videoHeight, mediaId }) => {
    await appData.roomClient.addStudioLayout({ peerId, mediaId, audioProducerId, videoProducerId, videoWidth, videoHeight })
  }

  const deleteStudioLayout = async ({ peerId, audioProducerId, videoProducerId, mediaId }) => {
    await appData.roomClient.deleteStudioLayout({ peerId, mediaId, audioProducerId, videoProducerId })
  }

  return {
    appData,
    getStudioPatterns,
    getStudioPatternId,
    setStudioPatternId,
    getStudioSize,
    getStudioLayout,
    addStudioLayout,
    deleteStudioLayout,
    createRoomClient,
    createProducer,
    joinRoom,
    close,
    state,
    dispatch
  }
}

function _setRoomClientHandler( client, dispatch ) {
  client.on("joined", peers => {
    dispatch({ type: 'SET_PEERS', value: peers } )
  })

  client.on("newPeer", peer => {
    dispatch({ type: 'ADD_PEER', value: peer })
  })

  client.on("studioPatternIdUpdated", ({ patternId }) => {
    dispatch({ type: 'SET_STUDIO_PATTERN_ID', value: patternId })
  } )

  client.on("studioLayoutUpdated", layout => {
    dispatch({ type: 'SET_STUDIO_LAYOUT', value: layout })
  })

  client.on("peerClosed", peerId => {
    dispatch({ type: 'DELETE_PEER', value: peerId })
    logger.debug('"peerClosed" emitted:%s', peerId)

    Array.from(client.consumers.values())
      .filter( c => c.appData.peerId === peerId )
      .forEach( consumer => {
        switch( consumer.kind ) {
          case 'audio': {
            dispatch( { type: 'DELETE_AUDIO_CONSUMER', value: consumer.id } )
            break
          }
          case 'video': {
            dispatch( { type: 'DELETE_VIDEO_CONSUMER', value: consumer.id } )
            break
          }
          default: {
            logger.warn( '"peerClosed" event - unknown kind:%s', consumer.kind )
          }
        }
      })
  })

  client.on("newConsumer", consumer => {
    logger.debug( 'newConsumer:%o', consumer )
    const { mediaId } = consumer.appData
    logger.debug( "mediaId:%o", consumer.appData.mediaId )
    switch( consumer.kind ) {
      case 'audio': {
        dispatch({ type: 'ADD_AUDIO_CONSUMER', value: { consumerId: consumer.id, peerId: consumer.peerId, producerId: consumer.producerId, mediaId } })
        break
      }
      case 'video': {
        dispatch({ type: 'ADD_VIDEO_CONSUMER', value: { consumerId: consumer.id, peerId: consumer.peerId, producerId: consumer.producerId, mediaId } })
        break
      }
      default: {
        logger.warn( 
          '_setRoomClientHandler() - "newConsumer" includes unknown kind:%s', 
          consumer.kind 
        )
      }
    }
  })

  client.on("leaveConsumer", consumer => {
    logger.debug( '"leaveConsumer" emitted:%o', consumer )
    switch( consumer.kind ) {
      case 'audio': {
        dispatch({ type: 'DELETE_AUDIO_CONSUMER', value: consumer.id })
        break
      }
      case 'video': {
        dispatch({ type: 'DELETE_VIDEO_CONSUMER', value: consumer.id })
        break
      }
      default: {
        logger.warn( 
          '_setRoomClientHandler() = "leaveConsumer" includes unknown kind:%s', 
          consumer.kind 
        )
      }
    }
  })
}