import {connectStream$, listenOnSocket$, store} from "rxprotoplex-peers";
import {filter, fromEvent, from, ReplaySubject, Subject, switchMap, take, takeUntil} from "rxjs";
import {Duplex} from "streamx";
import b4a from "b4a";
import {connectToRemote} from "./connectToRemote.js";

/**
 * Represents a UDX stream with dynamic stream switching and reactive handling of remote connections.
 */
export class UDXStream extends Duplex {
    /**
     * Constructs a new UDXStream instance.
     * @param {Object} udx - The UDX instance managing the stream.
     * @param {number} id - The unique identifier for the stream.
     * @param {Object} opts - Configuration options for the stream.
     * @param {number} [opts.maxBufferSize=25] - The maximum buffer size for stream switching.
     */
    constructor(udx, id, opts = {}) {
        super({ mapWritable: value => typeof value === "string" ? b4a.from(value) : value })
        this.udx = udx;

        this.id = id;
        this.remoteId = 0;
        this.remoteHost = 0;
        this.remotePort = 0;
        this.userData = null;
        this.remoteChanging$ = new Subject();
        this.remoteChanging = null;
        this.closing$ = new ReplaySubject(1);
        this.socket = null;
    }

    /** @type {boolean} Indicates whether the stream is connected. */
    get connected() {
        return this.socket != null;
    }

    // Placeholder getters for additional stream metrics.
    get mtu() {}
    get rtt() {}
    get cwnd() {}
    get rtoCount() {}
    get retransmits() {}
    get fastRecoveries() {}
    get inflight() {}
    get bytesTransmitted() {}
    get packetsReceived() {}

    /** @type {string|null} The local host address of the stream. */
    get localHost() {
        return this.socket?.address?.()?.host ?? null;
    }

    /** @type {number} The local address family (IPv4 or IPv6). Defaults to 4. */
    get localFamily() {
        return this.socket?.address?.()?.family ?? 4;
    }

    /** @type {number} The local port of the stream. Defaults to 0 if unbound. */
    get localPort() {
        return this.socket?.address?.()?.port ?? 0;
    }

    /**
     * Connects the stream to a remote host and port using the specified socket.
     * @param {Object} socket - The UDX socket to use for the connection.
     * @param {number} remoteId - The remote stream identifier.
     * @param {number} port - The remote port to connect to.
     * @param {string} [host] - The remote host to connect to.
     * @param {Object} [opts={}] - Additional connection options.
     * @throws {Error} If the stream is already connected or the socket is closed.
     */
    connect(socket, remoteId, port, host, opts = {}) {
        console.debug("Attempting to connect with parameters:", { socket, remoteId, port, host, opts });

        if (this._closed) {
            console.warn("Connection attempt failed: Stream is closed.");
            return;
        }

        if (this.connected) {
            console.error("Connection attempt failed: Stream is already connected.");
            throw new Error("Already connected");
        }

        if (socket.closing) {
            console.error("Connection attempt failed: Socket is closed.");
            throw new Error("Socket is closed");
        }

        if (typeof host === "object") {
            console.debug("Host provided as an object, interpreting as options:", host);
            opts = host;
            host = null;
        }

        if (!host) {
            host = this.udx.localInterfaceIp; // Default host logic.
            console.debug("Host not provided, using default:", host);
        }

        const family = 4;
        if (!socket.bound) {
            console.debug("Socket is not bound, binding to port 0.");
            socket.bind(0);
        }

        this.remoteId = remoteId;
        this.remotePort = port;
        this.remoteHost = host;
        this.remoteFamily = family;
        this.socket = socket;

        console.debug("Connection details set:", {
            remoteId: this.remoteId,
            remotePort: this.remotePort,
            remoteHost: this.remoteHost,
            remoteFamily: this.remoteFamily
        });

        console.debug("Initiating connection to remote host:", host);

        console.log(store.getValue());
        this._connectToStream(host);

        this.emit("connect");
        console.debug("Connect event emitted.");
    }


    _connectToStream(host) {
        if (this.socket) {
            this.remoteChanging = true;
            this.remoteChanging$.next();
        }

        listenOnSocket$(this.localHost, `${this.localPort}##${this.id}`)
            .pipe(
                filter(socket => {
                    const match = socket.remoteIp === host;
                    console.debug("Socket filter applied:", {remoteIp: socket.remoteIp, host, match});
                    return match;
                }),
                switchMap(socket => {
                    console.debug("Switching to socket 'data' event stream:", socket);
                    this.remoteChanging = false;
                    return fromEvent(socket, "data");
                }),
                takeUntil(this.remoteChanging$),
                takeUntil(this.closing$)
            )
            .subscribe({
                next: data => {
                    console.debug("Data received from remote socket:", data);
                    this.push(data);
                },
                error: err => {
                    console.error("Error in connection subscription:", err);
                    debugger;
                }
            });

        if (!this.socket.streams.has(this)) {
            this.emit("connect");
            this.socket.streams.add(this);
        }
    }

