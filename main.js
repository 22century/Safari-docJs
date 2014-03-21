/**
 * Safari docJs
 *
 * @author 22century
 * @license MIT license.
 * @version 0.5
 */

var cheerio = require('cheerio'),
    XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest,
    fs = require('fs');

/**
 * @constant
 */
const CONSTANT = {
    REF_HOME  : 'https://developer.apple.com/library/safari/documentation/UserExperience/Reference/SafariExtensionsReference/',
    REF_INDEX : '_index.html',
    FILE_DOC  : 'build/safari.js',
    TYPE_MAP: {
        'any'                 : '*',
        'DOMString'           : 'string',
        'array'               : 'Array',
        'int'                 : 'number',
        'long'                : 'number',
        'unsigned'            : 'number',
        'DOMTimeStamp'        : 'number',
        'DOMWindow'           : 'Window',
        'SafariEventListener' : 'function',
        'void'                : 'void',
        'boolean'             : 'boolean',
        'number'              : 'number',
        'string'              : 'string',
        'BeforeLoadEvent'     : 'event'
    },
    DEFAULT_MAP: {
        'string'  : '\'\'',
        'Array'   : '[]',
        'number'  : '0',
        'boolean' : 'false'
    }
};

/**
 * @constructor
 */
function Main(){
    this._buffer = [];
    this.initialize();
}

