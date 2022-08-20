const Logger = require("../logger")
const { EventEmitter } = require("events")

const logger = new Logger("reaction-manager")

class ReactionManager extends EventEmitter {
  _numReaction = { sum: 0 }
  _timer = null
  _roomId = null


  start( roomId ) {
    this._roomId = roomId

    this._timer = setInterval( () => {
      this.emit(`reactions/${this._roomId}`, this._numReaction )
      this._numReaction.sum = 0
    }, 1000 )
  }

  destroy() {
    if( this._timer ) clearInterval( this._timer )
  }
  
  add( reactionId ) {
    this._numReaction.sum++
  }
}

module.exports = ReactionManager