import { useContext } from 'react';
import RoomClient from './room-client';
import { AppContext } from '../App'
import { useSimulcast } from '../config'
import Logger from './logger';

const logger = new Logger("reducer")

export const initialState = {
  status: 'IDLE',
  roomId: '',
  peerId: '',
  displayName: '',
  localMedias: [], // Array<{ id, displayName, audioProducerId, videoProducerId, localStreamId }>
  peers: [],
  caption: '',
  logo: '',
  audioConsumers: [],
  videoConsumers: [],
  studio: {
    coverUrl: '',
    width: 0,
    height: 0,
    layout: [],
    patterns: [],
    patternId: 0, 
    participants: [],
    reactions: { sum: 0, lastUpdated: Date.now() }
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
    case 'SET_ROOM_ID': {
      return { ...state, roomId: action.value }
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
    case 'SET_CAPTION': {
      return { ...state, caption: action.value }
    }
    case 'SET_LOGO': {
      return { ...state, logo: action.value }
    }
    case 'SET_COVER_URL': {
      return { ...state, studio: { ...state.studio, coverUrl: action.value } }
    }
    case 'ADD_PEER': {
      return { ...state, peers: [...state.peers, action.value ]}
    }
    case 'DELETE_PEER': {
      return { 
        ...state, 
        peers: state.peers.filter( peer => peer.id !== action.value )
      }
    }
    case 'ADD_LOCAL_MEDIA': {
      return { ...state, localMedias: [ ...state.localMedias, action.value ] }
    }
    case 'DELETE_LOCAL_MEDIA': {
      return { ...state, localMedias: state.localMedias.filter( item => ( 
        item.audioProducerId !== action.value.audioProducerId || item.videoProducerId !== action.value.videoProducerId
      ))}
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
    case 'SET_STUDIO_PARTICIPANTS': {
      const participants = action.value
      return { ...state, studio: { ...state.studio, participants }}
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
    case 'REACTIONS_UPDATED': {
      const reactions = { ...action.value, lastUpdated: Date.now() }
      const studio = { ...state.studio, reactions }
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
    const client = RoomClient.create( { displayName, roomId, useSimulcast })

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

  // for StudioViewer
  const setStatusReady = () => {
    dispatch({ type: 'SET_STATUS', value: 'READY' })

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
      elem.pause()
      elem.remove()
    }
    appData.localVideos.clear()

    dispatch({ type: 'INIT' })
  }

  const createProducer = async ({ peerId, displayName, stream, isCapture }) => {
    const { 
      audioProducerId, 
      videoProducerId,
      mediaId
    } = await appData.roomClient.createProducer( stream, !!isCapture )
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

    return { localStreamId, mediaId }
  }

  const replaceStream = async stream => {
    await appData.roomClient.replaceStream( stream )
  }

  const  deleteProducer = async ( { audioProducerId, videoProducerId } ) => {
    logger.debug('deleteProducer:%s, %s', audioProducerId, videoProducerId )
    appData.roomClient.closeProducer( audioProducerId )
    appData.roomClient.closeProducer( videoProducerId )
    dispatch({ type: 'DELETE_LOCAL_MEDIA', value: { audioProducerId, videoProducerId }})
  }

  const deleteLocalStream = async streamId => {
    logger.debug('deleteLocalStream:%s',streamId )

    const localStream = appData.localStreams.get( streamId )
    if( localStream ) {
      const tracks = localStream.getTracks()
      for( const track of tracks ) {
        track.stop()
      }
      appData.localStreams.delete( streamId )
    }

    const localVideo = appData.localVideos.get( streamId )
    if( localVideo ) {
      localVideo.pause()
      localVideo.remove()
      appData.localVideos.delete( streamId )
    }

    logger.debug('appData:%o', appData )
  }

  const setRoomId = name => {
    dispatch({ type: 'SET_ROOM_ID', value: name })
  }

  const setCaption = str => {
    const caption = !!str ? str : ''
    dispatch({ type: 'SET_CAPTION', value: caption })
    appData.roomClient.setCaption( caption )
  }

  const getCaption = async () => {
    const data = await appData.roomClient.getCaption()
      .catch( err => { return { caption: '' } })
    dispatch({ type: 'SET_CAPTION', value: data.caption })
  }

  const setCoverUrl = async url => {
    await appData.roomClient.setCoverUrl( url )
  }

  const getCoverUrl = async () => {
    const data = await appData.roomClient.getCoverUrl()
    dispatch({ type: 'SET_COVER_URL', value: data.coverUrl })
  }

  const setLogo = str => {
    dispatch({ type: 'SET_LOGO', value: !!str ? str : '' })
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

  const toMainInStudioLayout = async layoutIdx => {
    await appData.roomClient.toMainInStudioLayout( layoutIdx )
  }

  const getStudioParticipants = async () => {
    try {
      const participants = await appData.roomClient.getStudioParticipants()
      dispatch({ type: 'SET_STUDIO_PARTICIPANTS', value: participants })
    } catch( err ) {
      logger.error( 'getStudioParticipants():%o', err )
    }
  }

  const addParticipant = async ({ peerId, mediaId, displayName, audio, video }) => {
    try {
      await appData.roomClient.addParticipant({ peerId, mediaId, displayName, audio, video })
    } catch( err ) {
      logger.error( 'addParticipant():%o', err )
    }
  }

  const updateParticipantAudio = async ({ mediaId, audio }) => {
    try {
      await appData.roomClient.updateParticipantAudio({ mediaId, audio })
    } catch( err ) {
      logger.error( 'updateParticipantAudio():%o', err )
    }
  }

  const updateParticipantVideo = async ({ mediaId, video }) => {
    try {
      await appData.roomClient.updateParticipantVideo({ mediaId, video })
    } catch( err ) {
      logger.error( 'updateParticipantVideo():%o', err )
    }
  }

  const deleteParticipantByMediaId = async ({ mediaId }) => {
    try {
      await appData.roomClient.deleteParticipantByMediaId({ mediaId })
    } catch( err ) {
      logger.error( 'deleteParticipantByMediaId():%o', err )
    }
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
    getStudioParticipants,
    addParticipant,
    updateParticipantAudio,
    updateParticipantVideo,
    deleteParticipantByMediaId,
    setRoomId,
    getCaption,
    setCaption,
    setLogo,
    getCoverUrl,
    setCoverUrl,
    toMainInStudioLayout,
    createRoomClient,
    createProducer,
    replaceStream,
    deleteProducer,
    deleteLocalStream,
    joinRoom,
    setStatusReady,
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

  client.on("studioParticipantsUpdated", participants => {
    dispatch({ type: 'SET_STUDIO_PARTICIPANTS', value: participants })
  })

  client.on("reactionsUpdated", data => {
    dispatch({ type: 'REACTIONS_UPDATED', value: data })
  })

  client.on("setCaption", data => {
    dispatch({ type: 'SET_CAPTION', value: data.caption })
  })

  client.on("setCoverUrl", data => {
    dispatch({ type: 'SET_COVER_URL', value: data.coverUrl })
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