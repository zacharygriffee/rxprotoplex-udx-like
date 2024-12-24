import {useWebServer} from "./useWebServer.js";
import {useOneInterface} from "./useOneInterface.js";

export async function useServerAndOneInterface(cb, t) {
    await useWebServer(wsUrl => useOneInterface(wsUrl, cb, t), t);
}