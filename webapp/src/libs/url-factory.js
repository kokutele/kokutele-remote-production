let protooPort = process.env.NODE_ENV === 'development' ? 4443 : window.location.port

export function getProtooUrl({ roomId, peerId }) {
  const hostname = window.location.hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${hostname}:${protooPort}/?roomId=${roomId}&peerId=${peerId}`
}

console.log( process.env.NODE_ENV )
export const apiEndpoint = process.env.NODE_ENV==='development' ? 'http://localhost:4443/api' : '/api'
console.log( apiEndpoint )                         