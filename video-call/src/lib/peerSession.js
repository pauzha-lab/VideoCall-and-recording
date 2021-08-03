import { Device } from 'mediasoup-client';
import { getUserMedia } from './mediaCapturer';
import { SocketQueue } from './SocketQueue';
import { EventEmitter } from 'events';
import { WEBSOCKET_ADDRESS } from './constants';

export class peerSession {

    constructor({ remoteElm, localElm, audioInpSelect, audioOutSelect, videoInpSelect }) {

        // Remote HTML video element
        this.remoteElement  = document.getElementById(remoteElm)

        // local HTML video element
        this.localElement   = document.getElementById(localElm)

        // select dropdown element
        this.audioInpSelect = document.getElementById(audioInpSelect)
        this.audioOutSelect = document.getElementById(audioOutSelect)
        this.videoInpSelect = document.getElementById(videoInpSelect)

        // get list of available audio and video devices
        this.getDevices();

        this.producers = []
        this.consumers = []

        // session events
        this.events = new EventEmitter()

        // constraints for getUserMedia
        this.DEFAULT_CONSTRAINTS = {
            audio: true, video: true
        }

        // mediasoup device
        this.device = new Device();

        // queue to handle events callback
        this.queue  = new SocketQueue();

        // create websocket
        this.socket = new WebSocket(WEBSOCKET_ADDRESS);

        // session connection state
        this.connected = false

        // handle socket
        this.socket.addEventListener('open', this.handleSocketOpen);
        this.socket.addEventListener('message', this.handleSocketMessage);
        this.socket.addEventListener('error', this.handleSocketError);
        this.socket.addEventListener('close', this.handleSocketClose);

    }

    /**
     * Handle incoming socket messages
     * @param {string} message 
     */
    handleSocketMessage = async (message) => {
        try {
            const jsonMessage = JSON.parse(message.data);
            this.handleAction(jsonMessage);
        } catch (error) {
            console.error('handleSocketMessage() failed [error:%o]', error);
        }
    }

    /**
     * Route actions based on request from server
     * 
     * @param {object} jsonMsg 
     */
    handleAction(jsonMsg) {
        const { action } =  jsonMsg

        switch (action) {
            case 'router-rtp-capabilities':
                this.handleRouterRtpCapabilitiesRequest(jsonMsg);
                break;
            case 'create-transport':
                this.handleCreateTransportRequest(jsonMsg);
                break;
            case 'connect-transport':
                this.handleConnectTransportRequest(jsonMsg);
                break;
            case 'produce':
                this.handleProduceRequest(jsonMsg);
                break;
            case 'create-consumer':
                this.handleCreateConsumer(jsonMsg);
                break;
            case 'create-consumers':
                this.handleCreateConsumers(jsonMsg);
                break;
            case 'new-consumer':
                this.HandleNewConsumer(jsonMsg)
                break;
            case 'peer-closed':
                this.HandlePeerClosed(jsonMsg)
                break
            case 'room-closed':
                this.handleRoomClosed(jsonMsg);
                break;
            case 'room-error':
                this.handleRoomError(jsonMsg)
                break
            default: console.log('handleAction() unknown action %s', action);
        }
    }

    /**
     * Handle room error and emit the status
     * 
     * @param {*} param0 c
     */
    handleRoomError = ({ code }) => {
        switch (code) {
            case "room-not-found":
                this.events.emit("room_not_found");
                break;
            case "room-full":
                this.events.emit("room_full");
                break;
            default:
                console.log('handleRoomError() unknown error [code:%s]', code);
        }
    }

    /**
     * Create a room
     */
    create = async () => {
        if (this.socket.readyState === WebSocket.OPEN) {
            
            await this.getLocalMedia()
    
            // request to create room
            this.socket.send(JSON.stringify({
                action: 'create-room'
            }));

        } else {
            setTimeout(() => { this.create() }, 500);
        }
    }

