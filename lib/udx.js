import {isIPv4, isIPv6, isIP, createPortPool} from "rxprotoplex-peers";
import {UDXSocket} from "./socket.js";
import {UDXStream} from "./stream.js";
import {NetworkInterfaces} from "./network-interfaces.js";


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
        this._watchers = new Set();
    }
    networkInterfaces() {
        let [watcher = null] = this._watchers;
        if (watcher) return watcher.interfaces;
        watcher = new NetworkInterfaces();
        watcher.destroy();
        return watcher.interfaces;
    }
    createSocket(opts) {
        return new UDXSocket(this, opts);
    }
    createStream(id, opts) {
        return new UDXStream(this, id, opts);
    }
    watchNetworkInterfaces(onchange) {
        const watcher = new NetworkInterfaces();
        this._watchers.add(watcher);
        watcher.on("close", () => {
            this._watchers.delete(watcher);
        });
        if (onchange) watcher.on("change", onchange);
        return watcher.watch();
    }
    lookup(host, opts = {}) {

    }
    onlookup(err, host, family) {
        if (err) this.reject(err);
        else this.resolve({host, family});
    }
}