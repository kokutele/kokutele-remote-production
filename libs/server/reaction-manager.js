const Logger = require("../logger")
const { EventEmitter } = require("events")

const logger = new Logger("reaction-manager")

/**
 * @class
 */
class ReactionManager extends EventEmitter {
  _numReaction = { sum: 0 }
  _timer = null
  _roomId = null

  /**
   * number of reaction
   * 
   * @type {number}
   */
  get numReaction() {
    return this._numReaction
  }

  /**
   * start reaction manager
   * 
   * @method ReactionManager#start
   * @param {string} roomId 
   */
  start( roomId ) {
    this._roomId = roomId

    this._timer = setInterval( () => {
      this.emit(`reactions/${this._roomId}`, this._numReaction )
      this._numReaction.sum = 0
    }, 1000 )
  }

  /**
   * destroy reaction manager
   * 
   * @method ReactionManager#destroy
   */
  destroy() {
    if( this._timer ) clearInterval( this._timer )
  }
  
  /**
   * add reaction
   * here, `reactionId` does not effect. just counting :\
   * 
   * @method ReactionManager#add
   * @param {number} reactionId 
   */
  add( reactionId ) {
    this._numReaction.sum++
  }
}

module.exports = ReactionManager