    /**
     * Changes the remote connection details of the stream.
     * @param {Object} socket - The UDX socket to use for the new connection.
     * @param {number} remoteId - The new remote stream identifier.
     * @param {number} port - The new remote port to connect to.
     * @param {string} [host] - The new remote host to connect to.
     * @throws {Error} If the stream is already connected or the socket belongs to a different UDX instance.
     */
    changeRemote(socket, remoteId, port, host) {
        if (this.remoteChanging) throw new Error("Remote already changing");
        if (!this.connected) throw new Error("Not yet connected");
        if (socket.closing) throw new Error("Socket is closed");
        if (this.socket.udx !== socket.udx) {
            throw new Error("Cannot change to a socket on another UDX instance");
        }
        if (!host) {
            host = this.udx.localInterfaceIp; // Default host logic.
            console.debug("Host not provided, using default:", host);
        }
        const family = 4;

        if (this.socket !== socket) this._previousSocket = this.socket;
        this.remoteId = remoteId;
        this.remotePort = port;
        this.remoteHost = host;
        this.remoteFamily = family;

        this._connectToStream(host);
    }

    /**
     * Relays data from this stream to a specified destination stream.
     * @param {UDXStream} destination - The destination stream to relay data to.
     */
    relayTo(destination) {}

    /**
     * Sends data through the stream.
     * @param {Uint8Array} buffer - The data to send.
     * @returns {Promise<void>} Resolves when the data is successfully sent.
     */
    async send(buffer) {
        this.write(buffer);
    }

    _read(cb) {
        cb(null);
    }

    _writev(buffers, cb) {
        connectToRemote(this.localHost, this.remoteHost);

        console.debug("Writing buffers:", { buffers });

        if (!this.connected) {
            console.error("Write operation failed: Not connected.");
            throw new Error("Writing while not connected not currently supported");
        }

        if (buffers.length === 1) {
            console.debug("Single buffer detected, sending directly:", buffers[0]);
            console.log("Sending data", {
                channel: `${this.remotePort}\$\$${this.remoteId}`,
                stream: this,
                socket: this.socket,
                buffers,
                toId: this.remoteId,
                toPort: this.remotePort,
                toHost: this.remoteHost,
                local: {
                    localHost: this.localHost,
                    localPort: this.localPort
                }
            });
            connectStream$(this.remoteHost, `${this.remotePort}##${this.remoteId}`)
                .pipe(take(1))
                .subscribe(
                    socket => {
                        console.debug("Message sent to:", {
                            remoteHost: this.remoteHost,
                            remotePort: this.remotePort,
                            remoteId: this.remoteId
                        });
                        socket.end(buffers[0]);
                        cb();
                    }
                );

        } else {
            console.debug("Multiple buffers detected, creating stream connection:", {
                remoteHost: this.remoteHost,
                remotePort: this.remotePort,
                remoteId: this.remoteId,
                localHost: this.localHost
            });

            connectStream$(this.remoteHost, `${this.remotePort}##${this.remoteId}`, this.localHost)
                .pipe(take(1))
                .subscribe({
                    next: socket => {
                        console.debug("Stream connection established, writing buffers to socket.");

                        from(buffers).subscribe({
                            next: buffer => {
                                console.debug("Writing buffer to socket:", buffer);
                                socket.write(buffer);
                            },
                            complete: () => {
                                console.debug("All buffers written, ending socket stream.");
                                socket.end();
                            }
                        });
                    },
                    error: err => {
                        console.error("Error during stream connection:", err);
                        debugger;
                    }
                });
        }

        if (typeof cb === "function") {
            console.debug("Callback invoked after write operation.");
            cb();
        }
    }


    /**
     * Attempts to send data through the stream.
     * @param {Uint8Array} buffer - The data to send.
     * @returns {boolean} `true` if the data was sent successfully, `false` otherwise.
     */
    trySend(buffer) {
        this.send(buffer);
    }

    /**
     * Flushes any pending data in the stream's buffer.
     * @returns {Promise<void>} Resolves when the buffer is fully flushed.
     */
    async flush() {}

    /**
     * Serializes the state of the stream into a JSON-compatible object.
     * @returns {Object} The serialized state of the stream.
     */
    toJSON() {
        return {
            id: this.id,
            connected: this.connected,
            destroying: this.destroying,
            destroyed: this.destroyed,
            remoteId: this.remoteId,
            remoteHost: this.remoteHost,
            remoteFamily: this.remoteFamily,
            remotePort: this.remotePort,
            mtu: this.mtu,
            rtt: this.rtt,
            cwnd: this.cwnd,
            inflight: this.inflight,
            socket: this.socket ? this.socket.toJSON() : null
        };
    }
}

