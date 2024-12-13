import {isIPv4, isIPv6, isIP, createPortPool} from "rxprotoplex-peers";
import {UDXSocket} from "./socket.js";
import {UDXStream} from "./stream.js";


export class UDX {
    static isIPv4(host) {
        return isIPv4(host);
    }
    static isIPv6(host) {
        return isIPv6(host);
    }
    static isIP(host) {
        return isIP(host);
    }
    constructor(config = {}) {
        const {localInterface} = config;
        this.localInterfaceIp = localInterface?.ip || "127.0.0.1";
        this.portManager = createPortPool();
    }
    networkInterfaces() {

    }
    createSocket(opts) {
        return new UDXSocket(this, opts);
    }
    createStream(id, opts) {
        return new UDXStream(this, id, opts);
    }
    watchNetworkInterfaces(onchange) {

    }
    lookup(host, opts = {}) {

    }
    onlookup(err, host, family) {
        if (err) this.reject(err);
        else this.resolve({host, family});
    }
}