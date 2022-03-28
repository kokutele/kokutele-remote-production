let protooPort = 4443

export function getProtooUrl({ roomId, peerId }) {
  const hostname = window.location.hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${hostname}:${protooPort}/?roomId=${roomId}&peerId=${peerId}`
}