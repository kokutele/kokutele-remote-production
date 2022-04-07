const config = require( '../config' )

const addon = config.studio.useMixer ? require('bindings')('addon') : {}

module.exports = addon.MediaMixer