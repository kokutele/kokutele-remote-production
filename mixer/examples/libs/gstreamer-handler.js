const gstreamer = require('gstreamer-superficial')

/**
 * 
 * @param {object} obj 
 * @param {number} obj.video_rtp_port
 * @param {number} obj.video_rtcp_port
 * @param {number} obj.audio_rtp_port
 * @param {number} obj.audio_rtcp_port
 * @param {number} obj.pattern
 * @param {number} obj.freq
 * @returns 
 */
const startRtpPipeline = ( obj ) => {
  const {
    host,
    video_send_rtp_port,
    video_send_rtcp_port,
    video_recv_rtcp_port,
    audio_send_rtp_port,
    audio_send_rtcp_port,
    audio_recv_rtcp_port,
    pattern,
    freq,
  } = obj

  const elements = [
    'rtpbin name=rtpbin',
    `videotestsrc pattern=${pattern} ! video/x-raw,width=320,height=240 ! videoconvert ! vp8enc keyframe-max-dist=30 ! rtpvp8pay ! rtpbin.send_rtp_sink_0`,
    `  rtpbin.send_rtp_src_0 !  udpsink host=${host} port=${video_send_rtp_port}`,
    `  rtpbin.send_rtcp_src_0 ! udpsink host=${host} port=${video_send_rtcp_port} sync=false async=false`,
    `  udpsrc port=${video_recv_rtcp_port} ! rtpbin.recv_rtcp_sink_0`,
    `audiotestsrc freq=${freq} ! audioconvert ! opusenc ! rtpopuspay ! rtpbin.send_rtp_sink_1`,
    `  rtpbin.send_rtp_src_1 !  udpsink host=${host} port=${audio_send_rtp_port}`,
    `  rtpbin.send_rtcp_src_1 ! udpsink host=${host} port=${audio_send_rtcp_port} sync=false async=false`,
    `  udpsrc port=${audio_recv_rtcp_port} ! rtpbin.recv_rtcp_sink_1`,
  ].join("\n")
  
  const pipeline = new gstreamer.Pipeline( elements )
  console.log( elements )
  pipeline.play()

  return pipeline
}

const stopPipeline = pipeline => {
  pipeline.stop()
}

module.exports = {
  startRtpPipeline, stopPipeline
}