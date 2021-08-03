const fs = require('fs');
const WebSocket = require('ws');
const FFmpeg = require('./ffmpeg');
const GStreamer = require('./gstreamer');
const { getPort, releasePort } = require('./port');
const { initializeWorkers, createRouter, createTransport } = require('./worker');
const config = require('./config');
const https = require('http');
const { v1: uuidv1 } = require('uuid');
const roomSession = require('./roomSession');
const Peer = require('./peer');
const { nanoid } = require('nanoid');

const RECORDER_PROCESS_NAME = process.env.PROCESS_NAME || 'FFmpeg';
const SERVER_PORT = process.env.SERVER_PORT || 3000;


const httpsServer = https.createServer();
const wss = new WebSocket.Server({ server: httpsServer });


// All active call session
const vcSessions = new Map();

// Room code
const rooms = new Map();

/**
 * Route request to their functions
 * 
 * @param {object} jsonMsg 
 * @param {*} socket 
 * @returns 
 */
const HandleActions = async (jsonMsg, socket) => {
    const { action } = jsonMsg;

    switch (action) {
        case 'create-room':
            return await createRoom(jsonMsg, socket);
        case 'join-room':
            return joinRoom(jsonMsg, socket);
        case 'leave-room':
            return leaveRoom(jsonMsg);
        case 'get-producers':
            return HandleProducerListRequest(jsonMsg)
        case 'getRouterCapabilities':
            return getRouterCapabilities(jsonMsg);
        case 'create-transport':
            return await handleCreateTransportRequest(jsonMsg);
        case 'connect-transport':
            return await handleTransportConnectRequest(jsonMsg);
        case 'produce':
            return await handleProduceRequest(jsonMsg);
        case 'consume':
            return await handleConsumeRequest(jsonMsg);
        case 'consuming':
            return await handleConsuming(jsonMsg);
        default:
            console.log('HandleActions() unknown action [action:%s]', action);
    }
}

/**
 * log the transport events
 * 
 * @param {*} transport 
 */
const MonitorTransport = (transport) => {
    transport.observer.on("newproducer", (producer) => {
        console.log("New producer created [id:%s]", producer.id);
    });
    transport.observer.on("newconsumer", (consumer) => {
        console.log("New consumer created [id:%s]", consumer.id);
    });
    transport.on("icestatechange", (iceState) => {
        console.log("ICE state changed to %s", iceState);
    });
}

/**
 * Create room
 * 
 * @param {*} jsonMessage 
 * @param {*} socket 
 * @returns 
 */
const createRoom = async (jsonMessage, socket) => {

    const room = new roomSession();
    const peer = new Peer();

    socket.sessionId = room.sessionId;
    socket.peerId = peer.peerId

    peer.socket = socket;
    room.addPeer(peer);

    // create mediasoup router for the session
    room.router = await createRouter();

    vcSessions.set(room.sessionId, room)

    // send room code to creator
    const roomCode = nanoid(6);

    rooms.set(roomCode, room.sessionId)

    const routerCapabilities = {
        action: 'router-rtp-capabilities',
        type: 'produce',
        routerRtpCapabilities: room.router.rtpCapabilities,
        sessionId: room.sessionId,
        peerId: peer.peerId,
        roomCode: roomCode
    };

    return routerCapabilities;
}

/**
 * Join Room
 * @param {*} jsonMessage 
 * @param {*} socket 
 * @returns 
 */
const joinRoom = (jsonMessage, socket) => {

    const sessionId = rooms.get(jsonMessage.roomCode);

    if (!sessionId) {
        return {
            action: "room-error",
            code: "room-not-found",
        }
    }

    const room = vcSessions.get(sessionId);

    if (room.peers.length === 2) {
        return {
            action: "room-error",
            code: "room-full"
        }
    }

    const peer = new Peer();
    
    socket.sessionId = sessionId;
    peer.socket = socket;
    room.addPeer(peer);

    const routerCapabilities = {
        action: 'router-rtp-capabilities',
        type: 'consume',
        routerRtpCapabilities: room.router.rtpCapabilities,
        sessionId: room.sessionId,
        peerId: peer.peerId
    };

    return routerCapabilities;

}

