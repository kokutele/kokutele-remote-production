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
  productionLayout: [], // Array<{ 
                    //   consumerId:String, 
                    //   xpos:Number, 
                    //   ypos:Number,
                    //   width:Number, 
                    //   height:Number,
                    //   zorder:Number
                    // }>
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
    // case 'ADD_AUDIO_CONSUMER_ID': {
    //   return { 
    //     ...state, 
    //     audioConsumerIds: [ ...state.audioConsumerIds, action.value ]
    //   }
    // }
    // case 'DELETE_AUDIO_CONSUMER_ID': {
    //   return { 
    //     ...state, 
    //     audioConsumerIds: state.audioConsumerIds.filter( id => id !== action.value )
    //   }
    // }
    // case 'ADD_VIDEO_CONSUMER_ID': {
    //   return {
    //     ...state,
    //     videoConsumerIds: [ ...state.videoConsumerIds, action.value ]
    //   }
    // }
    // case 'DELETE_VIDEO_CONSUMER_ID': {
    //   return  {
    //     ...state,
    //     videoConsumerIds: state.videoConsumerIds.filter( id => id !== action.value )
    //   }
    // }
    case 'SET_MY_AUDIO_PRODUCER_ID': {
      return { ...state, audioProducerId: action.value }
    }
    case 'SET_MY_VIDEO_PRODUCER_ID': {
      return { ...state, videoProducerId: action.value }
    }
    case 'SET_PRODUCTION_LAYOUT': {
      return { ...state, productionLayout: action.value }
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

    logger.debug( 'joinRoom - roomClient:%o', appData.roomClient )
    logger.debug( 'joinRoom - audioProducer:%o', appData.roomClient.audioProducer )
    logger.debug( 'joinRoom - videoProducer:%o', appData.roomClient.videoProducer )
    dispatch( { 
      type: 'SET_MY_AUDIO_PRODUCER_ID', 
      value: appData.roomClient.audioProducer.id}
    )
    dispatch( { 
      type: 'SET_MY_VIDEO_PRODUCER_ID', 
      value: appData.roomClient.videoProducer.id}
    )

    dispatch({ type: 'SET_STATUS', value: 'READY'})
  }

  const getProductionLayout = async () => {
    try {
      const layout = await appData.roomClient.getProductionLayout()
      logger.debug('"getProductionLayout()":%o', layout )
      dispatch({ type: 'SET_PRODUCTION_LAYOUT', value: layout })
    } catch( err ) {
      logger.error( 'getProductionLayout():%o', err )
    }
  }

  const addProductionLayout = async ({ peerId, audioProducerId, videoProducerId, videoWidth, videoHeight }) => {
    await appData.roomClient.addProductionLayout({ peerId, audioProducerId, videoProducerId, videoWidth, videoHeight })
  }

  const leaveProductionLayout = async ({ peerId, audioProducerId, videoProducerId }) => {
    await appData.roomClient.leaveProductionLayout({ peerId, audioProducerId, videoProducerId })
  }

  return {
    appData,
    addProductionLayout,
    getProductionLayout,
    leaveProductionLayout,
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

  client.on("productionLayoutUpdated", layout => {
    dispatch({ type: 'SET_PRODUCTION_LAYOUT', value: layout })
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
        dispatch({ type: 'ADD_AUDIO_CONSUMER_ID', value: consumer.id })
        dispatch({ type: 'SET_AUDIO_CONSUMER_ID', value: { peerId: consumer.peerId, consumerId: consumer.id } })
        dispatch({ type: 'SET_AUDIO_PRODUCER_ID', value: { peerId: consumer.peerId, producerId: consumer.producerId } })
        break
      }
      case 'video': {
        dispatch({ type: 'ADD_VIDEO_CONSUMER_ID', value: consumer.id })
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