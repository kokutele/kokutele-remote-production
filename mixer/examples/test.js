const MediaMixer = require("../")
const { startRtpPipeline, stopPipeline } = require("./libs/gstreamer-handler")

const mediaMixer = new MediaMixer( 640, 480, "rtmp://localhost/live/test" )
console.log('initialized.')
mediaMixer.start()

console.log('video will stop in 10 seconds...')

const sleep = timeout => {
  return new Promise( ( resolve, _ ) => {
    setTimeout( resolve, timeout )
  })
}
let timer;

const start = async () => {
  await sleep( 1000 )
  
  const pipeline = startRtpPipeline({
    host: '127.0.0.1',
    video_send_rtp_port : 5000,
    video_send_rtcp_port: 5001,
    video_recv_rtcp_port: 5002,
    audio_send_rtp_port : 5003,
    audio_send_rtcp_port: 5004,
    audio_recv_rtcp_port: 5005,
    pattern: 0,
    freq: 500
  })

  {
    const names = mediaMixer.addRtpSrc( '127.0.0.1', 5000, 5001, 5002, 5003, 5004, 5005, 300, 200, 320, 240, 2 );
    if( names ) {
      console.log( `addRtpSrc - ${names.video_channel}, ${names.audio_channel}` )
    } else {
      console.warn( 'addRtpSrc failed.')
    }
    await sleep( 500 )
    for( let c = 0; c < 500; c += 1 ) {
      const xpos = Math.floor( 200 + Math.sin( Math.PI * c * 0.05 ) * 30 );
      mediaMixer.changePosition( names.video_channel, xpos, 200, 320, 240 );
      await sleep( 30 );
    }
  }

  await sleep( 1000 )

  {
    const pattern = 18 // ball
    const name = mediaMixer.addTestVideoSrc( 18, 1, 1, 320, 240, 3 )
    console.log( `addTestVideoSrc - ${name}`)

    for( let c = 0; c < 500; c += 1 ) {
      const ypos = Math.floor( 100 + Math.sin( Math.PI * c * 0.05 ) * 30 )
      mediaMixer.changePosition( name, 100, ypos, 320, 240 )
      await sleep( 30 )
    }
    await sleep( 3000 )

    mediaMixer.releaseVideoSrc( name )
  }

  {
    const freq = 750.0
    const name = mediaMixer.addTestAudioSrc( freq )
    console.log( `addTestAudioSrc - ${name}`)

    await sleep( 3000 )
    mediaMixer.releaseAudioSrc( name )
  }

  mediaMixer.terminate()
  stopPipeline( pipeline )
}

start()