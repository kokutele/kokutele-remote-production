const { start } = require('@sitespeed.io/throttle')
const path = require('path')
const DB = require('sqlite-async')
const { md5 } = require('./util')
const Logger = require('./logger')

const logger = new Logger('studio-db')

const DB_DIR = process.env.NODE_ENV === 'development' ? path.join( __dirname, '..' ) : '/var/lib/kokutele-studio'
logger.info( "DB_DIR:%s", DB_DIR )

/**
 * @class
 */
class StudioDB {
  _dbfile = `${DB_DIR}/studio.db`
  _db = null

  /**
   * start
   * 
   * @method StudioDB#start
   */
  start = async () => {
    this._db = await DB.open( this._dbfile )
    await this._migrate()
  }

  /**
   * find of set roomName
   * 
   * @method StudioDB#findOrSetRoomName
   * @param {string} roomName 
   * @returns {string} roomId
   */
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

  /**
   * returns passcode is exist or not
   * 
   * @method StudioDB#isPasscodeExist
   * @param {string} roomId 
   * @returns {boolean}
   */
  isPasscodeExist = async roomId => {
    const passcode = await this._db.get('select id from passcodes where roomId = ?;', roomId )
    logger.info("isPasscodeExist - passcode:%o", passcode )

    return !!passcode
  }

  /**
   * challenge passcode
   * 
   * @method StudioDB#challengePasscode
   * @param {object} props 
   * @param {string} props.roomName
   * @param {string} props.passcode
   * @returns {object}
   */
  challengePasscode = async ( { roomName, passcode } ) => {
    const _passcode = md5( passcode )

    const res = await this._db.get(
      'select t1.id from rooms as t0, passcodes as t1 where t0.name = ? and t0.id = t1.roomId and t1.passcode = ?;', 
      [ roomName, _passcode ]
    )

    return res
  }

  /**
   * set passcode 
   * 
   * @method StudioDB#setPasscode
   * @param {object} props 
   * @param {string} props.roomName
   * @param {string} props.passcode
   */
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

  /////////////////////////////////////////
  // Covers
  /////////////////////////////////////////

  /**
   * get cover urls 
   * 
   * @method StudioDB#getCoverUrls
   * @param {string} roomName 
   * @returns {Array<Object>} - Array<{id:String, url:String}>
   */
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

  /**
   * set cover url
   * 
   * @method StudioDB#setCoverUrl
   * @param {object} props 
   * @param {string} props.roomName
   * @param {string} props.url
   * @returns {Array<Object>} - Array<{id:String, url:String}>
   */
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

  /**
   * delete cover url
   * 
   * @method StudioDB#deleteCoverUrl
   * @param {object} props 
   * @param {string} props.roomName 
   * @param {number} props.id 
   * @returns {Array<Object>} - Arrray<{id:Number, url:String}>
   */
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
  
  /////////////////////////////////////////
  // Backgrounds 
  /////////////////////////////////////////

  /**
   * get background urls 
   * 
   * @method StudioDB#getBackgroundUrls
   * @param {string} roomName 
   * @returns {Array<Object>} - Array<{id:Number, url:String}>
   */
  getBackgroundUrls = async ( roomName ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    const res = await this._db.all('select id, url from backgrounds where roomId = ?;', room.id )

    return !!res ? res : []
  }

  /**
   * set background url 
   * 
   * @method StudioDB#setBackgroundUrl
   * @param {object} props 
   * @param {string} props.roomName 
   * @param {string} props.url 
   * @returns {Array<Object>} - Array<{ id:Number, url:String}>
   */
  setBackgroundUrl = async ( { roomName, url } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    await this._db.run('insert into backgrounds ( roomId, url ) values ( ?, ? );', [ room.id, url ] )

    const res = await this._db.all('select id, url from backgrounds where roomId = ?;', room.id )

    return !!res ? res : []
  }

  /**
   * delete background url 
   * 
   * @method StudioDB#deleteBackgroundUrl
   * @param {object} props 
   * @param {string} props.roomName 
   * @param {number} props.id 
   * @returns {Array<Object>} - Array<{ id:Number, url:String}>
   */
  deleteBackgroundUrl = async ( { roomName, id } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    await this._db.run('delete from backgrounds where id = ? and roomId = ?;', [ id, room.id ] )

    const res = await this._db.all('select id, url from backgrounds where roomId = ?;', room.id )

    return !!res ? res : []
  }

  /////////////////////////////////////////
  // Captions 
  /////////////////////////////////////////

  /**
   * get captions 
   * 
   * @method StudioDB#getCaptions
   * @param {string} roomName 
   * @returns {Array<Object>} - Array<{id:Number, caption:String}>
   */
  getCaptions = async ( roomName ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    const res = await this._db.all('select id, caption from captions where roomId = ?;', room.id )

    return !!res ? res : []
  }

  /**
   * add caption
   * 
   * @method StudioDB#addCaption
   * @param {object} props 
   * @param {string} props.roomName 
   * @param {string} props.caption 
   * @returns {Array<Object>} - Array<{ id:Number, caption:String}>
   */
  addCaption = async ( { roomName, caption } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    await this._db.run('insert into captions ( roomId, caption ) values ( ?, ? );', [ room.id, caption ] )

    const res = await this._db.all('select id, caption from captions where roomId = ?;', room.id )

    return !!res ? res : []
  }

  /**
   * delete caption
   * 
   * @method StudioDB#deleteCaption
   * @param {object} props 
   * @param {string} props.roomName 
   * @param {number} props.id 
   * @returns {Array<Object>} - Array<{ id:Number, caption:String}>
   */
  deleteCaption = async ( { roomName, id } ) => {
    const room = await this._db.get('select id from rooms where name = ?;', roomName )

    if( !room ) {
      const err = new Error(`no roomName:${roomName} found.`)
      err.status = 404
      throw err
    }

    await this._db.run('delete from captions where id = ? and roomId = ?;', [ id, room.id ] )

    const res = await this._db.all('select id, caption from captions where roomId = ?;', room.id )

    return !!res ? res : []
  }
 
  /////////////////////////////////////////
  // private methods
  /////////////////////////////////////////
 
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

    const sqlBackgrounds = [
      "create table if not exists backgrounds(",
      "  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,",
      "  roomId INTEGER NOT NULL,",
      "  url TEXT NOT NULL",
      ");"
    ].join("")

    await this._db.run( sqlBackgrounds )

    const sqlCaptions = [
      "create table if not exists captions(",
      "  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,",
      "  roomId INTEGER NOT NULL,",
      "  caption TEXT NOT NULL",
      ");"
    ].join("")

    await this._db.run( sqlCaptions )
  }
}

module.exports = StudioDB