Main.prototype = {

    /**
     * @returns {void}
     */
    initialize: function(){
        var indexHtml = this.syncRequest(CONSTANT.REF_HOME + CONSTANT.REF_INDEX);
        var $ = cheerio.load(indexHtml);
        var uris = [];

        $('ol.collectionColumn > li.forums > a').each(function(i, elm){
            uris.push($(elm).attr('href'));
        }.bind(this));

        this.pushDocHeader();
        this.pushDoc('type', 'SafariNamespace');
        this.pushDocFooter();
        this.pushBuf('window.safari = {};');

        uris.forEach(this.syncRequestDocs, this);

        this.syncWrite(this._buffer.join('\n'));
    },

    /**
     * @param {string} uri
     */
    syncRequestDocs: function(uri){

        console.log('open: ' + uri);

        var refsHtml = this.syncRequest(CONSTANT.REF_HOME + uri);
        var $ = cheerio.load(refsHtml);

        // Class

        var classDoc = this.getClassDoc($);
        this.pushDocHeader();
        this.pushDoc('type', classDoc.type);

        if (classDoc.inherit) {
            this.pushDoc('augments', classDoc.augments);
        }

        this.pushDocFooter();
        this.pushBuf('window.' + classDoc.name + ' = {};');

        // Properties

        if (this.hasProperties($)) {
            $('.jump.javascriptProperty').each(function(i, elm){

                var declaration = $(elm).next().next();
                var doc = this.getPropertyDoc(declaration.text());

                this.pushDocHeader();
                this.pushDescription($(elm).next().text());

                if (doc.readonly) {
                    this.pushDoc('readonly');
                }

                this.pushDoc('type', doc.type);
                this.pushDocFooter();

                this.pushBuf(
                    ['window', classDoc.name, doc.name].join('.') , ' = ' , doc.value , ';'
                );

            }.bind(this));
        }

        // Methods

        if (this.hasMethods($)) {
            $('.api.method .jump.method').each(function(i, elm){

                var declaration = $(elm).next().next();
                var doc = this.getMethodDoc(declaration.text());

                this.pushDocHeader();
                this.pushDescription($(elm).next().text());

                doc.params.forEach(function(param){
                    this.pushDoc('param', param.type, param.name);
                }, this);

                this.pushDoc('returns', doc.returns);
                this.pushDocFooter();

                this.pushBuf(
                    ['window', classDoc.name, doc.name].join('.'),
                    ' = function(' + doc.args.join(', ') + ')',
                    ( doc.returns === 'void' ? '{};' : '{ return null; };')
                );

            }.bind(this));
        }

        // Constants

        if (this.hasConstants($)) {
            $('code.jump.constantName').each(function(i, elm){

                this.pushDocHeader();
                this.pushDoc('constant');
                this.pushDoc('type', 'number');
                this.pushDocFooter();

                this.pushBuf(
                    ['window', classDoc.name, $(elm).text().trim()].join('.'),
                    ' = null;'
                );

            }.bind(this));
        }

    },

    /**
     * @returns {void}
     */
    pushBuf: function(){
        var line = '';
        for (var i = 0, l = arguments.length; i < l; i++) {
            line += arguments[i];
        }
        // console.log(line);
        this._buffer.push(line);
    },

    /**
     * @param {string} description
     */
    pushDescription: function(description){
        this.pushBuf(' * @description ' + description.trim());
    },

    /**
     * @param {string} attr
     * @param {string} type...
     * @param {string} name...
     * @returns {void}
     */
    pushDoc: function(attr, type, name){
        var arr = [];
        arr.push(' * @' + attr);

        if (typeof type === 'string') {
            arr.push('{' + type + '}');
        }
        if (typeof name === 'string') {
            arr.push(name);
        }
        this.pushBuf(arr.join(' '));
    },

    /**
     * @returns {void}
     */
    pushDocHeader: function(){
        this.pushBuf('/**');
    },

    /**
     * @returns {void}
     */
    pushDocFooter: function(){
        this.pushBuf(' */');
    },

    /**
     * @param {Cheerio} $
     * @param {string} query
     * @param {string} content
     * @returns {boolean}
     */
    hasContent: function($, query, content){
        var found = false;
        $(query).each(function(i, elm){
            if (found) return;
            if ($(elm).text().trim() === content) {
                found = true;
            }
        });
        return found;
    },

    /**
     * @param {Cheerio} $
     * @returns {boolean}
     */
    hasProperties: function($){
        return this.hasContent($, 'h2.jump', 'Properties');
    },

    /**
     * @param {Cheerio} $
     * @returns {boolean}
     */
    hasMethods: function($){
        return this.hasContent($, 'h2.jump', 'Methods')
    },

    /**
     * @param {Cheerio} $
     * @returns {boolean}
     */
    hasConstants: function($){
        return this.hasContent($, 'h2.jump', 'Constants');
    },

    /**
     * @param {string} url
     * @returns {string}
     */
    syncRequest: function(url){
        var req = new XMLHttpRequest();
        req.open('GET', url, false);
        req.send(null);
        return typeof req.responseText === 'string' ? req.responseText : null;
    },

    /**
     * @param {string} text
     * @param {string} type...
     * @returns {void}
     */
    syncWrite: function(text, type){
        type = type||'w';
        fs.writeFileSync(CONSTANT.FILE_DOC, text, { flag: type });
    },

    /**
     * @param {string} appleDocType
     * @returns {string}
     */
    unifyType: function(appleDocType){
        return this.convertByMap(CONSTANT.TYPE_MAP, appleDocType);
    },

    /**
     * @param {string} type
     * @returns {string}
     */
    getDefaultValue: function(type){
        var res = this.convertByMap(CONSTANT.DEFAULT_MAP, type);
        if (res === type) {
            return 'null';
        } else {
            return res;
        }
    },

    /**
     * @param {object} map
     * @param {string} val
     * @returns {string}
     */
    convertByMap: function(map, val){
        if (map.hasOwnProperty(val)) {
            return map[val];
        } else {
            return val;
        }
    },

    /**
     * @param {Cheerio} $
     * @returns {{name: string, type: string, inherit: boolean, augments: string}}
     */
    getClassDoc: function($){

        var doc = {
            name: '',
            type: '',
            inherit: false,
            augments: ''
        };

        doc.name = doc.type = $('#pageTitle').eq(0).text().trim().split(' ')[0];

        if ($('.InheritsFrom').length > 0) {
            doc.inherit = true;
            doc.augments = $('.zSharedSpecBoxHeadList > a').eq(0).text().trim();
        }

        return doc;
    },

    /**
     * @param {string} appleDocString
     * @returns {{name: string, type: string, constant: boolean, readonly: boolean, value: string}}
     */
    getPropertyDoc: function(appleDocString){
        var props = appleDocString.trim().split(' ');
        var doc = {
            name: '',
            type: '',
            constant: false,
            readonly: false,
            value: 'null'
        };

        if (props[0] === 'readonly') {
            doc.readonly = true;
            doc.type = this.unifyType(props[2]);
            doc.name = props[3].replace(/[,;.]$/, '');
        } else {
            doc.type = this.unifyType(props[1]);
            doc.name = props[2].replace(/[,;.]$/, '');
        }

        doc.value = this.getDefaultValue(doc.type);

        return doc;
    },

    /**
     * @param {string} appleDocString
     * @returns {{name: *, params: Array, args: Array, returns: string}}
     */
    getMethodDoc: function(appleDocString){

        var props = appleDocString.trim().match(/^([\w]+)\s+([\w]+)(?:\s+)?\((.*)\);?$/i);
        var argString = props[3].trim();

        var doc = {
            name: props[2],
            params: [],
            args: [],
            returns: this.unifyType(props[1])
        };

        if (argString !== '') {
            argString.split(',')
                .forEach(function(arg){
                    var params = arg.trim().split(/\s+/);
                    var plen = params.length;
                    var argType = this.convertByMap(CONSTANT.TYPE_MAP, params[ plen - 2]);
                    var argName = params[ plen - 1];
                    if (typeof argType !== 'undefined' && argType !== 'void') {
                        doc.params.push({
                            name: argName,
                            type: argType
                        });
                        doc.args.push(argName);
                    }
                }, this);
        }

        return doc;
    }

};

new Main();
