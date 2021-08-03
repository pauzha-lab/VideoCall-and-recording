const { v1: uuidv1 } = require('uuid');

module.exports = class roomSession {

    constructor() {
        // session uniq id
        this.sessionId = uuidv1();
        // short room id
        this.shortCode = 
        // session router Process Id
        this.process = undefined;
        // session router
        this.router = undefined;
        // session peers
        this.peers = [];
        // session state
        this.session_state = "initiated";
    }

    setState(state) {
        this.session_state = state
    }

    getPeers() {
        return this.peers
    }

    addPeer(peer) {
        this.peers.push(peer)
    }

    getPeer(peerId) {
        return this.peers.find((peer => peer.peerId === peerId))
    }

    removePeer(peerId) {
        this.peers.splice(this.peers.findIndex(function(peer){
            return peer.peerId === peerId;
        }), 1);
    }

    getProducer(id) {
        this.peers.forEach(peer => {
            const producer = peer.getProducer(id)
            if (!producer) {
                continue
            } else {
                return producer
            }
        })
    }

    getProducers() {
        let producers = [];
        this.peers.forEach(peer => {
            producers = [...producers, ...peer.getProducers() ]
        })
        return producers;
    }

    getConsumers() {
        let consumers = [];
        this.peers.forEach(peer => {
            consumers = [...consumers, peer.getConsumers()]
        })
        return consumers
    }

    getTransports() {
        let transports = [];
        this.peers.forEach(peer => {
            transports = [...transports, ...peer.getTransports() ]
        })
        return transports;
    }

}