#include<stdio.h>
#include<string.h>
#include<string>
#include<regex>
#include<iostream>
#include "mixer.h"

using namespace std;

static gchar* add_intervideosrc( Mixer *mixer, int idx );
static gchar* add_interaudiosrc( Mixer *mixer, int idx );
static gboolean handleBusMessage( GstBus *bus, GstMessage *message, gpointer *data );
static void pad_added_handler( GstElement *src, GstPad *new_pad, RtpSource *names );
static void release_pad( GstPad *pad, GstElement *element );
static void release_rtp_source( RtpSource *rtp_source, void *data );
static void release_channel( Channel *channel, GstElement *element );
static gint get_unused_channel( Channel *channel, void *data );
static int find_channel_by_name( Channel *channel, char *name );

Mixer *mixer_init( gint width, gint height, gchar *url ) {
  GstElement *pipeline;
  Mixer *mixer = (Mixer *)g_malloc( sizeof( Mixer ) );
  memset( mixer, '\0', sizeof( Mixer ));

  gchar *_url = ( gchar * )g_malloc( 256 );
  strcpy( _url, url );

  // mixer->compositor_pads = NULL;
  // mixer->audiomixer_pads = NULL;
  // mixer->intervideo_names = NULL;
  // mixer->interaudio_names = NULL;
  // mixer->srcaudio_pipelines = NULL;
  // mixer->srcvideo_pipelines = NULL;
  // mixer->buses = NULL;

  gst_init( NULL, NULL );

  pipeline = gst_pipeline_new( "mixer_pipeline" );
  if( !pipeline ) {
    g_printerr("pipeline could not be created.\n");
    return NULL;
  }

  mixer->width = width;
  mixer->height = height;
  mixer->url = _url;
  mixer->mixer_pipeline = pipeline;

  return mixer;
}

Channel *channel_new() {
  Channel *channel = (Channel *)g_malloc( sizeof( Channel ) );
  memset( channel, '\0', sizeof( Channel ));

  return channel;
}

int mixer_set_rtmp( Mixer *mixer ) {
  GstElement *pipeline;

  string script = 
    "videotestsrc pattern=0 is-live=true ! video/x-raw,width=WIDTH,height=HEIGHT ! \n"
    "  compositor name=comp\n"
    "  sink_0::xpos=0 sink_0::ypos=0 sink_0::width=WIDTH sink_0::height=HEIGHT sink_0::zorder=0\n"
    "  sink_1::xpos=0 sink_1::ypos=0 sink_1::width=WIDTH sink_1::height=HEIGHT sink_1::zorder=1 ! \n"
    "  clockoverlay ! \n"
    "  x264enc key-int-max=60 bframes=0 bitrate=4000 speed-preset=ultrafast tune=zerolatency ! \n"
    "  flvmux name=mux ! \n"
    "  rtmpsink location='RTMP_URL live=1' \n"
    "audiomixer name=mix ! audioconvert ! audioresample ! audio/x-raw,rate=44100 ! voaacenc bitrate=64000 ! \n"
    "  mux. \n"
    "audiotestsrc volume=0 is-live=true ! mix. \n"
    "interaudiosrc channel=mixed-audio ! queue ! mix. \n"
    "intervideosrc channel=mixed-video ! videoconvert ! queue ! comp. \n";
    //"  queue max-size-buffers=0 max-size-time=0 max-size-bytes=0 min-threshold-time=200000000 ! \n"
  
  script = regex_replace( script, regex("WIDTH"), to_string( mixer->width ) );
  script = regex_replace( script, regex("HEIGHT"), to_string( mixer->height ) );
  script = regex_replace( script, regex("RTMP_URL"), mixer->url );
  
  cout << script << endl;

  pipeline = gst_parse_launch( script.c_str(), NULL );
  gst_element_set_state( pipeline, GST_STATE_PLAYING );

  mixer->rtmp_pipeline = pipeline;

  return 0;
}

