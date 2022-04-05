#ifndef MIXER_H
#define MIXER_H

#include <gst/gst.h>

typedef struct Channel {
  gchar *name;
  GstElement *pipeline;
  GstPad *mixer_pad;
  GstBus *bus;
} Channel;

typedef struct Mixer {
  GstElement *mixer_pipeline;
  GstElement *rtmp_pipeline;
  GstElement *audiomixer;
  GstElement *compositor;
  GstPad *compositor_pad;
  GstPad *audiomixer_pad;
  gint width;
  gint height;
  gchar *url;
  GList *videochannels;
  GList *audiochannels;
  GList *audiomixer_pads;
  GList *srcaudio_pipelines;
  GList *rtp_sources;
} Mixer;

typedef struct RtpSource {
  guint id;
  GstElement *pipeline;
  GstElement *rtpbin;
  Channel *video_channel;
  Channel *audio_channel;
  gchar *host;
  GList *rtpbin_pads;
  gint xpos;
  gint ypos;
  gint width;
  gint height;
  gint zorder;
} RTpSource;

Mixer *mixer_init( gint width, gint height, gchar *url );
Channel * channel_new();
int mixer_set_compositor( Mixer *mixer );
int mixer_set_audiomixer( Mixer *mixer );
int mixer_set_rtmp( Mixer *mixer );

char* mixer_add_videotestsrc( Mixer *mixer, int pattern, int xpos, int ypos, int width, int height, int zorder );
char* mixer_add_audiotestsrc( Mixer *mixer, double freq );
RtpSource *mixer_add_rtpsrc( 
  Mixer *mixer,
  const char *host,
  int video_send_rtp_port, int video_send_rtcp_port, int video_recv_rtcp_port,
  int audio_send_rtp_port, int audio_send_rtcp_port, int audio_recv_rtcp_port,
  int xpos, int ypos, int width, int height, int zorder
);
int mixer_change_position( Mixer *mixer, char *name, int xpos, int ypos, int width, int height );
int mixer_release_videosrc( Mixer *mixer, char *name );
int mixer_release_audiosrc( Mixer *mixer, char *name );
int mixer_release_rtpsrc( Mixer*mixer, guint id );

int  mixer_start( Mixer *mixer );
void mixer_pause( Mixer *mixer );
void mixer_resume( Mixer *mixer );

void mixer_terminate( Mixer *mixer );


#endif