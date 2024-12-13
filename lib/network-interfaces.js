import EventEmitter from "eventemitter3";
import { idOf, selectAllInterfaces$, selectInterfaceByIp$, store } from "rxprotoplex-peers";
import { BehaviorSubject, filter, finalize, map, takeUntil } from "rxjs";

/**
 * Represents a reactive manager for network interfaces, providing event-driven updates
 * and utilities for observing changes in available interfaces.
 */
class NetworkInterfaces extends EventEmitter {
    /**
     * Constructs a new `NetworkInterfaces` instance.
     */
    constructor() {
        super();
        this._destroying = null;
        this.closed$ = new BehaviorSubject(false);

        const { interfacesEntities } = store.getValue();
        this.interfaces = ifacesToJson(Object.values(interfacesEntities));

        setTimeout(() => this.watch());
    }

    /**
     * Checks if the network interfaces watcher is active.
     * @private
     * @returns {boolean} `true` if the watcher is active, `false` otherwise.
     */
    get _watching() {
        return this.closed$.getValue();
    }

    /**
     * Handles events for updated network interfaces.
     * @private
     * @param {Array<Object>} iface - The updated list of network interfaces.
     */
    _onevent(iface) {
        this.interfaces = iface;
        this.emit("change", this.interfaces);
    }

    /**
     * Starts watching for changes in network interfaces.
     * Emits a `change` event whenever the interfaces are updated.
     * @returns {NetworkInterfaces} The current instance for chaining.
     */
    watch() {
        if (this._destroying) return this;
        if (this._watching) return this;

        selectAllInterfaces$(true)
            .pipe(
                takeUntil(this.closed$.pipe(filter(o => o === true))),
                map(ifacesToJson),
                finalize(() => this.emit("close"))
            )
            .subscribe(this._onevent.bind(this));

        return this;
    }

    /**
     * Stops watching for changes in network interfaces.
     * @returns {NetworkInterfaces} The current instance for chaining.
     */
    unwatch() {
        if (this._destroying) return this;
        this.closed$.next(true);
        return this;
    }

    /**
     * Destroys the network interfaces watcher, ensuring all resources are released.
     * Emits a `close` event upon completion.
     * @returns {Promise<void>} A promise that resolves when the watcher is destroyed.
     */
    async destroy() {
        if (this._destroying) return this._destroying;
        if (!this._watching) return Promise.resolve();

        this.closed$.next(true);
        this._destroying = new Promise(resolve => this.once("close", resolve));

        return this._destroying;
    }

    /**
     * Provides an iterator over the current list of network interfaces.
     * @returns {Iterator<Object>} An iterator for the network interfaces.
     */
    [Symbol.iterator]() {
        return this.interfaces[Symbol.iterator]();
    }
}

/**
 * Converts a list of network interface entities to a JSON-compatible format.
 * @param {Array<Object>} ifaceList - The list of network interface entities.
 * @returns {Array<Object>} A list of network interfaces in JSON-compatible format.
 */
const ifacesToJson = (ifaceList) => {
    const list = ifaceList.map(iface => ({
        name: idOf(iface),
        host: iface.ip,
        family: 4,
        internal: false
    }));

    return list;
};

export { NetworkInterfaces };
