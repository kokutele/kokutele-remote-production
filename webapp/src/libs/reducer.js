import { useContext } from 'react';
import RoomClient from './room-client';
import { AppContext } from '../App'
import Logger from './logger';

const logger = new Logger("reducer")

export const initialState = {
  status: 'IDLE',
  peerId: '',
  displayName: '',
  peers: [],
  audioConsumers: [], // Array<{ id:String, kind:String }>
  videoConsumers: [], // Array<{ id:String, kind:String }>
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
    case 'DELETE_PEER': {
      return { 
        ...state, 
        peers: state.peers.filter( peer => peer.id !== action.value )
      }
    }
    case 'ADD_AUDIO_CONSUMER': {
      return { 
        ...state, 
        audioConsumers: [ ...state.audioConsumers, action.value ]
      }
    }
    case 'DELETE_AUDIO_CONSUMER': {
      return { 
        ...state, 
        audioConsumers: state.audioConsumers.filter( id => id !== action.value )
      }
    }
    case 'ADD_VIDEO_CONSUMER': {
      return {
        ...state,
        videoConsumers: [ ...state.videoConsumers, action.value ]
      }
    }
    case 'DELETE_VIDEO_CONSUMER': {
      return  {
        ...state,
        videoConsumers: state.videoConsumers.filter( id => id !== action.value )
      }
    }
    default: {
      return state
    }
  }
}

export const useAppContext = () => {
  const { appData, dispatch, state } = useContext( AppContext )

  const createRoomClient = ( { stream, displayName } ) => {
    const client = RoomClient.create( { stream, displayName })
    appData.myStream = stream

    dispatch({ type: 'SET_PEERID', value: client.peerId })
    dispatch({ type: 'SET_DISPLAY_NAME', value: displayName })
    dispatch({ type: 'SET_STATUS', value: 'INITIALIZING'})

    _setRoomClientHandler( client, dispatch )

    appData.roomClient = client
  }

  const joinRoom = async () => {
    await appData.roomClient.join()
      .catch( err => { throw err })

    dispatch({ type: 'SET_STATUS', value: 'READY'})
  }

  return {
    appData,
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
    switch( consumer.kind ) {
      case 'audio': {
        dispatch({ type: 'ADD_AUDIO_CONSUMER', value: consumer.id })
        break
      }
      case 'video': {
        dispatch( { type: 'ADD_VIDEO_CONSUMER', value: consumer.id })
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