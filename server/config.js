const os = require('os');

const PUBLIC_ADDR = process.env.PUBLIC_ADDR || 'localhost';

module.exports = Object.freeze({
    numWorkers: Object.keys(os.cpus()).length,
    worker: {
        logLevel: 'debug',
        logTags: [
            'rtp',
            'srtp',
            'rtcp',
			'sctp',
            'dtls',
            'ice'
        ],
        rtcMinPort: 50000,
        rtcMaxPort: 59999
    },
    router: {
        mediaCodecs: [
            {
                kind      : 'audio',
                mimeType  : 'audio/opus',
                clockRate : 48000,
                channels  : 2
            },
            {
                kind       : 'video',
                mimeType   : 'video/VP8',
                clockRate  : 90000,
                parameters :
                {
                    'x-google-start-bitrate' : 1000
                }
            },
            {
                kind       : 'video',
                mimeType   : 'video/VP9',
                clockRate  : 90000,
                parameters :
                {
                    'profile-id'             : 2,
                    'x-google-start-bitrate' : 1000
                }
            },
            /* {
                kind       : 'video',
                mimeType   : 'video/h264',
                clockRate  : 90000,
                parameters :
                {
                    'packetization-mode'      : 1,
                    'profile-level-id'        : '4d0032',
                    'level-asymmetry-allowed' : 1,
                    'x-google-start-bitrate'  : 1000
                }
            }, */
            {
                kind       : 'video',
                mimeType   : 'video/h264',
                clockRate  : 90000,
                parameters :
                {
                    'packetization-mode'      : 1,
                    'profile-level-id'        : '42e01f',
                    'level-asymmetry-allowed' : 1,
                    'x-google-start-bitrate'  : 1000
                }
            }
        ]
    },
    webRtcTransport: {
        listenIps                       : [{ ip: '0.0.0.0', announcedIp: PUBLIC_ADDR }], 
        enableUdp                       : true,
        enableTcp                       : true,
        preferUdp                       : true,
        enableSctp                      : true,
        maxSctpMessageSize              : 262144,
        maxIncomingBitrate: 1500000
    },
    
    plainRtpTransport: {
        listenIp: { ip: '0.0.0.0', announcedIp: PUBLIC_ADDR },
        rtcpMux: true,
        comedia: false
    }
});