    /**
     * Join a room
     * @param {string} roomCode 
     */
    join = async (roomCode) => {
        if (this.socket.readyState === WebSocket.OPEN) {
            
            await this.getLocalMedia()
    
            // request to join room
            this.socket.send(JSON.stringify({
                action: 'join-room',
                roomCode: roomCode
            }));
            
        } else {
            setTimeout(() => { this.join(roomCode) }, 500);
        }
    }

    /**
     * Leave current room
     */
    leave() {
        this.socket.send(JSON.stringify({
            action: 'leave-room',
            sessionId: this.sessionId,
            peerId: this.peerId
        }));
    }

    /**
     * Emit room closed event
     */
    handleRoomClosed = () => {
        this.events.emit("closed");
    }

    /**
     * Handle closed peer in room
     * @param {object} jsonMessage 
     */
    HandlePeerClosed = (jsonMessage) => {
        this.remoteElement.pause()
        this.remoteElement.style.opacity = 0
        this.remoteElement.srcObject = null
        this.remoteStream = undefined

        this.consumers.forEach(consumer => {
            consumer.close()
        })

        this.consumers = []
    }

    /**
     * Handle router RTP Capabilities and create receiving transport and sending transport
     * 
     * @param {object} jsonMessage 
     */
    handleRouterRtpCapabilitiesRequest = async (jsonMessage) => {

        if (jsonMessage.roomCode) {
            this.roomCode = jsonMessage.roomCode
            this.events.emit("room_created", this.roomCode)
        }

        const { type, routerRtpCapabilities, sessionId, peerId } = jsonMessage;
    
        console.log('handleRouterRtpCapabilities() [type:%s] [rtpCapabilities:%o]', type, routerRtpCapabilities);
    
    
        try {
            await this.device.load({ routerRtpCapabilities });
    
            // update call info
            this.sessionId = sessionId;
            this.peerId = peerId;
    
            // create local transport for consuming and producing
            this.createTransport('produce');
            this.createTransport('consume');
    
        } catch (error) {
            /* console.error('handleRouterRtpCapabilities() failed to init device [error:%o]', error); */
    
            console.log(`handleRouterRtpCapabilities() failed to init device`)
            this.socket.close();
        }
    }

    /**
     * send transport create request to server
     * @param {object} type 
     */
    createTransport = (type) => {

        if (!this.device.loaded || !this.sessionId) {
            throw new Error('session or device is not initialized');
        }
    
        console.log('createTransport() [sessionId:%s]', this.sessionId);
    
        // First we must create the mediasoup transport on the server side
        this.socket.send(JSON.stringify({
            action: 'create-transport',
            sessionId: this.sessionId,
            peerId: this.peerId,
            type: type
        }));
    }

    /**
     * Handle create transport request from server
     * @param {object} jsonMessage 
     */
    handleCreateTransportRequest = async (jsonMessage) => {

        console.log('handleCreateTransportRequest() [data:%o]', jsonMessage);
    
        try {
            // Create the local mediasoup transport
            let transport;
    
            if (jsonMessage.type === 'produce') {
                transport = this.device.createSendTransport(jsonMessage);
            } else if (jsonMessage.type === 'consume') {
                transport = this.device.createRecvTransport(jsonMessage);
            }
    
            console.log('handleCreateTransportRequest() ' + jsonMessage.type + ' created [id:%s]', transport.id);
    
            // Set the transport listeners and get the users media stream
            this.handleTransportListeners(jsonMessage.type, transport);
    
            if (jsonMessage.type === 'produce') {
                this.producerMediaStream();
            }
            else if (jsonMessage.type === 'consume') {
                this.socket.send(JSON.stringify({
                    action: 'get-producers',
                    sessionId: this.sessionId,
                    peerId: this.peerId
                }))
            }
    
        } catch (error) {
            console.error('handleCreateTransportRequest() failed to create transport [error:%o]', error); 
            this.socket.close();
        }
    }

