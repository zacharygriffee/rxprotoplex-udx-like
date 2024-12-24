import Hyperswarm from "hyperswarm";
import HyperDHT from "hyperdht";
import {UDX} from "../index.js";
import {useOneInterface} from "./fixtures/useOneInterface.js";
import {useServerAndOneInterface} from "./fixtures/useServerAndOneInterface.js";
import {useServerAndTwoInterfaces} from "./fixtures/useServerAndTwoInterfaces.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

useServerAndTwoInterfaces(async (nic1, nic2) => {
    const udx = new UDX({ localInterface: nic1 });
    const udx2 = new UDX({ localInterface: nic2 });
    const publicIP = nic1.ip;
    const node = HyperDHT.bootstrapper(5000, publicIP, {
        udx
    });
    await node.fullyBootstrapped();
    const bootstrap = [{ host: publicIP, port: node.address().port }];

    const persistent1 = new HyperDHT({ bootstrap, ephemeral: false, udx: udx2 });
    await persistent1.fullyBootstrapped();

    console.log("OK");

    const node1 = new HyperDHT({bootstrap, udx: udx2});
    const node2 = new HyperDHT({bootstrap, udx: udx2});

    await node1.fullyBootstrapped();
    await node2.fullyBootstrapped();

    const server = node1.createServer((sock) => {
        console.log("server connection", sock);
    });

    await server.listen();

    const socket = node2.connect(server.publicKey);
    socket.once("open", () => {
        console.log("socket open");
    });

    // debugger;
    // const dht = new HyperDHT({udx});


});