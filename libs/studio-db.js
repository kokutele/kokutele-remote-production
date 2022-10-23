const { start } = require('@sitespeed.io/throttle')
const path = require('path')
const DB = require('sqlite-async')
const { md5 } = require('./util')
const Logger = require('./logger')

const logger = new Logger('studio-db')

const DB_DIR = process.env.NODE_ENV === 'development' ? path.join( __dirname, '..' ) : '/var/lib/kokutele-studio'
logger.info( "DB_DIR:%s", DB_DIR )

class StudioDB {
  _dbfile = `${DB_DIR}/studio.db`
  _db = null

  start = async () => {
    this._db = await DB.open( this._dbfile )
    await this._migrate()
  }

  findOrSetRoomName = async roomName => {
    let roomId

    const room = await this._db.get('select id from rooms where name = ?;', [ roomName ] )

    if( room ) {
      roomId = room.id
    } else {
      const res = await this._db.run('insert into rooms ( name ) values ( ? );', [ roomName ])
      roomId = res.lastID
    } 
    logger.info("findOrSetRoomName - roomName:%s, roomId:%d", roomName, roomId )

    return roomId
  }

  isPasscodeExist = async roomId => {
    const passcode = await this._db.get('select id from passcodes where roomId = ?;', roomId )
    logger.info("isPasscodeExist - passcode:%o", passcode )

    return !!passcode
  }

  challengePasscode = async ( { roomName, passcode } ) => {
    const _passcode = md5( passcode )

    const res = await this._db.get(
      'select t1.id from rooms as t0, passcodes as t1 where t0.name = ? and t0.id = t1.roomId and t1.passcode = ?;', 
      [ roomName, _passcode ]
    )

    return res
  }

  setPasscode = async ( { roomName, passcode } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    const res = await this._db.get('select id from passcodes where roomId = ? ;', room.id )
    const _passcode = md5( passcode )

    if( res ) {
      await this._db.run('update passcodes set passcode = ? where roomId = ?;', [ _passcode, room.id ])
    } else {
      await this._db.run('insert into passcodes ( roomId, passcode ) values ( ?, ? );', [ room.id, _passcode ] )
    }
  }

  getCoverUrls = async ( roomName ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    const res = await this._db.all('select id, url from covers where roomId = ?;', room.id )

    return !!res ? res : []
  }

  setCoverUrl = async ( { roomName, url } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    await this._db.run('insert into covers ( roomId, url ) values ( ?, ? );', [ room.id, url ] )

    const res = await this._db.all('select id, url from covers where roomId = ?;', room.id )

    return !!res ? res : []
  }

  deleteCoverUrl = async ( { roomName, id } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    await this._db.run('delete from covers where id = ? and roomId = ?;', [ id, room.id ] )

    const res = await this._db.all('select id, url from covers where roomId = ?;', room.id )

    return !!res ? res : []
  }
  
  _migrate = async () => {
    const sqlRooms = [
      "create table if not exists rooms(",
      "  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,",
      "  name TEXT NOT NULL UNIQUE",
      ");"
    ].join("")

    await this._db.run( sqlRooms )

    const sqlPasscodes = [
      "create table if not exists passcodes(",
      "  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,",
      "  roomId INTEGER NOT NULL,",
      "  passcode TEXT NOT NULL",
      ");"
    ].join("")

    await this._db.run( sqlPasscodes )
    
    const sqlCovers = [
      "create table if not exists covers(",
      "  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,",
      "  roomId INTEGER NOT NULL,",
      "  url TEXT NOT NULL",
      ");"
    ].join("")

    await this._db.run( sqlCovers )
  }
}

module.exports = StudioDB