    /**
     * Manage transport events (connect, produce, consume)
     * 
     * @param {string} type 
     * @param {*} transport 
     */
    handleTransportListeners = (type, transport) => {
        if (type === 'produce') {
            transport.on('connect', this.handleTransportConnectEvent(transport.id));
            transport.on('produce', this.handleTransportProduceEvent);
            transport.on('connectionstatechange', connectionState => {
                console.log(`send transport connection state change state: ${connectionState}`)
            });
            this.sendTransport = transport;
        } else if (type === 'consume') {
            transport.on('connect', this.handleTransportConnectEvent(transport.id));
            transport.on('connectionstatechange', connectionState => {
                console.log(`recv transport connection state change state: ${connectionState}`);
            });
            this.recvTransport = transport;
        }
    }

    /**
     * Get session producers by its kind (audio or video)
     * @param {*} kind 
     * @returns 
     */
    getProducersByKind = (kind) => {
        return this.producers.filter((producer => producer.kind === kind));
    }

    /**
     * send local media stream to server
     * 
     * @returns
     */
    producerMediaStream = async () => {

        console.log('producerMediaStream()');
    
        // Get the video and audio tracks from the media stream
        this.videoTrack = this.mediaStream.getVideoTracks()[0];
        this.audioTrack = this.mediaStream.getAudioTracks()[0];
    
        // If there is a video track start sending it to the server
        if (this.videoTrack) {
    
            /* console.log(`getVideoCodecs():`, getVideoCodecs()) */
    
            console.log(JSON.stringify(this.device.rtpCapabilities))
    
            const videoProducer = await this.sendTransport.produce({
                track: this.videoTrack,
                codec: this.device.rtpCapabilities.codecs.find((codec) => codec.mimeType.toLowerCase() === 'video/vp8')
            });
            this.producers.push(videoProducer);
        }
    
        // if there is a audio track start sending it to the server
        if (this.audioTrack) {
            const audioProducer = await this.sendTransport.produce({ track: this.audioTrack });
            this.producers.push(audioProducer);
        }
    
        console.log("producerMediaStream() completed")
    
        return;
    }

    handleTransportConnectEvent = (transportId) => {
        return ({ dtlsParameters }, callback, errorBack) => {
            console.log('handleTransportConnectEvent()');
            try {
                const action = (jsonMessage) => {
                    console.log('connect-transport action');
                    callback();
                    this.queue.remove('connect-transport');
                };
    
                this.queue.push('connect-transport', action);
    
                this.socket.send(JSON.stringify({
                    action: 'connect-transport',
                    sessionId: this.sessionId,
                    transportId: transportId,
                    peerId: this.peerId,
                    dtlsParameters,
                }));
            } catch (error) {
                console.error('handleTransportConnectEvent() failed [error:%o]', error);
                errorBack(error);
            }
        }
    
    }

    /**
     * handle produce event
     * 
     * @param {*} param0 
     * @param {*} callback 
     * @param {*} errorBack 
     */
    handleTransportProduceEvent = ({ kind, rtpParameters }, callback, errorBack) => {
        console.log('handleTransportProduceEvent()');
        try {
            const action = jsonMessage => {
                console.log('handleTransportProduceEvent callback [data:%o]', jsonMessage);
                callback({ id: jsonMessage.id });
                this.queue.remove('produce');
            };
    
            this.queue.push('produce', action);
    
            this.socket.send(JSON.stringify({
                action: 'produce',
                sessionId: this.sessionId,
                transportId: this.sendTransport.id,
                kind,
                rtpParameters,
                peerId: this.peerId,
            }));
        } catch (error) {
            console.error('handleTransportProduceEvent() failed [error:%o]', error);
            errorBack(error);
        }
    }

    /**
     * Connect transport
     * 
     * @param {*} jsonMessage 
     */
    handleConnectTransportRequest = async (jsonMessage) => {
        console.log('handleTransportConnectRequest()');
        try {
            const action = this.queue.get('connect-transport');
            if (!action) {
                throw new Error('transport-connect action was not found');
            }
            await action(jsonMessage);
        } catch (error) {
            /* console.error('handleTransportConnectRequest() failed [error:%o]', error); */
            console.log('handleTransportConnectRequest() failed')
        }
    }

