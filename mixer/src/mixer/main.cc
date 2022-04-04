#include <stdio.h>
#include "mixer.h"

GMainLoop *loop;
gint zorder = 2;

static gboolean handle_keyboard( GIOChannel *source, GIOCondition cond, Mixer *mixer ) {
  gchar *str = NULL, *name;
  int xpos, ypos, pattern;
  double freq;

  if( g_io_channel_read_line( source, &str, NULL, NULL, NULL) != G_IO_STATUS_NORMAL ) {
    return TRUE;
  }

  switch( g_ascii_tolower( str[0] )) {
    case 'a':
      freq = g_random_double_range( 200, 800 );
      g_print("freq = %f.\n", freq);

      name = mixer_add_audiotestsrc( mixer, freq );
      if( name == NULL ) {
        g_printerr("audiotestsrc could not be added.\n");
      } else {
        g_print( "added audiotestsrc. name=%s.\n", name);
      }
      break;
    case 'v':
      pattern = g_random_int() % 25;
      xpos = g_random_int() % 320;
      ypos = g_random_int() % 240;

      name = mixer_add_videotestsrc( mixer, pattern, xpos, ypos, 320, 240, zorder++ );
      if( name == NULL ) {
        g_printerr("videotestsrc could not be added.\n");
      } else {
        g_print("added videtestsrc. name=%s, pattern=%u.\n", name, pattern );
      }
      break;
    case 'm':
      xpos = g_random_int() % 320;
      ypos = g_random_int() % 240;
      mixer_change_position( mixer, (char *)"vchannel_0", xpos, ypos, 320, 240 );
      break;
    case 'q':
      g_main_loop_quit( loop );
      break;
    default:
      break;
  }

  g_free( str );

  return TRUE;
}

static void usage() {
  g_print("USAGE: Choose one of the following options, then press enter:\n"
    " 'A' to Add audio\n"
    " 'V' to Add overlay video\n"
    " 'M' to Move overlay video\n"
    " 'Q' to Quit\n"
  );
}

int main( int argc, char **argv ) {
  GstBus *bus;
  GstMessage *msg;
  GIOChannel *io_stdin;
  Mixer *mixer;
  char *name;

  mixer = mixer_init();
  if( mixer == NULL ) {
    g_printerr("mixer could not be initialized.");
    return -1;
  }

  if( mixer_set_compositor( mixer ) < 0 ||
      mixer_set_audiomixer( mixer ) < 0
   ) {
    g_printerr("compositor or audiomixer could not be created.\n");
    mixer_terminate( mixer );
    return -1;
  }
  g_print("compositor could be created.\n");



  usage();

  if( mixer_start( mixer ) < 0 ) {
    mixer_terminate( mixer );
    return -1;
  }

  io_stdin = g_io_channel_unix_new( fileno(stdin) );
  g_io_add_watch( io_stdin, G_IO_IN, (GIOFunc)handle_keyboard, mixer );
  
  loop = g_main_loop_new( NULL, FALSE );
  g_main_loop_run( loop );
  g_print("terminating...\n");

  mixer_terminate( mixer );


  return 0;
}