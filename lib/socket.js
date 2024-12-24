import EventEmitter from "eventemitter3";
import {connectToAllInterfaces, isLoopbackIp, listenOnSocket$, sendMessage} from "rxprotoplex-peers";
import {mergeAll, tap} from "rxjs";

/**
 * Represents a UDX socket with event-driven communication and RxJS-powered message handling.
 * Extends `EventEmitter` for event-driven behavior.
 */
export class UDXSocket extends EventEmitter {
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
        console.debug("UDXSocket instance created with options:", opts);
    }

    get bound() {
        const isBound = this._port !== 0;
        console.debug("Checking if socket is bound:", isBound);
        return isBound;
    }

    get closing() {
        const isClosing = this._closing !== null;
        console.debug("Checking if socket is closing:", isClosing);
        return isClosing;
    }

    get idle() {
        const isIdle = this.streams.size === 0;
        console.debug("Checking if socket is idle:", isIdle);
        return isIdle;
    }

    get busy() {
        const isBusy = this.streams.size > 0;
        console.debug("Checking if socket is busy:", isBusy);
        return isBusy;
    }

    address() {
        if (!this.bound) {
            console.warn("Attempted to get address, but socket is not bound.");
            return null;
        }
        const address = { host: this._host, family: this._family, port: this._port };
        console.debug("Retrieving socket address:", address);
        return address;
    }

    toJSON() {
        const serializedState = {
            bound: this.bound,
            closing: this.closing,
            streams: this.streams.size,
            address: this.address(),
            ipv6Only: this._ipv6Only,
            idle: this.idle,
            busy: this.busy
        };
        console.debug("Serializing socket state:", serializedState);
        return serializedState;
    }

    bind(port = 0, host = "0.0.0.0") {
        console.debug("Attempting to bind socket to port:", port, "and host:", host);

        if (this.bound || this._boundSub) {
            console.error("Bind attempt failed: Socket is already bound.");
            throw new Error("Already bound");
        }
        if (this.closing) {
            console.error("Bind attempt failed: Socket is closing.");
            throw new Error("Socket is closed");
        }

        const _port = (this._port = this.udx.portManager.take(port || 0));

        this._host = host;

        console.debug("Socket successfully bound to port:", _port);

        this._boundSub ||= listenOnSocket$(host, `${_port}##message`)
            .pipe(mergeAll())
            .subscribe({
                next: message => {
                    console.debug("Received message on socket:", message);
                    this.emit("message", message, {host: this._host, port: this._port, family: 4 });
                },
                error: err => {
                    console.error("Error in socket subscription:", err);
                },
                complete: () => {
                    console.info("Socket subscription completed.");
                }
            });

        console.debug("Socket is now listening for messages on:", { host, port: _port });
        this.emit("listening");
    }

    async close() {
        console.debug("Closing socket.");

        if (this._closed) {
            console.warn("Socket close attempt ignored: Already closed.");
            return;
        }

        this.emit("close");
        console.debug("Close event emitted.");

        this._boundSub?.unsubscribe?.();
        this._boundSub = null;

        if (this._port) {
            console.debug("Releasing port:", this._port);
            this.udx.portManager.release(this._port);
        }

        this._port = 0;
        this._host = null;
        this._closed = true;

        console.debug("Socket successfully closed.");
    }

    async send(buffer, port, host, ttl) {
        console.debug("Attempting to send message:", {
            buffer,
            port,
            host,
            ttl
        });

        if (this.closing) {
            console.warn("Message send failed: Socket is closing.");
            return false;
        }

        if (!host) {
            host = "127.0.0.1";
            console.debug("Host not provided, using default:", host);
        }

        connectToAllInterfaces(host);
        sendMessage(host, buffer, `${port}##message`);

        console.debug("Message successfully sent to:", { port, host });
        return true;
    }

    trySend(buffer, port, host, ttl) {
        console.debug("Attempting to trySend message:", {
            buffer,
            port,
            host,
            ttl
        });
        this.send(buffer, port, host, ttl);
    }
}