    /**
     * handle produce request from server
     * @param {object} jsonMessage 
     */
    handleProduceRequest = async (jsonMessage) => {
        console.log('handleProduceRequest()');
        try {
            const action = this.queue.get('produce');
            if (!action) {
                throw new Error('produce action was not found');
            }
            await action(jsonMessage);
        } catch (error) {
            console.error('handleProduceRequest() failed [error:%o]', error);
        }
    }

    /**
     * Create consumer for a producer
     * 
     * @param {object} jsonMessage 
     */
    handleCreateConsumer = (jsonMessage) => {

        console.log("handleCreateConsumer()")
    
        this.socket.send(JSON.stringify({
            action: 'consume',
            sessionId: this.sessionId,
            peerId: this.peerId,
            transportId: this.recvTransport.id,
            producerId: jsonMessage.producerId,
            producerPeerId: jsonMessage.producerPeerId
        }));
    }

    /**
     * consume all producers in the room
     * 
     * @param {object} jsonMessage 
     */
    handleCreateConsumers = (jsonMessage) => {

        console.log("handleCreateConsumers()")
    
        const producerPeers = jsonMessage.producerList;
        for (let producingPeerId of Object.keys(producerPeers)) {
            const producers = producerPeers[producingPeerId];
    
            producers.forEach((producer, indx) => {
                console.log("sending consuming request for %s to producer : %s", producer.kind, producer.id);
                this.socket.send(JSON.stringify({
                    action: 'consume',
                    sessionId: this.sessionId,
                    peerId: this.peerId,
                    transportId: this.recvTransport.id,
                    producerId: producer.id,
                    producerPeerId: producingPeerId
                }));
            });
        }
    }

    /**
     * consumer remote media tracks
     * 
     * @param {object} jsonMessage 
     */
    HandleNewConsumer = async (jsonMessage) => {

        console.log('HandleNewConsumer() [data:%o]', jsonMessage);
    
        const consumer = await this.recvTransport.consume({
            id: jsonMessage.id,
            producerId: jsonMessage.producerId,
            kind: jsonMessage.kind,
            rtpParameters: jsonMessage.rtpParameters
        });
    
        this.consumers.push(consumer);
    
        consumer.on("transportclose", () => {
            console.lo("transport closed so consumer closed");
        });
    
        consumer.observer.on("close", () => {
            console.log("consumer closed [consumer.id:%s]", consumer.id);
        });
    
        // Render the remote video track into a HTML video element.
        const { track } = consumer;
    
        console.log("consumer track received [consumer.id:%s]", consumer.id);
        console.log("consumer track received kind [consumer.id:%s]", track.kind);
    
    
        if (!this.remoteStream) {
            this.remoteStream = new MediaStream([track])
            this.remoteElement.srcObject = this.remoteStream;
        } else {
            this.remoteStream.addTrack(track);
        }
    
        this.remoteElement.onloadedmetadata = (e) => {
    
            this.remoteElement.play();
    
            if (!this.connected) {
                this.connected = true;

                this.events.emit("connected")
            }
            console.log("consumer track played");
        };
    
        if (track.kind === "video") {
            this.remoteElement.style.opacity = 1;
        }
    
        // update to server to resume consumer
        this.socket.send(JSON.stringify({
            action: 'consuming',
            sessionId: this.sessionId,
            consumerId: jsonMessage.id,
            peerId: this.peerId
        }));
    }

    getLocalMedia = async () => {
        this.mediaStream = await getUserMedia(this.DEFAULT_CONSTRAINTS);
        this.localElement.srcObject = this.mediaStream;
        this.localElement.onloadedmetadata = (e) => {
            this.localElement.style.opacity = 1;
            this.localElement.play();
        };
    }

    replaceTracks = async (track) => {
        const producer = this.getProducersByKind(track.kind)[0];
        await producer.replaceTrack({track: track});
    }

