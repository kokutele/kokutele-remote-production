import { useContext } from 'react';
import RoomClient from './room-client';
import { AppContext } from '../App'
import Logger from './logger';

const logger = new Logger("reducer")

export const initialState = {
  status: 'IDLE',
  peerId: '',
  displayName: '',
  audioProducerId: '',
  videoProducerId: '',
  peers: [],
  studio: {
    width: 0,
    height: 0,
    layout: [] 
  }
}

export const reducer = ( state, action ) => {
  switch( action.type ) {
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
    case 'SET_AUDIO_CONSUMER_ID': {
      const { peerId, consumerId } = action.value
      const peers = state.peers.concat() // clone Array

      return { ...state, peers: peers.map( peer => (
        peer.id === peerId ? { ...peer, audioConsumerId: consumerId } : peer ) 
      )}
    }
    case 'SET_AUDIO_PRODUCER_ID': {
      const { peerId, producerId } = action.value
      const peers = state.peers.concat() // clone Array

      return { ...state, peers: peers.map( peer => (
        peer.id === peerId ? { ...peer, audioProducerId: producerId } : peer ) 
      )}
    }
    case 'SET_VIDEO_CONSUMER_ID': {
      const { peerId, consumerId } = action.value
      const peers = state.peers.concat() // clone Array

      return { ...state, peers: peers.map( peer => (
        peer.id === peerId ? { ...peer, videoConsumerId: consumerId } : peer ) 
      )}
    }
    case 'SET_VIDEO_PRODUCER_ID': {
      const { peerId, producerId } = action.value
      const peers = state.peers.concat() // clone Array

      return { ...state, peers: peers.map( peer => (
        peer.id === peerId ? { ...peer, videoProducerId: producerId } : peer ) 
      )}
    }
    case 'DELETE_PEER': {
      return { 
        ...state, 
        peers: state.peers.filter( peer => peer.id !== action.value )
      }
    }
    case 'SET_MY_AUDIO_PRODUCER_ID': {
      return { ...state, audioProducerId: action.value }
    }
    case 'SET_MY_VIDEO_PRODUCER_ID': {
      return { ...state, videoProducerId: action.value }
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

  const createRoomClient = ( { stream, displayName, roomId } ) => {
    const client = RoomClient.create( { stream, displayName, roomId })

    logger.debug( '"createRoomClient":%o', client )

    dispatch({ type: 'SET_ROOMID', value: roomId })
    dispatch({ type: 'SET_PEERID', value: client.peerId })
    dispatch({ type: 'SET_DISPLAY_NAME', value: displayName })
    dispatch({ type: 'SET_STATUS', value: 'INITIALIZING'})

    _setRoomClientHandler( client, dispatch )

    appData.myStream = stream
    appData.roomClient = client
  }

  const joinRoom = async () => {
    await appData.roomClient.join()
      .catch( err => { throw err })

    logger.debug( 'joinRoom - roomClient:%o', appData.roomClient )
    logger.debug( 'joinRoom - audioProducer:%o', appData.roomClient.audioProducer )
    logger.debug( 'joinRoom - videoProducer:%o', appData.roomClient.videoProducer )

    if( appData.roomClient.audioProducer) {
      dispatch( { 
        type: 'SET_MY_AUDIO_PRODUCER_ID', 
        value: appData.roomClient.audioProducer.id}
      )
    }

    if( appData.roomClient.videoProducer ) {
      dispatch( { 
        type: 'SET_MY_VIDEO_PRODUCER_ID', 
        value: appData.roomClient.videoProducer.id}
      )
    }

    dispatch({ type: 'SET_STATUS', value: 'READY'})
  }

  const getStudioSize = async () => {
    try {
      const size = await appData.roomClient.getStudioSize()
      logger.debug('"getStudioSize()":%o', size )
      dispatch({ type: 'SET_STUDIO_SIZE', value: size })
    } catch(err) {
      logger.error( 'getStudioSize():%o', err)
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

  const addStudioLayout = async ({ peerId, audioProducerId, videoProducerId, videoWidth, videoHeight }) => {
    await appData.roomClient.addStudioLayout({ peerId, audioProducerId, videoProducerId, videoWidth, videoHeight })
  }

  const deleteStudioLayout = async ({ peerId, audioProducerId, videoProducerId }) => {
    await appData.roomClient.deleteStudioLayout({ peerId, audioProducerId, videoProducerId })
  }

  return {
    appData,
    getStudioSize,
    getStudioLayout,
    addStudioLayout,
    deleteStudioLayout,
    createRoomClient,
    joinRoom,
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
            dispatch( { type: 'DELETE_AUDIO_CONSUMER_ID', value: consumer.id } )
            break
          }
          case 'video': {
            dispatch( { type: 'DELETE_VIDEO_CONSUMER_ID', value: consumer.id } )
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
    switch( consumer.kind ) {
      case 'audio': {
        dispatch({ type: 'SET_AUDIO_CONSUMER_ID', value: { peerId: consumer.peerId, consumerId: consumer.id } })
        dispatch({ type: 'SET_AUDIO_PRODUCER_ID', value: { peerId: consumer.peerId, producerId: consumer.producerId } })
        break
      }
      case 'video': {
        dispatch({ type: 'SET_VIDEO_CONSUMER_ID', value: { peerId: consumer.peerId, consumerId: consumer.id } })
        dispatch({ type: 'SET_VIDEO_PRODUCER_ID', value: { peerId: consumer.peerId, producerId: consumer.producerId } })
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
        dispatch({ type: 'DELETE_AUDIO_CONSUMER_ID', value: consumer.id })
        break
      }
      case 'video': {
        dispatch({ type: 'DELETE_VIDEO_CONSUMER_ID', value: consumer.id })
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