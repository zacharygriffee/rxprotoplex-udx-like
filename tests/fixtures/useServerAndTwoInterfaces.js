import {useWebServer} from "./useWebServer.js";
import {useTwoInterfaces} from "./useTwoInterfaces.js";

export async function useServerAndTwoInterfaces(cb, t) {
    await useWebServer(wsUrl => useTwoInterfaces(wsUrl, cb, t), t);
}
