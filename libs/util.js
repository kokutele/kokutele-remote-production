const crypto = require('crypto')
const { api } = require('../config')
const Logger = require('./logger')

const logger = new Logger('util')

const getGuestId = roomId => {
  const { secretPhrase } = api
  const key = crypto.scryptSync( secretPhrase, 'salt', 32 )
  const iv = crypto.randomBytes(16)
  const cipher =  crypto.createCipheriv( 'aes-256-cbc', key, iv )

  const encData = cipher.update( Buffer.from( roomId ) )

  return Buffer.concat([ iv, encData, cipher.final() ]).toString('hex')
}

const getRoomId = guestId => {
  const { secretPhrase } = api
  const key = crypto.scryptSync( secretPhrase, 'salt', 32 )

  const buf = Buffer.from( guestId, 'hex')

  const iv = buf.slice( 0, 16 )
  const encData = buf.slice( 16 )

  const decipher = crypto.createDecipheriv( 'aes-256-cbc', key, iv )  
  const decData = decipher.update( encData )

  const roomId = Buffer.concat([decData, decipher.final()]).toString('utf8')

  return roomId
}

const md5 = str => {
  const _md5 = crypto.createHash('md5')
  return _md5.update(str, 'binary').digest('hex')
}

module.exports = {
  getGuestId,
  getRoomId,
  md5
}