/**
 * Join room
 * @param {*} jsonMessage 
 */
const leaveRoom = (jsonMessage) => {
    HandleLeaveRoom(jsonMessage.sessionId, jsonMessage.peerId)
}

const HandleLeaveRoom = (sessionId, peerId) => {

    const room = vcSessions.get(sessionId);
    const peer = room.getPeer(peerId)

    stopRecording(peer)

    room.removePeer(peerId);

    peer.socket.peerId = undefined
    peer.socket.sessionId = undefined

    if (room.peers.length === 0) {
        closeRoom(room)
        return
    }

    room.peers.forEach(_peer => {
        if (_peer.peerId === peer.peerId) {
            return
        }
        _peer.socket.send(JSON.stringify({
            action: 'peer-closed',
            sessionId: sessionId
        }))
    })
}

/**
 * Create webrtc transport
 * 
 * @param {*} jsonMessage 
 * @returns 
 */
const handleCreateTransportRequest = async (jsonMessage) => {

    const sessionId = jsonMessage.sessionId;
    const room = vcSessions.get(sessionId);

    const transport = await createTransport('webRTC', room.router);

    MonitorTransport(transport);

    const peer = room.getPeer(jsonMessage.peerId);
    peer.addTransport(transport);

    return {
        action: 'create-transport',
        type: jsonMessage.type,
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
        sessionId: jsonMessage.sessionId
    };
};

/**
 * Handle transport connect request
 * @param {*} jsonMessage 
 * @returns 
 */
const handleTransportConnectRequest = async (jsonMessage) => {

    const room = vcSessions.get(jsonMessage.sessionId);
    const peer = room.getPeer(jsonMessage.peerId);

    if (!room) {
        throw new Error(`Peer with id ${jsonMessage.sessionId} was not found`);
    }

    const transport = peer.getTransport(jsonMessage.transportId);

    if (!transport) {
        throw new Error(`Transport with id ${jsonMessage.transportId} was not found`);
    }

    await transport.connect({ dtlsParameters: jsonMessage.dtlsParameters });
    console.log('handleTransportConnectRequest() transport connected');
    return {
        action: 'connect-transport',
        sessionId: jsonMessage.sessionId
    };
};

/**
 * handle produce request
 * 
 * @param {*} jsonMessage 
 * @returns 
 */
const handleProduceRequest = async (jsonMessage) => {
    console.log('handleProduceRequest [data:%o]', jsonMessage);

    const room = vcSessions.get(jsonMessage.sessionId);
    const peer = room.getPeer(jsonMessage.peerId);

    if (!room) {
        throw new Error(`Room with id ${jsonMessage.sessionId} was not found`);
    }

    const transport = peer.getTransport(jsonMessage.transportId);

    if (!transport) {
        throw new Error(`Transport with id ${jsonMessage.transportId} was not found`);
    }

    // create producer
    const producer = await transport.produce({
        kind: jsonMessage.kind,
        rtpParameters: jsonMessage.rtpParameters
    });

    peer.addProducer(producer);

    // update connected peers to use this producer
    room.peers.forEach(_peer => {

        // skip the current peer
        if (_peer.peerId === peer.peerId) {
            return
        }
       
       _peer.socket.send(JSON.stringify({
            action: 'create-consumer',
            sessionId: jsonMessage.sessionId,
            producerId: producer.id
        }))

    }); 

    console.log('handleProducerRequest() new producer added [id:%s, kind:%s]', producer.id, producer.kind);

    // initiate recording after few seconds
    if (peer.getProducers().length == 2) {
        setTimeout(() => {
            initiateRecording(room.sessionId, peer.peerId)
        }, 1000)
    }

    return {
        action: 'produce',
        id: producer.id,
        kind: producer.kind,
        sessionId: jsonMessage.sessionId
    };
}

