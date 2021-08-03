
const { v1: uuidv1 } = require('uuid');

module.exports = class Peer {
    constructor() {
        this.peerId = uuidv1();
        // list of peers transports (send and recv)
        this.transports = [];
        // list of peer producers 
        this.producers = [];
        // list of peer consumers
        this.consumers = [];
        // rtpConsumer for recorder
        this.rtpConsumers = [];
        // Ports for recorder
        this.remotePorts = [];
        // recording process 
        this.process = undefined;
        // peer websocket
        this.socket = undefined;
        // peer internal state 
        this.state = "consuming"
    }

    /**
     * add receive or send transport
     * @param {object} transport 
     */
    addTransport(transport) {
        this.transports.push(transport);
    }

    /**
     * get receive or send transport 
     * @param {string} transportId 
     * @returns {object}
     */
    getTransport(transportId) {
        return this.transports.find((transport => transport.id === transportId));
    }

    /**
     * add video or audio producer
     * @param {object} producer 
     */
    addProducer(producer) {
        this.producers.push(producer)
    }

    /**
     * get producer by id
     * @param {string} producerId 
     * @returns {object}
     */
    getProducer(producerId) {
        return this.producers.find((producer => producer.id === producerId));
    }

    /**
     * get producer by kind (video or audio)
     * @param {string} kind 
     * @returns {object}
     */
    getProducersByKind(kind) {
        return this.producers.filter((producer => producer.kind === kind));
    }

    /**
     * get all producers
     * @returns {Array}
     */
    getProducers() {
        return this.producers;
    }

    /**
     * add consumer
     * @param {string} peerId 
     */
    addConsumer(consumer) {
        this.consumers.push(consumer);
    }

    /**
     * get consumer by id
     * @param {string} consumerId 
     * @returns 
     */
    getConsumer(consumerId) {
        return this.consumers.find((consumer => consumer.id === consumerId));
    }

    /**
     * get all consumer
     * @returns {Array}}
     */
    getConsumers() {
        return this.consumers;
    }
}