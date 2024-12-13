import EventEmitter from "eventemitter3";
import { connectToAllInterfaces, listenOnSocket$, sendMessage } from "rxprotoplex-peers";
import { mergeAll } from "rxjs";

/**
 * Represents a UDX socket with event-driven communication and RxJS-powered message handling.
 * Extends `EventEmitter` for event-driven behavior.
 */
export class UDXSocket extends EventEmitter {
    /**
     * Constructs a new UDXSocket instance.
     * @param {Object} udx - The UDX instance managing port allocation.
     * @param {Object} [opts={}] - Configuration options for the socket.
     */
    constructor(udx, opts = {}) {
        const {} = opts;
        super();
        this.udx = udx;
        this._ipv6Only = false;
        this._host = null;
        this._family = 4;
        this._port = 0;
        this._closing = null;
        this._closed = false;
        this.streams = new Set();
        this.userData = null;
        this._boundSub = null;
    }

    /**
     * Checks if the socket is bound to a port.
     * @returns {boolean} `true` if the socket is bound; otherwise, `false`.
     */
    get bound() {
        return this._port !== 0;
    }

    /**
     * Checks if the socket is in the process of closing.
     * @returns {boolean} `true` if closing; otherwise, `false`.
     */
    get closing() {
        return this._closing !== null;
    }

    /**
     * Checks if the socket is idle (no active streams).
     * @returns {boolean} `true` if idle; otherwise, `false`.
     */
    get idle() {
        return this.streams.size === 0;
    }

    /**
     * Checks if the socket is busy (has active streams).
     * @returns {boolean} `true` if busy; otherwise, `false`.
     */
    get busy() {
        return this.streams.size > 0;
    }

    /**
     * Returns the address information of the socket.
     * @returns {Object|null} The address information or `null` if not bound.
     */
    address() {
        if (!this.bound) return null;
        return { host: this._host, family: this._family, port: this._port };
    }

    /**
     * Serializes the socket state into a JSON-compatible object.
     * @returns {Object} The serialized state of the socket.
     */
    toJSON() {
        return {
            bound: this.bound,
            closing: this.closing,
            streams: this.streams.size,
            address: this.address(),
            ipv6Only: this._ipv6Only,
            idle: this.idle,
            busy: this.busy
        };
    }

    /**
     * Binds the socket to a specific port and host.
     * @param {number} port - The port to bind the socket to.
     * @param {string} [host="0.0.0.0"] - The host address to bind to.
     */
    bind(port = 0, host = "0.0.0.0") {
        const _port = (this._port = this.udx.portManager.take(port || 0));
        this._host = host;
        this._boundSub ||= listenOnSocket$(host, `${_port}##message`)
            .pipe(
                mergeAll()
            )
            .subscribe(message => this.emit("message", message));
        this.emit("listening");
    }

    /**
     * Closes the socket, releasing resources and unsubscribing from listeners.
     * @returns {Promise<void>} A promise that resolves when the socket is closed.
     */
    async close() {
        this.emit("close");
        this._boundSub?.unsubscribe?.();
        this._boundSub = null;
        if (this._port) this.udx.portManager.release(this._port);
    }

    /**
     * Sends a message through the socket.
     * @param {Uint8Array} buffer - The message buffer to send.
     * @param {number} port - The target port.
     * @param {string} host - The target host.
     * @param {number} [ttl] - The time-to-live for the message.
     * @returns {Promise<boolean>} Resolves to `true` when the message is sent.
     */
    async send(buffer, port, host, ttl) {
        if (!host) host = this.udx.localInterfaceIp;
        connectToAllInterfaces(host);
        sendMessage(host, buffer, `${port}##message`);
        return true;
    }

    /**
     * Attempts to send a message through the socket. Alias for `send`.
     * @param {Uint8Array} buffer - The message buffer to send.
     * @param {number} port - The target port.
     * @param {string} host - The target host.
     * @param {number} [ttl] - The time-to-live for the message.
     * @returns {Promise<boolean>} Resolves to `true` when the message is sent.
     */
    async trySend(buffer, port, host, ttl) {
        return this.send(buffer, port, host, ttl);
    }
}
