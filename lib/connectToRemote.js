import {connect, connectToAllInterfaces, getSocketByIp} from "rxprotoplex-peers";

const connectToRemote = (fromLocal, toRemote) => {
    if (!getSocketByIp(toRemote))
        fromLocal === "0.0.0.0" ? connectToAllInterfaces(toRemote) : connect(fromLocal, toRemote);
}

export { connectToRemote };