/**
 * Send all producers in the room
 * 
 * @param {*} jsonMessage 
 * @returns 
 */
const HandleProducerListRequest = async (jsonMessage) => {
    
    const room = vcSessions.get(jsonMessage.sessionId);

    if (!room) {
        throw new Error(`Room with id ${jsonMessage.sessionId} was not found`);
    }

    const peer = room.getPeer(jsonMessage.peerId);

    const producerList = {};

    room.peers.forEach(_peer => {
        // skip current peer
        if (_peer.peerId === peer.peerId) {
            return
        }

        // send producer kind and id
        const producers = [];
        _peer.getProducers().forEach(producer => {
            producers.push({kind: producer.kind, id: producer.id})
        })

        producerList[_peer.peerId] = producers
    })

    return {
        action: 'create-consumers',
        sessionId: jsonMessage.sessionId,
        producerList: producerList,
    }
}

/**
 * create consumer for a producer
 * 
 * @param {*} jsonMessage 
 * @returns 
 */
const handleConsumeRequest = async (jsonMessage) => {
    console.log('handleConsumeRequest [data:%o]', jsonMessage);

    const room = vcSessions.get(jsonMessage.sessionId);

    if (!room) {
        throw new Error(`Room with id ${jsonMessage.sessionId} was not found`);
    }

    const peer = room.getPeer(jsonMessage.peerId);

    const transport = peer.getTransport(jsonMessage.transportId);

    if (!transport) {
        throw new Error(`Transport with id ${jsonMessage.transportId} was not found`);
    }

    // create consumer
    const consume = await transport.consume({
        producerId: jsonMessage.producerId,
        rtpCapabilities: room.router.rtpCapabilities,
        paused: true
    });

    peer.addConsumer(consume);

    console.log('handleConsumeRequest() new consumer added [id:%s, kind:%s]', consume.id, consume.kind);

    return {
        action: 'new-consumer',
        id: consume.id,
        producerId: jsonMessage.producerId,
        kind: consume.kind,
        rtpParameters: consume.rtpParameters
    };
}

/**
 * Resume consumer
 * 
 * @param {*} jsonMessage 
 */
const handleConsuming = async (jsonMessage) => {

    console.log('handleConsuming() [data:%o]', jsonMessage);

    const room = vcSessions.get(jsonMessage.sessionId);

    if (!room) {
        throw new Error(`Room with id ${jsonMessage.sessionId} was not found`);
    }

    const peer = room.getPeer(jsonMessage.peerId);
    const consumer = peer.getConsumer(jsonMessage.consumerId);
    consumer.resume();

}

/**
 * Initiate Recording for the peer
 * 
 * @param {string} roomId 
 * @param {string} peerId 
 */
const initiateRecording = async (roomId, peerId) => {
    console.log('initiateRecording()');

    const room = vcSessions.get(roomId);

    if (!room) {
        throw new Error(`Room with id ${jsonMessage.sessionId} was not found`);
    }

    const peer = room.getPeer(peerId);

    if (!peer) {
        throw new Error(`Peer with id ${peerId} was not found`);
    }

    await startRecord(peer, room.router);
};



