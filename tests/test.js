import {test} from "brittle";
import {idOf} from "rxprotoplex-peers";
import {UDX} from "../lib/udx.js";
import b4a from "b4a";

import {useServerAndOneInterface} from "./fixtures/useServerAndOneInterface.js";
import {useServerAndTwoInterfaces} from "./fixtures/useServerAndTwoInterfaces.js";

test("Test UDXSocket", async t => {
    // not working. the socket tests are working but not this.
    t.plan(1)
    const udx1 = new UDX();
    const udx2 = new UDX();

    await useServerAndOneInterface((nicA, nicB) => {
        const sock1 = udx1.createSocket();
        const sock2 = udx2.createSocket();
        sock1.bind(1234);
        sock1.on("message", test => {
            t.is(b4a.toString(test), "hello");
        });
        sock2.send(b4a.from("hello"), 1234);
        t.teardown(() => sock1.close() && sock2.close());
    }, t);
});

test("Test UDXStream", async t => {
    t.plan(8);

    await useServerAndTwoInterfaces(async (nicA, nicB) => {
        const udx1 = new UDX({ localInterface: nicA });
        const udx2 = new UDX({ localInterface: nicB });

        const testNetworkInterfaces = udx1.networkInterfaces().filter(o => !o.internal);

        t.is(idOf(nicA), testNetworkInterfaces[0].name);
        t.is(idOf(nicB), testNetworkInterfaces[1].name);
        t.is(nicA.ip, testNetworkInterfaces[0].host);
        t.is(nicB.ip, testNetworkInterfaces[1].host);
        t.is(testNetworkInterfaces[0].internal && testNetworkInterfaces[1].internal, false, "internal is always false for now");
        t.is(testNetworkInterfaces[0].family + testNetworkInterfaces[1].family, 8, "family is always ip4");

        const sock1 = udx1.createSocket();
        const sock2 = udx2.createSocket();

        // Bind sockets
        sock1.bind();
        console.log("Sock1 bound to", sock1.address());
        sock2.bind();
        console.log("Sock2 bound to", sock2.address());

        // Create streams
        const stream1 = udx1.createStream(1);
        const stream2 = udx2.createStream(2);

        console.log("Stream1 connecting to Stream2");
        stream1.connect(sock1, stream2.id, sock2.address()?.port, nicB.ip);

        console.log("Stream2 connecting to Stream1");
        stream2.connect(sock2, stream1.id, sock1.address()?.port, nicA.ip);

        // Add listeners
        stream1.on("data", data => {
            console.log("Stream1 received data:", b4a.toString(data));
            t.is(b4a.toString(data), "hello2", "Stream1 received correct message");
        });

        stream2.on("data", data => {
            console.log("Stream1 received data:", b4a.toString(data));
            t.is(b4a.toString(data), "hello1", "Stream1 received correct message");
        });

        stream2.on("error", err => console.error("Stream2 error:", err));
        stream1.on("error", err => console.error("Stream1 error:", err));

        // Send data from stream2 to stream1
        console.log("Stream2 writing data");
        stream2.write(b4a.from("hello2"));
        stream1.write(b4a.from("hello1"));

        t.teardown(() => {
            stream1.destroy();
            stream2.destroy();
            sock1.close();
            sock2.close();
        });
    }, t);
});

// await import("./socket.test.js");