int mixer_set_compositor( Mixer *mixer ) {
  GstElement *compositor, *convert, *sink;
  GstElement *source, *filter, *queue;
  GstCaps *caps;
  GstPad *comp_pad, *queue_pad;
  gint i;

  compositor = gst_element_factory_make( "compositor", NULL );
  convert    = gst_element_factory_make( "videoconvert", NULL );
  sink       = gst_element_factory_make( "intervideosink", NULL );

  source     = gst_element_factory_make( "videotestsrc", NULL );
  filter     = gst_element_factory_make( "capsfilter", NULL );
  queue      = gst_element_factory_make( "queue", NULL );

  if( !compositor || !convert || !sink ||
    !source || !filter || !queue
  ) {
    g_error("Not all elements could be created.\n");
    return -1;
  }

  gst_bin_add_many( GST_BIN( mixer->mixer_pipeline ), compositor, convert, sink, 
    source, filter, queue, NULL );
  if( gst_element_link_many( compositor, convert, sink, NULL ) != TRUE ||
      gst_element_link_many( source, filter, queue, NULL ) != TRUE
  ) {
    g_error("Elements could not be linked.\n");
    return -1;
  }

  // g_object_set( source, "pattern", 2, "is-live", TRUE, NULL );
  g_object_set( source, "pattern", 0, "is-live", TRUE, NULL );

  caps = gst_caps_new_simple( "video/x-raw", 
    "width", G_TYPE_INT, mixer->width, 
    "height", G_TYPE_INT, mixer->height,
    NULL
  );
  g_object_set( filter, "caps", caps, NULL );

  comp_pad = gst_element_request_pad_simple( compositor, "sink_%u" );
  queue_pad = gst_element_get_static_pad( queue, "src" );

  if( !comp_pad || !queue_pad ) {
    g_printerr("Not all pad could be created.\n");
    return -1;
  }

  g_object_set( comp_pad, "xpos", 0, "ypos", 0, "width", mixer->width, "height", mixer->height, "zorder", 1, NULL );
  if( gst_pad_link( queue_pad, comp_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Pad could not be linked.\n");
    return -1;
  }

  g_object_set( sink, "channel", "mixed-video", "async", false, "sync", false, NULL );

  mixer->compositor = compositor;
  mixer->compositor_pad = comp_pad;

  g_object_unref( queue_pad );

  for( i = 0; i < 8; i++ ) {
    add_intervideosrc( mixer, i );
  }

  return 0;
}

static gchar* add_intervideosrc( Mixer *mixer, int idx ) {
  Channel *channel;
  GstElement *src, *queue;
  GstPad *comp_pad, *queue_pad;
  gchar *name;
  
  channel = channel_new();
  name = (gchar *)g_malloc( 16 );
  sprintf( name, "vchannel_%u", idx);

  src = gst_element_factory_make( "intervideosrc", NULL );
  g_object_set( src, "channel", name, NULL );
  queue = gst_element_factory_make( "queue", NULL );

  if( !src || !queue ) {
    g_printerr("Not all elemnets could be created.\n");
    return NULL;
  }

  gst_bin_add_many( GST_BIN( mixer->mixer_pipeline ), src, queue, NULL );
  if( gst_element_link_many( src, queue, NULL ) != TRUE ) {
    g_printerr("Elements could not be linked.\n");
    return NULL;
  }

  comp_pad = gst_element_request_pad_simple( mixer->compositor, "sink_%u" );
  queue_pad = gst_element_get_static_pad( queue, "src" );
  if( gst_pad_link( queue_pad, comp_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Pads could not be linked.\n");
    return NULL;
  }

  g_object_set( comp_pad, "zorder", 0, NULL );


  channel->name = name;
  channel->mixer_pad = comp_pad;

  mixer->videochannels = g_list_append( mixer->videochannels, channel );

  g_object_unref( queue_pad );

  return name;
}

int mixer_set_audiomixer( Mixer *mixer ) {
  GstElement *audiomixer, *sink;
  GstElement *source, *resample, *filter, *queue;
  GstPad *mixer_pad, *queue_pad;
  GstCaps *caps;
  gint i;
 
  audiomixer = gst_element_factory_make( "audiomixer", NULL );
  sink = gst_element_factory_make( "interaudiosink", NULL );
 
  source = gst_element_factory_make( "audiotestsrc", NULL );
  resample = gst_element_factory_make( "audioresample", NULL );
  filter = gst_element_factory_make( "capsfilter", NULL );
  queue = gst_element_factory_make( "queue", NULL );
 
  if( !audiomixer || !sink || !source || !resample || !filter || !queue ) {
    g_printerr("Not all elements could be created.\n");
    return -1;
  }
 
  gst_bin_add_many( GST_BIN( mixer->mixer_pipeline), audiomixer, sink, source, resample, filter, queue, NULL );
  if( gst_element_link_many( audiomixer, sink, NULL ) != TRUE ||
    gst_element_link_many( source, filter, queue, NULL ) != TRUE
  ) {
    g_printerr("Elements could not be linked.\n");
    return -1;
  }

  g_object_set( source, "volume", 0, NULL );

  caps = gst_caps_new_simple( "audio/x-raw",
    "rate", G_TYPE_INT, 44100, 
    "channels", G_TYPE_INT, 1,
    NULL
  );
  g_object_set( filter, "caps", caps, NULL );
 
  mixer_pad = gst_element_request_pad_simple( audiomixer, "sink_%u" );
  queue_pad = gst_element_get_static_pad( queue, "src" );
 
  if( !mixer_pad || !queue_pad ) {
    g_printerr("Not all pads could be created.\n");
    return -1;
  }
 
  if( gst_pad_link( queue_pad, mixer_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Pads could not be created.\n");
    return -1;
  }

  g_object_set( sink, "channel", "mixed-audio", "async", false, "sync", false, NULL );
 
  mixer->audiomixer = audiomixer;
  mixer->audiomixer_pad = mixer_pad;

  for( i = 0; i < 8; i++ ) {
    add_interaudiosrc( mixer, i );
  }
 
  g_object_unref( queue_pad );
 
  return 0;
}

static gchar* add_interaudiosrc( Mixer *mixer, int idx ) {
  Channel *channel;
  GstElement *src, *resample, *filter, *queue;
  GstPad *mixer_pad, *queue_pad;
  GstCaps *caps;
  gchar *name;
  
  channel = channel_new();
  name = (gchar *)g_malloc( 16 );
  sprintf( name, "achannel_%u", idx);

  src = gst_element_factory_make( "interaudiosrc", NULL );
  resample = gst_element_factory_make( "audioresample", NULL );
  filter = gst_element_factory_make( "capsfilter", NULL );
  queue = gst_element_factory_make( "queue", NULL );

  if( !src || !resample || !filter || !queue ) {
    g_printerr("Not all elemnets could be created.\n");
    return NULL;
  }

  g_object_set( src, "channel", name, NULL );

  caps = gst_caps_new_simple( "audio/x-raw",
    "rate", G_TYPE_INT, 44100,
    "chanels", G_TYPE_INT, 1,
    NULL 
  );
  g_object_set( filter, "caps", caps, NULL );

  gst_bin_add_many( GST_BIN( mixer->mixer_pipeline ), src, resample, filter, queue, NULL );
  if( gst_element_link_many( src, resample, filter, queue, NULL ) != TRUE ) {
    g_printerr("Elements could not be linked.\n");
    return NULL;
  }

  mixer_pad = gst_element_request_pad_simple( mixer->audiomixer, "sink_%u" );
  queue_pad = gst_element_get_static_pad( queue, "src" );
  if( gst_pad_link( queue_pad, mixer_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Pads could not be linked.\n");
    return NULL;
  }

  g_object_set( mixer_pad, "mute", TRUE, NULL );

  channel->name = name;
  channel->mixer_pad = mixer_pad;

  mixer->audiochannels = g_list_append( mixer->audiochannels, channel );

  g_object_unref( queue_pad );

  return name;
}



static gboolean handleBusMessage( GstBus *bus, GstMessage *message, gpointer *data ) {
  if( message != NULL ) {
    GError *err;
    gchar *debug_info;

    switch( GST_MESSAGE_TYPE( message )) {
      case GST_MESSAGE_ERROR:
        gst_message_parse_error( message, &err, &debug_info );
        g_printerr("Error received from element %s: %s\n", GST_OBJECT_NAME( message->src ), err->message );
        g_printerr("Dubugging information: %s\n", debug_info ? debug_info : "none");
        g_clear_error( &err );
        g_free( debug_info );
        break;
      default:
        break;
    }
  }
  return TRUE;
}

static gint get_unused_channel( Channel *channel, void *data ) {
  if( channel->pipeline == NULL ) {
    return 0;
  } else {
    return -1;
  }
}

char* mixer_add_videotestsrc( Mixer *mixer, int pattern, int xpos, int ypos, int width, int height, int zorder ) {
  GstElement *src, *filter, *convert, *sink;
  GstCaps *caps;
  GstStateChangeReturn ret;
  GList *list;
  Channel *channel;

  list = g_list_find_custom( mixer->videochannels, NULL, (GCompareFunc)get_unused_channel );
  if( list == NULL ) {
    g_printerr("Could not find unused channel.\n");
    return NULL;
  }
  channel = (Channel *)list->data;

  channel->pipeline = gst_pipeline_new( NULL );
  if( !channel->pipeline ) {
    g_printerr("Pipeline could not be created.\n");
    return NULL;
  }

  src = gst_element_factory_make( "videotestsrc", NULL );
  filter = gst_element_factory_make( "capsfilter", NULL );
  convert = gst_element_factory_make( "videoconvert", NULL );
  sink = gst_element_factory_make( "intervideosink", NULL );

  if( !src || !filter || !convert || !sink ) {
    g_printerr("Not all elements could be created.\n");
    return NULL;
  }

  g_object_set( src, "pattern", pattern, "is-live", TRUE, NULL );
  g_object_set( sink, "channel", channel->name, NULL );

  gst_bin_add_many( GST_BIN( channel->pipeline ), src, filter, convert, sink, NULL );
  if( gst_element_link_many( src, filter, convert, sink, NULL ) != TRUE ) {
    g_printerr("Elements could not be linked.\n");
    return NULL;
  }

  caps = gst_caps_new_simple(
    "video/x-raw",
    "width", G_TYPE_INT, width,
    "height", G_TYPE_INT, height,
    NULL
  );

  g_object_set( filter, "caps", caps, NULL );

  ret = gst_element_set_state( channel->pipeline, GST_STATE_PLAYING );

  if( ret == GST_STATE_CHANGE_FAILURE ) {
    g_printerr("Unable to set the pipeline to the playing state.\n");
  }

  channel->bus = gst_element_get_bus( channel->pipeline );

  gst_bus_add_watch( channel->bus, (GstBusFunc)handleBusMessage, channel->name );

  g_object_set( channel->mixer_pad, "xpos", xpos, "ypos", ypos, "width", width, "height", height, "zorder", zorder, NULL );

  return channel->name;
}

char *mixer_add_audiotestsrc( Mixer *mixer, double freq ) {
  GstElement *source, *resample, *filter, *sink;
  GstCaps *caps;
  GstStateChangeReturn ret;
  GList *list;
  Channel *channel;

  list = g_list_find_custom( mixer->audiochannels, NULL, (GCompareFunc)get_unused_channel );
  if( list == NULL ) {
    g_printerr("Could not found unused channel.\n");
    return NULL;
  }
  channel = (Channel *)list->data;

  channel->pipeline = gst_pipeline_new( NULL );
  source = gst_element_factory_make( "audiotestsrc", NULL );
  resample = gst_element_factory_make( "audioresample", NULL );
  filter = gst_element_factory_make( "capsfilter", NULL );
  sink = gst_element_factory_make( "interaudiosink", NULL );

  if( !source || !resample || !filter || !sink ) {
    g_printerr("Not all elements could be created.\n");
    return NULL;
  }

  gst_bin_add_many( GST_BIN( channel->pipeline ), source, resample, filter, sink, NULL );
  if( gst_element_link_many( source, resample, filter, sink, NULL ) != TRUE ) {
    g_printerr("Elements could not be linked.\n");
    return NULL;
  }

  caps = gst_caps_new_simple( "audio/x-raw",
    "rate", G_TYPE_INT, 44100,
    "channels", G_TYPE_INT, 1,
    NULL
  );

  g_object_set( source, "freq", freq, NULL );
  g_object_set( filter, "caps", caps, NULL );

  g_object_set( sink, "channel", channel->name, NULL );

  ret = gst_element_set_state( channel->pipeline, GST_STATE_PLAYING );
  if( ret == GST_STATE_CHANGE_FAILURE ) {
    g_printerr("Could not set pipeline state to playing.\n");
    return NULL;
  }
  channel->bus = gst_element_get_bus( channel->pipeline );

  gst_bus_add_watch( channel->bus, (GstBusFunc)handleBusMessage, channel->name );

  g_object_set( channel->mixer_pad, "mute", FALSE, NULL );

  return channel->name;
}

RtpSource *mixer_add_rtpsrc(
  Mixer *mixer,
  int video_rtp_port, int video_rtcp_port,
  int audio_rtp_port, int audio_rtcp_port,
  int xpos, int ypos, int width, int height, int zorder
) {
  GstElement *pipeline;
  GstElement *rtpbin;
  GstElement *udpsrc0; //, *rtpvp8depay, *vp8dec, *intervideosink;
  GstElement *udpsrc1;
  GstElement *udpsrc2; //, *rtpopusdepay, *opusdec, *interaudiosink;
  GstElement *udpsrc3;
  GstCaps *audiocaps, *videocaps;
  GList *list;
  Channel *audio_channel, *video_channel;
  RtpSource *rtp_source;

  list = g_list_find_custom( mixer->videochannels, NULL, (GCompareFunc)get_unused_channel );
  video_channel = (Channel *)list->data;

  list = g_list_find_custom( mixer->audiochannels, NULL, (GCompareFunc)get_unused_channel );
  audio_channel = (Channel *)list->data;

  pipeline = gst_pipeline_new( NULL );
  rtpbin = gst_element_factory_make( "rtpbin", NULL );
  udpsrc0 = gst_element_factory_make( "udpsrc", NULL );
  udpsrc1 = gst_element_factory_make( "udpsrc", NULL );
  udpsrc2 = gst_element_factory_make( "udpsrc", NULL );
  udpsrc3 = gst_element_factory_make( "udpsrc", NULL); 

  if( !pipeline || !rtpbin || !udpsrc0 || !udpsrc1 || !udpsrc2 || !udpsrc3 ) {
    g_printerr("Not all elements could be created.\n");
    return NULL;
  }
  rtp_source = (RtpSource *)g_malloc( sizeof( RtpSource ));
  memset( rtp_source, '\0', sizeof( RtpSource ));
  rtp_source->pipeline = pipeline;
  rtp_source->rtpbin = rtpbin;
  rtp_source->video_channel = video_channel;
  rtp_source->audio_channel = audio_channel;
  rtp_source->xpos = xpos;
  rtp_source->ypos = ypos;
  rtp_source->width = width;
  rtp_source->height = height;
  rtp_source->zorder = zorder;

  mixer->rtp_sources = g_list_append( mixer->rtp_sources, rtp_source );
  gst_bin_add_many( GST_BIN( pipeline ), udpsrc0, rtpbin, udpsrc1, udpsrc2, udpsrc3, NULL );

  videocaps = gst_caps_new_simple( "application/x-rtp",
    "media", G_TYPE_STRING, "video",
    "clock-rate", G_TYPE_INT, 90000,
    "encoding-name", G_TYPE_STRING, "VP8",
    NULL
  );

  audiocaps = gst_caps_new_simple( "application/x-rtp",
    "media", G_TYPE_STRING, "audio",
    "clock-rate", G_TYPE_INT, 48000,
    "encoding-name", G_TYPE_STRING, "X-GST-OPUS-DRAFT-SPITTKA-00",
    NULL
  );

  g_object_set( udpsrc0, "port", video_rtp_port, "caps", videocaps, NULL );
  g_object_set( udpsrc1, "port", video_rtcp_port, NULL );
  g_object_set( udpsrc2, "port", audio_rtp_port, "caps", audiocaps, NULL );
  g_object_set( udpsrc3, "port", audio_rtcp_port, NULL );

  GstPad *udpsrc0_src_pad = gst_element_get_static_pad( udpsrc0, "src" );
  GstPad *rtpbin_video_recv_rtp_sink_pad = gst_element_request_pad_simple( rtpbin, "recv_rtp_sink_%u");
  if( gst_pad_link( udpsrc0_src_pad, rtpbin_video_recv_rtp_sink_pad ) != GST_PAD_LINK_OK ){
    g_printerr("Cound not link pads for video rtp - udpsrc0_src_pad & rtpbin_recv_rtp_pad.\n");
    return NULL;
  }
  rtp_source->rtpbin_pads = g_list_append( rtp_source->rtpbin_pads, (gpointer) rtpbin_video_recv_rtp_sink_pad );

  GstPad *udpsrc1_src_pad = gst_element_get_static_pad( udpsrc1, "src");
  GstPad *rtpbin_video_recv_rtcp_sink_pad = gst_element_request_pad_simple( rtpbin, "recv_rtcp_sink_%u" );
  if( gst_pad_link( udpsrc1_src_pad, rtpbin_video_recv_rtcp_sink_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Could not link pads for video rtcp - udpsrc1_src_pad & rtpbin_recv_rtcp_pad.\n");
    return NULL;
  }
  rtp_source->rtpbin_pads = g_list_append( rtp_source->rtpbin_pads, (gpointer) rtpbin_video_recv_rtcp_sink_pad );

  GstPad *udpsrc2_src_pad = gst_element_get_static_pad( udpsrc2, "src");
  GstPad *rtpbin_audio_recv_rtp_sink_pad = gst_element_request_pad_simple( rtpbin, "recv_rtp_sink_%u" );
  if( gst_pad_link( udpsrc2_src_pad, rtpbin_audio_recv_rtp_sink_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Could not link pads for audio rtp - udpsrc2_src_pad & rtpbin_audio_recv_rtp_sink_pad.\n");
    return NULL;
  }
  rtp_source->rtpbin_pads = g_list_append( rtp_source->rtpbin_pads, (gpointer) rtpbin_audio_recv_rtp_sink_pad );

  GstPad *udpsrc3_src_pad = gst_element_get_static_pad( udpsrc3, "src");
  GstPad *rtpbin_audio_recv_rtcp_sink_pad = gst_element_request_pad_simple( rtpbin, "recv_rtcp_sink_%u");
  if( gst_pad_link( udpsrc3_src_pad, rtpbin_audio_recv_rtcp_sink_pad ) != GST_PAD_LINK_OK ) {
    g_printerr("Could not link pads for audio rtcp - udpsrc3_src_pad & rtpbin_audio_recv_rtcp_sink_pad.\n");
    return NULL;
  }
  rtp_source->rtpbin_pads = g_list_append( rtp_source->rtpbin_pads, (gpointer) rtpbin_audio_recv_rtcp_sink_pad );

  gst_object_unref( udpsrc0_src_pad );
  gst_object_unref( udpsrc1_src_pad );
  gst_object_unref( udpsrc2_src_pad );
  gst_object_unref( udpsrc3_src_pad );

  g_signal_connect( rtpbin, "pad-added", G_CALLBACK( pad_added_handler ), rtp_source );

  GstStateChangeReturn ret = gst_element_set_state( pipeline, GST_STATE_PLAYING );
  if( ret == GST_STATE_CHANGE_FAILURE ) {
    g_printerr("Unable to set the pipeline to the playing state.\n");
  }

  video_channel->pipeline = pipeline;
  audio_channel->pipeline = pipeline;

  return rtp_source;
}

static void pad_added_handler( GstElement *src, GstPad *new_pad, RtpSource *rtp_source ) {
  GstCaps *caps = gst_pad_get_current_caps( new_pad );
  gchar *caps_str = gst_caps_to_string( caps );

  if( strstr( caps_str, "X-GST-OPUS-DRAFT-SPITTKA-00") ) {
    GstElement *rtpopusdepay, *opusdec, *interaudiosink;

    rtpopusdepay = gst_element_factory_make("rtpopusdepay", NULL );
    opusdec = gst_element_factory_make("opusdec", NULL );
    interaudiosink = gst_element_factory_make("interaudiosink", NULL );

    gst_bin_add_many( GST_BIN( rtp_source->pipeline ), rtpopusdepay, opusdec, interaudiosink, NULL );
    g_object_set( interaudiosink, "channel", rtp_source->audio_channel->name, NULL );

    if( gst_element_link_many( rtpopusdepay, opusdec, interaudiosink, NULL ) != TRUE ) {
      g_printerr("Not all elements could be linked.\n");
      return;
    }

    GstPad *sink_pad = gst_element_get_static_pad( rtpopusdepay, "sink" );
    if( gst_pad_link( new_pad, sink_pad ) != GST_PAD_LINK_OK ) {
      g_printerr("could not link pad for opus decoder.\n");
      gst_object_unref( sink_pad );
      return;
    }

    g_object_set( rtp_source->audio_channel->mixer_pad, "mute", FALSE, NULL );
    gst_element_set_state( rtp_source->pipeline, GST_STATE_PLAYING );

    gst_object_unref( sink_pad );
  } else if( strstr( caps_str, "VP8" ) ) {
    GstElement *rtpvp8depay, *vp8dec, *intervideosink;

    rtpvp8depay = gst_element_factory_make("rtpvp8depay", NULL );
    vp8dec = gst_element_factory_make("vp8dec", NULL );
    intervideosink = gst_element_factory_make("intervideosink", NULL );

    gst_bin_add_many( GST_BIN( rtp_source->pipeline ), rtpvp8depay, vp8dec, intervideosink, NULL );
    g_object_set( intervideosink, "channel", rtp_source->video_channel->name, NULL );


    if( gst_element_link_many( rtpvp8depay, vp8dec, intervideosink, NULL ) != TRUE ) {
      g_printerr("Not all elements could be linked.\n");
      return;
    }

    GstPad *sink_pad = gst_element_get_static_pad( rtpvp8depay, "sink" );
    if( gst_pad_link( new_pad, sink_pad ) != GST_PAD_LINK_OK ) {
      g_printerr("could not link pad for vp8 decoder.\n");
      gst_object_unref( sink_pad );
      return;
    }

    g_object_set( rtp_source->video_channel->mixer_pad,
      "xpos", rtp_source->xpos, "ypos", rtp_source->ypos,
      "width", rtp_source->width, "height", rtp_source->height,
      "zorder", rtp_source->zorder,
      NULL
    );
    gst_element_set_state( rtp_source->pipeline, GST_STATE_PLAYING );

    gst_object_unref( sink_pad );
 
  }
}

static int find_channel_by_name( Channel *channel, char *name ) {
  return g_strcmp0( channel->name, name );
}

int mixer_change_position( Mixer *mixer, char *name, int xpos, int ypos, int width, int height ) {
  GList *list;
  Channel *channel;

  list = g_list_find_custom( mixer->videochannels, name, (GCompareFunc)find_channel_by_name );
  if( list ){
    channel = (Channel *)list->data;
    g_object_set( channel->mixer_pad, "xpos", xpos, "ypos", ypos, "width", width, "height", height, NULL );
  }

  return 0;
}

int mixer_release_videosrc( Mixer *mixer, char *name ) {
  GList *list;
  Channel *channel;

  list = g_list_find_custom( mixer->videochannels, name, (GCompareFunc)find_channel_by_name );
  if( list ) {
    channel = (Channel *)list->data;

    // change zorder of comp_pad
    g_object_set( channel->mixer_pad, "zorder", 0, NULL );

    // release bus
    gst_object_unref( channel->bus );
    channel->bus = NULL;

    // release pipeline
    if( GST_IS_PIPELINE( channel->pipeline )) {
      gst_element_set_state( channel->pipeline, GST_STATE_NULL );
      gst_object_unref( channel->pipeline );
    }
    channel->pipeline = NULL;
  }
  return 0;
}

int mixer_release_audiosrc( Mixer *mixer, char *name ) {
  GList *list;
  Channel *channel;

  list = g_list_find_custom( mixer->audiochannels, name, (GCompareFunc)find_channel_by_name );
  if( list ) {
    channel = (Channel *)list->data;

    // set mute of mixer_pad
    g_object_set( channel->mixer_pad, "mute", TRUE, NULL );

    // release bus
    gst_object_unref( channel->bus );
    channel->bus = NULL;

    // release pippeline
    if( GST_IS_PIPELINE( channel->pipeline )) {
      gst_element_set_state( channel->pipeline, GST_STATE_NULL );
      gst_object_unref( channel->pipeline );
    }
    channel->pipeline = NULL;
  }

  return 0;
}

int mixer_release_rtpsrc( Mixer *mixer, char *video_channel_name, char *audio_channel_name ) {
  return 0;
}

int mixer_start( Mixer *mixer ) {
  if( !mixer->mixer_pipeline ) {
    g_printerr( "pipeline does not exist.\n");
    return -1;
  }

  gst_element_set_state( mixer->mixer_pipeline, GST_STATE_PLAYING );
    
  return 0;
}


void mixer_pause( Mixer *mixer ) {
  if( mixer -> mixer_pipeline ) {
    gst_element_set_state( mixer->mixer_pipeline, GST_STATE_PAUSED );
  }
}

void mixer_resume( Mixer *mixer ) {
  if( mixer->mixer_pipeline ) {
    gst_element_set_state( mixer->mixer_pipeline, GST_STATE_PLAYING );
  }
}

static void release_pad( GstPad *pad, GstElement *element ) {
  gst_element_release_request_pad( element, pad );
  gst_object_unref( pad );
}

static void release_rtp_source( RtpSource *rtp_source, void *data ) {
  if( rtp_source->rtpbin_pads ) {
    g_list_foreach( rtp_source->rtpbin_pads, (GFunc)release_pad, rtp_source->rtpbin );
  }
}

static void release_channel( Channel *channel, GstElement *element ) {
  g_free( channel->name );
  if( channel->bus && GST_IS_BUS( channel->bus ) ) {
    gst_object_unref( channel->bus );
  }
  if( channel->mixer_pad && GST_IS_PAD( channel->mixer_pad ) ) {
    gst_element_release_request_pad( element, channel->mixer_pad );
    gst_object_unref( channel->mixer_pad );
  }
  if( channel->pipeline && GST_IS_PIPELINE( channel->pipeline ) ) {
    gst_element_set_state( channel->pipeline, GST_STATE_NULL );
    gst_object_unref( channel->pipeline );
  }
}

void mixer_terminate( Mixer *mixer ) {
  if( mixer->compositor_pad ) {
    gst_element_release_request_pad( mixer->compositor, mixer->compositor_pad );
    gst_object_unref( mixer->compositor_pad );
  }
  if( mixer->audiomixer_pad ) {
    gst_element_release_request_pad( mixer->audiomixer, mixer->audiomixer_pad );
    gst_object_unref( mixer->audiomixer_pad );
  }
  if( mixer->rtp_sources ) {
    g_list_foreach( mixer->rtp_sources, (GFunc)release_rtp_source, NULL );
  }
  if( mixer->videochannels ){
    g_list_foreach( mixer->videochannels, (GFunc)release_channel, mixer->compositor );
  }
  if( mixer->audiochannels ) {
    g_list_foreach( mixer->audiochannels, (GFunc)release_channel, mixer->audiomixer );
  }
  if( mixer->mixer_pipeline ) {
    gst_element_set_state( mixer->mixer_pipeline, GST_STATE_NULL );
    gst_object_unref( mixer->mixer_pipeline );
  }
}