const publishProducerRtpStream = async (peer, router, producer, ffmpegRtpCapabilities) => {
    console.log('publishProducerRtpStream()');

    // Create the mediasoup RTP Transport used to send media to the GStreamer process
    const rtpTransportConfig = config.plainRtpTransport;

    // If the process is set to GStreamer set rtcpMux to false
    if (RECORDER_PROCESS_NAME === 'GStreamer') {
        rtpTransportConfig.rtcpMux = false;
    }

    const rtpTransport = await createTransport('plain', router, rtpTransportConfig);

    // Set the receiver RTP ports
    const remoteRtpPort = await getPort();
    peer.remotePorts.push(remoteRtpPort);

    let remoteRtcpPort;
    // If rtpTransport rtcpMux is false also set the receiver RTCP ports
    if (!rtpTransportConfig.rtcpMux) {
        remoteRtcpPort = await getPort();
        peer.remotePorts.push(remoteRtcpPort);
    }


    // Connect the mediasoup RTP transport to the ports used by GStreamer
    await rtpTransport.connect({
        ip: '127.0.0.1',
        port: remoteRtpPort,
        rtcpPort: remoteRtcpPort
    });

    peer.addTransport(rtpTransport);

    const codecs = [];
    // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
    const routerCodec = router.rtpCapabilities.codecs.find(
        codec => codec.kind === producer.kind
    );
    codecs.push(routerCodec);

    const rtpCapabilities = {
        codecs,
        rtcpFeedback: []
    };

    // Start the consumer paused
    // Once the gStreamer process is ready to consume resume and send a keyframe
    const rtpConsumer = await rtpTransport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: true
    });

    peer.rtpConsumers.push(rtpConsumer);

    return {
        remoteRtpPort,
        remoteRtcpPort,
        localRtcpPort: rtpTransport.rtcpTuple ? rtpTransport.rtcpTuple.localPort : undefined,
        rtpCapabilities,
        rtpParameters: rtpConsumer.rtpParameters
    };
};


const startRecord = async (peer, router) => {
    let recordInfo = {};

    for (const producer of peer.producers) {
        recordInfo[producer.kind] = await publishProducerRtpStream(peer, router, producer);
    }

    recordInfo.fileName = Date.now().toString();

    peer.process = getProcess(recordInfo);

    setTimeout(async () => {
        for (const consumer of peer.rtpConsumers) {
            // Sometimes the consumer gets resumed before the GStreamer process has fully started
            // so wait a couple of seconds
            await consumer.resume();
        }
    }, 1000);
};

// Returns process command to use (GStreamer/FFmpeg) default is FFmpeg
const getProcess = (recordInfo) => {
    switch (RECORDER_PROCESS_NAME) {
        case 'GStreamer':
            return new GStreamer(recordInfo);
        case 'FFmpeg':
        default:
            return new FFmpeg(recordInfo);
    }
};


const stopRecording = (peer) => {
    // kill recording process
    if (peer.process) {
        peer.process.kill()
        peer.process = undefined
    }
    

    for (const remotePort of peer.remotePorts) {
        releasePort(remotePort);
    }
}

/**
 * Close room and clear transports, producers, consumers
 * 
 * @param {object} room 
 */
 const closeRoom = (room) => {

    console.log('closeRoom() : closing session');

    const transports    = room.getTransports();
    const consumers     = room.getConsumers();
    const producers     = room.getProducers();

    transports.forEach((transport, indx) => {
        transport.close();
    });

    consumers.forEach((consumer, indx) => {
        consumer.close();
    });

    producers.forEach((producer, indx) => {
        producer.close();
    });

    room.router.close();

}

// websocket
wss.on('connection', async (socket, request) => {

    // handle websocket messages
    socket.on('message', async (message) => {
        try {
            const jsonMessage = JSON.parse(message);
            console.log('socket::message [jsonMessage:%o]', jsonMessage);
            const response = await HandleActions(jsonMessage, socket);
            if (response) {
                console.log('sending response %o', response);
                socket.send(JSON.stringify(response));
            }
        } catch (error) {
            console.error('Failed to handle socket message [error:%o]', error);
        }
    });

    // on socket close
    socket.once('close', () => {
        console.log('socket::close [sessionId:%s]', socket.sessionId);

        if (socket.sessionId) {
            HandleLeaveRoom(socket.sessionId, socket.peerId)
        }
    });

});


(async () => {
    try {
        console.log('starting server [processName:%s]', RECORDER_PROCESS_NAME);

        await initializeWorkers();

        httpsServer.listen(SERVER_PORT, () =>
            console.log('Socket Server listening on port %d', SERVER_PORT)
        );
        
    } catch (error) {
        console.error('Failed to initialize application [error:%o] destroying in 2 seconds...', error);
        setTimeout(() => process.exit(1), 2000);
    }
})();