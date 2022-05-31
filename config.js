const os = require('os');

module.exports = {
  // Listening hostname (just for `gulp live` task).
  domain: process.env.DOMAIN || 'localhost',
  // Signaling settings (protoo WebSocket server and HTTP API server).
  api:
  {
    listenIp: '0.0.0.0',
    // NOTE: Don't change listenPort (client app assumes 4443).
    listenPort: process.env.PROTOO_LISTEN_PORT || 4443,
    // NOTE: Set your own valid certificate files.
    // does not make any effect, since this server does not provide https connection.
    // we're assuming to provide https url, need to use 3rd party proxy server, such as
    // nginx
    tls:
    {
      cert : process.env.HTTPS_CERT_FULLCHAIN || `${__dirname}/certs/fullchain.pem`,
      key  : process.env.HTTPS_CERT_PRIVKEY || `${__dirname}/certs/privkey.pem`
    },
    secretPhrase: process.env.SECRET_PHRASE || 'SECRET',
  },
  // mediasoup settings.
  mediasoup: {
    // Number of mediasoup workers to launch.
    numWorkers: Object.keys(os.cpus()).length,
    // mediasoup WorkerSettings.
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
    workerSettings: {
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        'rtx',
        'bwe',
        'score',
        'simulcast',
        'svc',
        'sctp'
      ],
      rtcMinPort: process.env.MEDIASOUP_MIN_PORT ? Math.trunc( process.env.MEDIASOUP_MIN_PORT ) : 40000,
      rtcMaxPort: process.env.MEDIASOUP_MAX_PORT ? Math.trunc( process.env.MEDIASOUP_MAX_PORT ) : 49999
    },
    // mediasoup Router options.
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
    routerOptions:
    {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate' : 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
          }
        }
      ]
    },
    // mediasoup WebRtcTransport options for WebRTC endpoints (mediasoup-client,
    // libmediasoupclient).
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
    webRtcTransportOptions: {
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
          announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
        }
      ],
      initialAvailableOutgoingBitrate : 4_000_000,
      minimumAvailableOutgoingBitrate : 600_000,
      maxSctpMessageSize              : 262_144,
      // Additional options that are not part of WebRtcTransportOptions.
      maxIncomingBitrate              : 4_500_000
    },
    // comma separated ice servers url
    iceServers: [
      {
        urls: process.env.ICE_SERVERS ? process.env.ICE_SERVERS.split(','): 'turns:studio-turn.m-pipe.net:443?transport=tcp,turn:studio-turn.m-pipe.net:80?transport=udp,turn:studio-turn.m-pipe.net:80?transport=tcp'.split(','),
        username: 'guest',
        credential: 'somepassword'
      }
    ],
    // `all` or `relay`
    iceTransportPolicy: process.env.ICE_TRANSPORT_POLICY || 'all',
    // mediasoup PlainTransport options for legacy RTP endpoints (FFmpeg,
    // GStreamer).
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#PlainTransportOptions
    plainTransportOptions: {
      listenIp: {
        ip          : process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
        announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
      },
      maxSctpMessageSize : 262_144
    }
  },
  studio: {
    width: process.env.STUDIO_WIDTH ? Math.trunc( process.env.STUDIO_WIDTH ) : 1920,
    height: process.env.STUDIO_HEIGHT ? Math.trunc( process.env.STUDIO_HEIGHT ) : 1080,
    useMixer: false, // does not make any effect. for future use, maybe.
    rtmpUrl: process.env.STUDIO_RTMP_URL || 'rtmp://localhost/live/test' // does not make any effect. for future use, maybe.
  }
};