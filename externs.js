
/** @typedef {{get: function(string):(string|number|boolean),
 *             set: function(string,string):void,
 *             id: string}} Roll20Object */
var Roll20Object;

/**
 * @returns {!Roll20Object}
 */
function Campaign() {}

function createObj(type, attributes) {}

/**
 *
 * @param {function(Roll20Object):boolean} callback
 * @returns {!Array<!Roll20Object>}
 */
function filterObjs(callback) {}

function findObjs(attributes, options) {}

/**
 * @returns {!Array<!Roll20Object>}
 */
function getAllObjs() {}

/**
 * Get an attribute from a character directly.
 * @param {string} character_id The character Id.
 * @param {string} attribute_name The attribute name.
 * @param {string=} value_type Either current or max.
 * @returns {?string}
 */
function getAttrByName(character_id, attribute_name, value_type) {}

/**
 *
 * @param {string} type
 * @param {string} id
 * @returns {?Roll20Object}
 */
function getObj(type, id) {}

/**
 * Print a message to the console tab.
 * @param {string} message The message
 * @returns {void}
 */
function log(message) {}

function on(event, callback) {}

function onSheetWorkerCompleted(callback) {}

/**
 * @param {string} player_id
 * @returns {boolean}
 */
function playerIsGM(player_id) {}

function playJukeboxPlaylist(playlist_id) {}

/**
 * @param {number} max
 * @returns {number}
 */
function randomInteger(max) {}

/**
 * Sends chat to the chat window.
 * @param {string} speakingAs
 * @param {string} message
 * @param {!Object=} object
 */
function sendChat(speakingAs, message, object) {}

function sendPing(left, top, page_id, player_id, moveall) {}

var state = {}

