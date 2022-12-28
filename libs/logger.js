const debug = require('debug');

const APP_NAME = 'kokutele-remote-production';

/**
 * @class
 */
class Logger {
	/**
	 * 
	 * @constructor
	 * @param {string} prefix 
	 */
	constructor(prefix) {
		if (prefix) {
			this._debug = debug(`${APP_NAME}:${prefix}`);
			this._info = debug(`${APP_NAME}:INFO:${prefix}`);
			this._warn = debug(`${APP_NAME}:WARN:${prefix}`);
			this._error = debug(`${APP_NAME}:ERROR:${prefix}`);
		} else {
			this._debug = debug(APP_NAME);
			this._info = debug(`${APP_NAME}:INFO`);
			this._warn = debug(`${APP_NAME}:WARN`);
			this._error = debug(`${APP_NAME}:ERROR`);
		}
    debug(`prefix = ${prefix}`)

		/* eslint-disable no-console */
		this._debug.log = console.info.bind(console);
		this._info.log = console.info.bind(console);
		this._warn.log = console.warn.bind(console);
		this._error.log = console.error.bind(console);
		/* eslint-enable no-console */
	}

	/**
	 * debug
	 * 
	 * @type {function}
	 */
	get debug()
	{
		return this._debug;
	}

	/**
	 * info
	 * 
	 * @type {function}
	 */
	get info()
	{
		return this._info;
	}

	/**
	 * warn
	 * 
	 * @type {function}
	 */
	get warn()
	{
		return this._warn;
	}

	/**
	 * error
	 * 
	 * @type {function}
	 */
	get error()
	{
		return this._error;
	}
}

module.exports = Logger;