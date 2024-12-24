import {addWebSocketNetworkInterface, closeInterface, networkInterfaceConnected$} from "rxprotoplex-peers";
import {firstValueFrom} from "rxjs";

export async function useOneInterface(wsUrl, cb, t) {
    const a = addWebSocketNetworkInterface(wsUrl);
    const aa = await firstValueFrom(networkInterfaceConnected$(a))

    await cb(aa);
    t?.teardown?.(() => {
        closeInterface(a);
    });
}