    replaceStream = (stream) => {
        
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getVideoTracks()[0];
        this.replaceTracks(videoTrack);
        this.replaceTracks(audioTrack);

        // stop old stream
        this.mediaStream.getTracks().forEach(track => track.stop());

        this.mediaStream = stream
        this.videoTrack = videoTrack
        this.audioTrack = audioTrack
    }

    getDevices() {
        navigator.mediaDevices.enumerateDevices()
            .then(this.gotDevices)
            .catch((error) => {
                console.error(error)
            });
    }

    gotDevices = (deviceInfos) => {

        this.videoInpSelect.innerHTML = "";
        this.audioInpSelect.innerHTML = "";
        this.audioOutSelect.innerHTML = "";

        for (let i = 0; i !== deviceInfos.length; ++i) {
            const deviceInfo = deviceInfos[i];
            var option = document.createElement('option');
            option.value = deviceInfo.deviceId;
            if (deviceInfo.kind === 'audioinput') {
                option.text = deviceInfo.label || 'Microphone ' + (this.audioInpSelect.length + 1);
                this.audioInpSelect.appendChild(option);
            } else if (deviceInfo.kind === 'audiooutput') {
                option.text = deviceInfo.label || 'Speaker ' + (this.audioOutSelect.length + 1);
                this.audioOutSelect.appendChild(option);
            } else if (deviceInfo.kind === 'videoinput') {
                option.text = deviceInfo.label || 'Camera ' + (this.videoInpSelect.length + 1);
                this.videoInpSelect.appendChild(option);
            }
        }
    }

    /**
     * change video input
     * @param {*} deviceId 
     */
    changeVideoInput = async (deviceId) => {
        this.DEFAULT_CONSTRAINTS.video = {
            deviceId: deviceId
        }
        const mediaStream = await getUserMedia(this.DEFAULT_CONSTRAINTS);
        this.replaceStream(mediaStream);
    }

    /**
     * change audio input
     * @param {*} deviceId 
     */
    changeAudioInput = async (deviceId) => {
        this.DEFAULT_CONSTRAINTS.audio = {
            deviceId: deviceId
        }
        const mediaStream = await getUserMedia(this.DEFAULT_CONSTRAINTS);
        this.replaceStream(mediaStream);
    }

    /**
     * Change audio output
     * @param {*} sinkId 
     */
    changeAudioOutput = (sinkId) => {
        const element = this.remoteElement;
        if (typeof element.sinkId !== 'undefined') {
            element.setSinkId(sinkId)
                .then(() => {
                    console.log(`Success, audio output device attached: ${sinkId}`);
                })
                .catch(error => {
                    let errorMessage = error;
                    if (error.name === 'SecurityError') {
                        errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
                    }
                    console.error(errorMessage);
                    // Jump back to first output device in the list as it's the default.
                    this.audioOutSelect.selectedIndex = 0;
                });
        } else {
            console.warn('Browser does not support output device selection.');
        }
    }

    enableVideo() {
        this.videoTrack.enabled = true
    }

    disableVideo() {
        this.videoTrack.enabled = false
    }

    enableAudio() {
        this.audioTrack.enabled = true
    }

    disableAudio() {
        this.audioTrack.enabled = false
    }

    unmuteOutput() {
        this.remoteElement.muted = false;
    }

    muteOutput() {
        this.remoteElement.muted = true;
    }

    handleSocketOpen = async () => {
        console.log('handleSocketOpen()');
    };
    
    handleSocketClose = () => {
        console.log('handleSocketClose()');
    };
    
    handleSocketError = error => {
        console.log('handleSocketError() [error:%o]', error);
    };

    close = () => {

        // close all transports
        if (this.recvTransport) {
            this.recvTransport.close()
        }

        if (this.sendTransport) {
            this.sendTransport.close()
        }

        // close socket
        this.socket.close()

        // end local media streams
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        // set connection state
        this.connected = false
    }
}