(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const objStore = require('objstore-cms');

const localStorageProvider = objStore.providers.localStorage;
localStore = objStore.use(localStorageProvider);
localStore.types.register(objStore.types.any);

//CMS Prototype
let objs;
let models;

/*
const onModelListItemClick = function (e) {
    let modelId = this.dataset.id;
    objs.forEach(obj => {
        if (obj.model.id === modelId) {
            let el = document.createElement('ul');
            el.innerHTML = `<li data-id="${obj.id}">${obj.fields.color()}</li>`;
            document.querySelector('.objects ul').appendChild(el.children[0]);
        }
    })
};*/

/*
(async () => {
    objs = await localStore.read();
    models = await localStore.models.read();
    models.forEach(model => {
        let el = document.createElement('ul');
        el.innerHTML = `<li data-id="${model.id}">${model.name}</li>`;
        //el.children[0].addEventListener('click', onModelListItemClick);
        document.querySelector('.models ul').appendChild(el.children[0]);
    });
})();*/

if ('autosize' in window) {
    autosize(document.querySelectorAll('textarea'));
}

},{"objstore-cms":2}],2:[function(require,module,exports){
const Store = require("./lib/store");
const stores = new WeakMap();

module.exports.use = function use(provider) {
    if (stores.has(provider)) return stores.get(provider);
    stores.set(provider, new Store(this, provider));
    return use(provider);
};
module.exports.providers = {
    localStorage: require('./lib/providers/localstorage')
};
module.exports.types = {
    any: require('./lib/types/any')
};
},{"./lib/providers/localstorage":6,"./lib/store":7,"./lib/types/any":9}],3:[function(require,module,exports){
const isFunction = method => typeof(method) === "function";
const isString = obj => Object.prototype.toString.call(obj) === '[object String]';
const priv = new WeakMap();

class Field {
    constructor(key, name, type, config) {
        priv.set(this, {config});
        Object.defineProperties(this, {
            'key': {
                enumerable: true,
                value: key
            },
            'name': {
                enumerable: true,
                value: name
            },
            'type': {
                enumerable: true,
                value: type.id
            },
            'config': {
                enumerable: true,
                get: () => priv.get(this).config,
                set: value => (async (value) => priv.get(this).config = await type.config(value))(value)
            }
        });
        Object.freeze(this);
    }
}

module.exports = Field;
},{}],4:[function(require,module,exports){
const Field = require('./field');
const noop = require('./utils/noop');
const isString = require('./utils/isString');
const bindFunctions = require('./utils/bindFunctions');
let priv;

class Model {
    constructor(store, name, fields = {}, id) {
        priv.set(this, {store, id, name, fields});
        if (id !== undefined) Object.defineProperty(this, 'id', {
            enumerable: true,
            get: () => priv.get(this).id,
            set: () => {
                throw new Error('Id can\'t be set manually, it\'s generated after a commit');
            }
        });
        Object.defineProperties(this, {
            'name': {
                enumerable: true,
                get: () => priv.get(this).name,
                set: (value) => {
                    if (!isString(value)) throw new Error('Name is not a valid string');
                    if (value.length > 64) throw new Error('Name can\'t be longer then 64 characters');
                    priv.get(this).name = value
                }
            },
            'fields': {
                value: bindFunctions(this.fields, this)
            }
        });
        Object.keys(fields).forEach(field => {
            let type = fields[field].type;
            if (!(type in priv.get(priv.get(this).store).types)) throw new Error(`Type with id '${type}' is not registered`);
            priv.get(this).fields[field] = new Field(field, fields[field].name,
                priv.get(priv.get(this).store).types[type], fields[field].config);
        });
        Object.freeze(this);
        this.name = name;
    }

    async commit(callback = noop) {
        try {
            let model;
            if (priv.get(this).id === undefined) {
                let id = await priv.get(priv.get(this).store).provider.models.create(this.name, priv.get(this).fields);
                model = new Model(priv.get(this).store, this.name, priv.get(this).fields, id);
            } else {
                //this.data(await priv.get(this).store.update(this.id, this).data());
            }
            callback(null, model);
            return model;
        } catch (error) {
            callback(error);
            throw error;
        }
    }
}

Model.prototype.fields = {
    create: async function (key, name, type, config, callback = noop) {
        try {
            if (!isString(key)) throw new Error('Key is not a valid string');
            if (!isString(name)) throw new Error('Name is not a valid string');
            if (key.length > 32) throw new Error('Key can\'t be longer then 32 characters');
            if (name.length > 128) throw new Error('Name can\'t be longer then 128 characters');
            if (!(type in priv.get(priv.get(this).store).types)) throw new Error(`Type with id '${type}' is not registered`);
            if (key in priv.get(this).fields) throw new Error(`Field with key '${key}' already exists`);

            let fields = Object.assign({[key]: {key, name, type, config}}, priv.get(this).fields);
            let model = new Model(priv.get(this).store, this.name, fields, priv.get(this).id);
            callback(null, model);
            return model;
        }
        catch (error) {
            callback(error);
            throw error;
        }
    },
    read: async function (key, callback = noop) {
        try {
            let field = {};
            if (key === undefined) {
                Object.keys(priv.get(this).fields).forEach(key => field[key] = priv.get(this).fields[key]);
            }
            else if (key in priv.get(this).fields) {
                field = priv.get(this).fields[key];
            } else {
                throw new Error('Field does not exist');
            }
            callback(null, field);
            return field;
        } catch (error) {
            callback(error);
            throw error;
        }

    },
    update: async function (key, config, callback = noop) {
        try {
            (await this.fields.read(key)).config = config;
            callback(null, this);
            return this;
        } catch (error) {
            callback(error);
            throw error;
        }
    },
    drop: async function (key, callback = noop) {
        try {
            await this.fields.read(key);
            delete priv.get(this).fields[key];
            callback(null, this);
            return this;
        } catch (error) {
            callback(error);
            throw error;
        }
    }
};

module.exports = Model;
module.exports.priv = value => priv = value;
},{"./field":3,"./utils/bindFunctions":10,"./utils/isString":12,"./utils/noop":13}],5:[function(require,module,exports){
const Field = require('./type');
const noop = require('./utils/noop');
let priv;

class Obj {
    constructor(store, model, data, id) {
        priv.set(this, {id, store, model, data: {}});
        if (id !== undefined) Object.defineProperty(this, 'id', {
            enumerable: true,
            get: () => priv.get(this).id,
            set: () => {
                throw new Error('Id can\'t be set manually, it\'s generated after a commit');
            }
        });
        Object.defineProperties(this, {
            'fields': {
                enumerable: true,
                writable: true,
                value: {}
            },
            'model': {
                enumerable: true,
                get: () => priv.get(this).model
            }
        });
        Object.keys(priv.get(model).fields).forEach(key => Object.defineProperty(this.fields, key, {
            enumerable: true,
            value: (value, callback = noop) => {
                if (value === undefined) return priv.get(this).data[key];
                return (async () => {
                    let field = priv.get(model).fields[key];
                    let type = priv.get(priv.get(this).store).types[field.type];
                    try {
                        priv.get(this).data[key] = await type.validate(value);
                        callback(null, this);
                        return this;
                    } catch (error) {
                        callback(error);
                        throw error;
                    }
                })()
            }
        }));
        Object.freeze(this);
        if (data !== undefined) Object.keys(data).forEach(key => this.fields[key](data[key]));
    }

    async commit(callback = noop) {
        try {
            let store = priv.get(this).store;
            let model = priv.get(this).model;
            let data = priv.get(this).data;
            let id = this.id;
            if (id === undefined) {
                id = await priv.get(store).provider.create(model.id, data);
            } else {
                await store.update(id, this);
            }
            let obj = new Obj(store, model, data, id);
            callback(null, obj);
            return obj;
        } catch (error) {
            callback(error);
            throw error;
        }
    }

    async read(callback = noop) {
        if (this.id === undefined) throw new Error('Object needs to be committed before it can be read');
        try {
            this.data((await priv.get(this).store.read(this.id)).data());
            callback(null, this);
            return this;
        } catch (error) {
            callback(error);
            throw error;
        }
    }

    async drop(callback = noop) {
        if (this.id === undefined) throw new Error('Object needs to be committed before it can be deleted');
        try {
            await priv.get(this).store.drop(this.id);
            priv.get(this).id = undefined;
            callback(null, this);
            return this;
        } catch (error) {
            callback(error);
            throw error;
        }
    }

    toJSON() {
        const json = Object.assign({}, this);
        json.fields = {};
        Object.keys(this.fields).forEach(key => json.fields[key] = this.fields[key]());
        return json;
    }
}

module.exports = Obj;
module.exports.priv = value => priv = value;

},{"./type":8,"./utils/noop":13}],6:[function(require,module,exports){
const uuid = require('uuid');
const objectsKey = 'objStore_objects';
const modelsKey = 'objStore_models';

if (!localStorage.getItem(objectsKey)) localStorage.setItem(objectsKey, JSON.stringify({}));
if (!localStorage.getItem(modelsKey)) localStorage.setItem(modelsKey, JSON.stringify({}));

const create = (key, data, item) => new Promise((resolve, reject) => {
    let entries = JSON.parse(localStorage.getItem(item));
    entries[key] = data;
    localStorage.setItem(item, JSON.stringify(entries));
    resolve(key);
});

const read = (key, item) => new Promise((resolve, reject) => {
    let entries = JSON.parse(localStorage.getItem(item));
    if (key === undefined) {
        resolve(Object.values(entries));
    } else if (entries[key]) {
        resolve(entries[key]);
    } else {
        reject();
    }
});

module.exports = {
    create: (modelId, data) => {
        let id = uuid();
        return create(id, {id, modelId, data}, objectsKey);
    },
    read: id => read(id, objectsKey).catch(() => {
        throw new Error('Object not found');
    }),
    update: (id, data) => {
        let objects = JSON.parse(localStorage.getItem(objectsKey));
        return new Promise((resolve, reject) => {
            if (objects[id]) {
                objects[id].data = data;
                localStorage.setItem(objectsKey, JSON.stringify(objects));
                resolve();
            } else {
                reject('Error: object not found');
            }
        });
    },
    drop: id => {
        let objects = JSON.parse(localStorage.getItem(objectsKey));
        return new Promise((resolve, reject) => {
            if (objects[id]) {
                delete objects[id];
                localStorage.setItem(objectsKey, JSON.stringify(objects));
                resolve();
            } else {
                reject('Error: object not found');
            }
        });
    },
    models: {
        create: (name, data) => {
            let id = uuid();
            return create(id, {id, name, data}, modelsKey);
        },
        read: (id) => read(id, modelsKey).catch(() => {
            throw new Error('Model not found');
        }),
        update: (id, data) => {
            //TODO implement update
        },
        drop: (id) => {
            //TODO implement drop
        }
    }
};
},{"uuid":14}],7:[function(require,module,exports){
const Obj = require('./obj');
const Model = require('./model');
const Type = require('./type');
const noop = require('./utils/noop');
const bindFunctions = require('./utils/bindFunctions');
const priv = new WeakMap();
Obj.priv(priv);
Model.priv(priv);

class Store {
    constructor(objStore, provider) {
        priv.set(this, {objStore, provider, models: {}, types: {}});
        Object.defineProperties(this, {
            'models': {
                value: bindFunctions(this.models, this)
            },
            'types': {
                value: bindFunctions(this.types, this)
            }
        });
        Object.freeze(this);
    }

    use(provider) {
        return priv.get(this).objStore.use(provider);
    }

    async create(modelId, data, commit, callback = noop) {
        try {
            let model = await this.models.read(modelId);
            let object = new Obj(this, model, data);
            if (commit) await object.commit();
            callback(null, object);
            return object;
        } catch (error) {
            callback(error);
            throw error;
        }
    }

    async read(id, callback = noop) {
        try {
            let results = await priv.get(this).provider.read(id);
            if (!Array.isArray(results)) results = [results];
            if (!results.length) throw new Error('No objects found');
            let model = await this.models.read(results[0].modelId);
            let objects = [];
            results.forEach(result => objects.push(new Obj(this, model, result.data, result.id)));
            if (objects.length === 1 && id) objects = objects[0];
            callback(null, objects);
            return objects;
        } catch (error) {
            callback(error);
            throw error;
        }
    }

    async update(id, obj, callback = noop) {
        try {
            if (obj.id === undefined) return (await this.read(id)).commit();
            await priv.get(this).provider.update(id, priv.get(obj).data);
            callback(null, obj);
            return obj;
        } catch (error) {
            callback(error);
            throw error;
        }
    }

    async drop(id, callback = noop) {
        try {
            await priv.get(this).provider.drop(id);
            callback(null);
        } catch (error) {
            callback(error);
            throw error;
        }
    }
}

Store.prototype.models = {
    create: async function (name, fields, commit, callback = noop) {
        try {
            let model = new Model(this, name, fields);
            if (commit) model = await model.commit();
            callback(null, model);
            return model;
        } catch (error) {
            callback(error);
            throw error;
        }
    },
    read: async function (id, callback = noop) {
        try {
            let models = [];
            if (id in priv.get(this).models) {
                models.push(priv.get(this).models[id]);
            } else {
                let results = await priv.get(this).provider.models.read(id);
                if (!Array.isArray(results)) results = [results];
                results.forEach(result => models.push(new Model(this, result.name, result.data, result.id)));
            }
            if (models.length === 1 && id) models = models[0];
            callback(null, models);
            return models;
        } catch (error) {
            callback(error);
            throw error;
        }
    },
    update: async function () {
        //TODO implement update
    },
    drop: async function () {
        //TODO implement drop
    }
};

Store.prototype.types = {
    register: function (types, callback = noop) {
        try {
            if (!Array.isArray(types)) types = [types];
            types = types.map(type => new Type(type));
            types.forEach(type => priv.get(this).types[type.id] = type);
            if (types.length === 1) types = types[0];
            callback(null, types);
            return types;
        } catch (error) {
            callback(error);
            throw error;
        }
    }
};


module.exports = Store;

},{"./model":4,"./obj":5,"./type":8,"./utils/bindFunctions":10,"./utils/noop":13}],8:[function(require,module,exports){
const isFunction = require('./utils/isFunction');
const isString = require('./utils/isString');

class Type {
    constructor(type) {
        if (!isString(type.id) ||
            !isString(type.name) ||
            !isString(type.description) ||
            !isFunction(type.validate) ||
            !isFunction(type.config)) {
            //Simple type implementation check for now
            throw new Error('Invalid type implementation');
        }
        Object.defineProperties(this, {
            'id': {
                value: type.id
            },
            'name': {
                value: type.name
            },
            'description': {
                value: type.description
            },
            'validate': {
                value: (value, config) => type.validate(value, config)

            },
            'config': {
                value: config => type.config(config)
            }
        });
        Object.freeze(this);
    }
}

module.exports = Type;
},{"./utils/isFunction":11,"./utils/isString":12}],9:[function(require,module,exports){
module.exports = {
    id: 'any',
    name: 'Any',
    description: 'Any data without structure and/or validation',
    validate: (value, config) => new Promise(resolve => {
        console.log(`Validating '${value}' with config '${config}'`);
        resolve(value);
    }),
    config: config => Promise.resolve(config)
};
},{}],10:[function(require,module,exports){
module.exports = (methods, context) => {
    let binds = {};
    Object.keys(methods).forEach(key => binds[key] = methods[key].bind(context));
    return binds;
};
},{}],11:[function(require,module,exports){
module.exports = method => typeof(method) === "function";
},{}],12:[function(require,module,exports){
module.exports = obj => Object.prototype.toString.call(obj) === '[object String]';
},{}],13:[function(require,module,exports){
module.exports = () => {
};
},{}],14:[function(require,module,exports){
var v1 = require('./v1');
var v4 = require('./v4');

var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;

module.exports = uuid;

},{"./v1":17,"./v4":18}],15:[function(require,module,exports){
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  return bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

module.exports = bytesToUuid;

},{}],16:[function(require,module,exports){
(function (global){
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection
var rng;

var crypto = global.crypto || global.msCrypto; // for IE 11
if (crypto && crypto.getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef
  rng = function whatwgRNG() {
    crypto.getRandomValues(rnds8);
    return rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}

module.exports = rng;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],17:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ? buf : bytesToUuid(b);
}

module.exports = v1;

},{"./lib/bytesToUuid":15,"./lib/rng":16}],18:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

module.exports = v4;

},{"./lib/bytesToUuid":15,"./lib/rng":16}]},{},[1]);
