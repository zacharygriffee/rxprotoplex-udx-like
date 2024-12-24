import {WebSocketServer} from "ws";
import {
    createPortPool,
    enableLocalHostInterface,
    getWebSocketURL,
    resetStore,
    webSocketServer
} from "rxprotoplex-peers";
const portPool = createPortPool(20000, 30000);
export async function useWebServer(cb, t) {
    enableLocalHostInterface();
    const port = portPool.allocate();
    const wss = new WebSocketServer({port});
    await new Promise((resolve) => wss.once("listening", resolve));
    console.log(`Web socket server listening on ${port}`);
    const wsUrl = getWebSocketURL(wss);
    const server$ = webSocketServer(wss);
    await cb(wsUrl);
    t?.teardown?.(async () => {
        wss.close();
        server$.close$.next();
        portPool.release(port);
        resetStore();
    });
}