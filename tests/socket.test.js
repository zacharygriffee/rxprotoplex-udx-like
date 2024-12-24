import {test, solo} from 'brittle';
import b4a from 'b4a';
import {UDX} from '../index.js';
import { uncaught, createSocket } from './helpers.js';
import {useServerAndOneInterface} from "./fixtures/useServerAndOneInterface.js";
import {closeInterface} from "rxprotoplex-peers";

await useServerAndOneInterface(nic => {
    test('can bind and close', async function (t) {
        const u = new UDX();
        const s = createSocket(t, u);

        s.bind(0, '127.0.0.1');
        await s.close();

        t.pass();
    });

    test('bind is effectively sync', async function (t) {
        const u = new UDX();

        const a = createSocket(t, u);
        const b = createSocket(t, u);

        a.bind(0, '127.0.0.1');

        t.ok(a.address().port, 'has bound');
        t.exception(() => b.bind(a.address().port, '127.0.0.1'));

        await a.close();
        await b.close();
    });

    test('simple message', async function (t) {
        t.plan(4);

        const u = new UDX();
        const a = createSocket(t, u);

        a.on('message', function (message, { host, family, port }) {
            t.alike(message, b4a.from('hello'));
            t.is(host, '127.0.0.1');
            t.is(family, 4);
            t.is(port, a.address().port);
            a.close();
        });

        a.bind(0, '127.0.0.1');
        await a.send(b4a.from('hello'), a.address().port);
    });

    test('empty message', async function (t) {
        t.plan(1);

        const u = new UDX();
        const a = createSocket(t, u);

        a.on('message', function (message) {
            t.alike(message, b4a.alloc(0));
            a.close();
        });

        a.bind(0, '127.0.0.1');
        await a.send(b4a.alloc(0), a.address().port);
    });

    test('handshake', async function (t) {
        t.plan(2);

        const u = new UDX();
        const a = createSocket(t, u);
        const b = createSocket(t, u);

        t.teardown(async () => {
            await a.close();
            await b.close();
        });

        a.once('message', function (message) {
            t.alike(message, b4a.alloc(1));
        });

        b.once('message', function (message) {
            t.alike(message, b4a.alloc(0));
        });

        a.bind(0, '127.0.0.1');
        b.bind(0, '127.0.0.1');

        a.trySend(b4a.alloc(0), b.address().port);
        b.trySend(b4a.alloc(1), a.address().port);
    });

    // test('close socket while sending', async function (t) {
    //     const u = new UDX();
    //     const a = createSocket(t, u);
    //
    //     a.bind(0, '127.0.0.1');
    //     const flushed = a.send(b4a.from('hello'), a.address().port);
    //
    //     a.close();
    //
    //     t.is(await flushed, false);
    // });

    // test('close waits for all streams to close', async function (t) {
    //     t.plan(2);
    //
    //     const u = new UDX();
    //
    //     const dummy = createSocket(t, u);
    //     dummy.bind(0, '127.0.0.1');
    //     t.teardown(() => dummy.close());
    //
    //     const a = createSocket(t, u);
    //     const s = u.createStream(1);
    //
    //     s.connect(a, 2, dummy.address().port);
    //
    //     let aClosed = false;
    //     let sClosed = false;
    //
    //     s.on('close', function () {
    //         t.not(aClosed, 'socket waits for streams');
    //         sClosed = true;
    //     });
    //
    //     a.on('close', function () {
    //         t.ok(sClosed, 'stream was closed before socket');
    //         aClosed = true;
    //     });
    //
    //     a.close();
    //
    //     setTimeout(function () {
    //         s.destroy();
    //     }, 100);
    // });

    test('send without bind', async function (t) {
        t.plan(1);

        const u = new UDX();
        const a = createSocket(t, u);
        const b = createSocket(t, u);

        b.on('message', function (message) {
            t.alike(message, b4a.from('hello'));
            a.close();
            b.close();
        });

        b.bind(0, '127.0.0.1');
        await a.send(b4a.from('hello'), b.address().port);
    });

    test('try send without bind', async function (t) {
        t.plan(1);

        const u = new UDX();
        const a = createSocket(t, u);
        const b = createSocket(t, u);

        b.on('message', function (message) {
            t.alike(message, b4a.from('hello'));
            a.close();
            b.close();
        });

        b.bind(0, '127.0.0.1');
        a.trySend(b4a.from('hello'), b.address().port);
    });

    test('throw in message callback', async function (t) {
        t.plan(1);

        const u = new UDX();
        const a = createSocket(t, u);
        const b = createSocket(t, u);

        a.on('message', function () {
            throw new Error('boom');
        });

        a.bind(0, '127.0.0.1');

        b.send(b4a.from('hello'), a.address().port);

        uncaught(async (err) => {
            t.is(err.message, 'boom');

            await a.close();
            await b.close();
        });
    });

    test('get address without bind', async function (t) {
        const u = new UDX();
        const a = createSocket(t, u);
        t.is(a.address(), null);
        await a.close();
    });

    test('bind twice', async function (t) {
        t.plan(1);

        const u = new UDX();
        const a = createSocket(t, u);

        a.bind(0, '127.0.0.1');

        try {
            a.bind(0, '127.0.0.1');
        } catch (error) {
            t.is(error.message, 'Already bound');
        }

        await a.close();
    });

    test('close twice', async function (t) {
        t.plan(1);

        const u = new UDX();
        const a = createSocket(t, u);

        a.bind(0, '127.0.0.1');

        a.on('close', function () {
            t.pass();
        });

        a.close();
        a.close();
    });

    test("", () => {
        closeInterface(nic);
    });
    //
    // test('set TTL', async function (t) {
    //     t.plan(2);
    //
    //     const u = new UDX();
    //     const a = createSocket(t, u);
    //
    //     a.on('message', function (message) {
    //         t.alike(message, b4a.from('hello'));
    //         a.close();
    //     });
    //
    //     try {
    //         a.setTTL(5);
    //     } catch (error) {
    //         t.is(error.message, 'Socket not active');
    //     }
    //
    //     a.bind(0, '127.0.0.1');
    //     a.setTTL(5);
    //
    //     await a.send(b4a.from('hello'), a.address().port);
    // });
});

