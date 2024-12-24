import {UDX} from "../lib/udx.js";

const createSocket = (t, udx, opts) => {
    const socket = udx.createSocket(opts)
    const closed = new Promise(resolve => socket.once('close', resolve))
    t.teardown(() => closed, { order: Infinity })
    return socket
};

const uncaught = (fn) => process?.once?.('uncaughtException', fn);

function makeTwoStreams (t, opts) {
    const a = new UDX()
    const b = new UDX()

    const aSocket = createSocket(t, a)
    const bSocket = createSocket(t, b)

    aSocket.bind(0, '127.0.0.1')
    bSocket.bind(0, '127.0.0.1')

    const aStream = a.createStream(1, opts)
    const bStream = b.createStream(2, opts)

    aStream.connect(aSocket, bStream.id, bSocket.address().port, '127.0.0.1')
    bStream.connect(bSocket, aStream.id, aSocket.address().port, '127.0.0.1')

    t.teardown(() => {
        aSocket.close()
        bSocket.close()
    })

    return [aStream, bStream]
}

export { createSocket, uncaught, makeTwoStreams }