import {addWebSocketNetworkInterface, closeInterface, networkInterfaceConnected$} from "rxprotoplex-peers";
import {firstValueFrom} from "rxjs";

export async function useTwoInterfaces(wsUrl, cb, t) {
    const a = addWebSocketNetworkInterface(wsUrl);
    const b = addWebSocketNetworkInterface(wsUrl);

    const [aa, bb] = await Promise.all(
        [
            firstValueFrom(networkInterfaceConnected$(a)),
            firstValueFrom(networkInterfaceConnected$(b))
        ]
    )

    await cb(aa, bb);
    t?.teardown?.(() => {
        closeInterface(a);
        closeInterface(b);
    });
}