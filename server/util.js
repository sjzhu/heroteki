function escapeRegex(regex) {
    return regex.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

/**
 * Minimal GET helper backed by the global fetch (Node 18+).
 * Resolves with the response body as a string, or as a Buffer when
 * `options.encoding === null`. Rejects with an Error carrying `statusCode`
 * on any non-200 response.
 */
async function httpRequest(url, options = {}) {
    const { encoding, ...fetchOptions } = options;

    const res = await fetch(url, fetchOptions);

    if (res.status !== 200) {
        const err = new Error('Request failed');
        err.statusCode = res.status;
        throw err;
    }

    if (encoding === null) {
        return Buffer.from(await res.arrayBuffer());
    }

    return res.text();
}

function wrapAsync(fn) {
    return function (req, res, next) {
        fn(req, res, next).catch((error) => {
            return next(error);
        });
    };
}

function detectBinary(state, path = '', results = []) {
    const allowedTypes = ['Array', 'Boolean', 'Date', 'Number', 'Object', 'String'];

    if (!state) {
        return results;
    }

    let type = state.constructor.name;

    if (!allowedTypes.includes(type)) {
        results.push({ path: path, type: type });
    }

    if (type === 'Object') {
        for (let key in state) {
            detectBinary(state[key], `${path}.${key}`, results);
        }
    } else if (type === 'Array') {
        for (let i = 0; i < state.length; ++i) {
            detectBinary(state[i], `${path}[${i}]`, results);
        }
    }

    return results;
}

function capitalize(input) {
    return input.charAt(0).toUpperCase() + input.slice(1);
}

module.exports = {
    detectBinary: detectBinary,
    escapeRegex: escapeRegex,
    httpRequest: httpRequest,
    wrapAsync: wrapAsync,
    capitalize: capitalize
};
