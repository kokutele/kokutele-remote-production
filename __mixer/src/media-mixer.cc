#include <string>

#include "media-mixer.h"

Napi::Object MediaMixer::Init( Napi::Env env, Napi::Object exports ) {
  Napi::Function func =
    DefineClass( 
      env,
      "MediaMixer",
      {
        InstanceMethod( "start", &MediaMixer::Start ),
        InstanceMethod( "addTestVideoSrc", &MediaMixer::AddTestVideoSrc ),
        InstanceMethod( "addTestAudioSrc", &MediaMixer::AddTestAudioSrc ),
        InstanceMethod( "addRtpSrc",       &MediaMixer::AddRtpSrc ),
        InstanceMethod( "changePosition",  &MediaMixer::ChangePosition ),
        InstanceMethod( "releaseVideoSrc", &MediaMixer::ReleaseVideoSrc ),
        InstanceMethod( "releaseAudioSrc", &MediaMixer::ReleaseAudioSrc ),
        InstanceMethod( "releaseRtpSrc",   &MediaMixer::ReleaseRtpSrc ),
        InstanceMethod( "terminate", &MediaMixer::Terminate ),
      }
    );
  
  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent( func );
  env.SetInstanceData( constructor );

  exports.Set( "MediaMixer", func );

  return exports;
}

MediaMixer::MediaMixer( const Napi::CallbackInfo& info )
    : Napi::ObjectWrap<MediaMixer>(info) {

  int width, height;
  std::string url;

  if( info[0].IsNumber() && info[1].IsNumber() ) {
    width = info[0].As<Napi::Number>().Int64Value();
    height = info[1].As<Napi::Number>().Int64Value();
  } else {
    width = 640;
    height = 480;
  }

  if( info[2].IsString() ) {
    url = info[2].As<Napi::String>().Utf8Value();
  } else {
    url = "rtmp://localhost/live/test";
  }

  g_print("'constructor()' - width:%d, height:%d\n", width, height );
  g_print("'constructor()' - url:%s\n", (char *)url.c_str() );

  this->mixer_ = mixer_init( width, height, (char *)url.c_str() );
}

Napi::Value MediaMixer::Start( const Napi::CallbackInfo& info ) {
  mixer_set_rtmp( this->mixer_ );
  mixer_set_compositor( this->mixer_ );
  mixer_set_audiomixer( this->mixer_ );
  mixer_start( this-> mixer_ );

  return Napi::Number::New( info.Env(), 0 );
}

Napi::Value MediaMixer::AddTestVideoSrc( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();

  if( info.Length() < 6 ) {
    Napi::TypeError::New( env, "Wrong number of arguments.")
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
     !info[3].IsNumber() || !info[4].IsNumber() || !info[5].IsNumber() ) {
    Napi::TypeError::New( env, "Wrong arguments.")
      .ThrowAsJavaScriptException();
    return env.Null();
  }
  int pattern = info[0].As<Napi::Number>().Int64Value();
  int xpos    = info[1].As<Napi::Number>().Int64Value();
  int ypos    = info[2].As<Napi::Number>().Int64Value();
  int width   = info[3].As<Napi::Number>().Int64Value();
  int height  = info[4].As<Napi::Number>().Int64Value();
  int zorder  = info[5].As<Napi::Number>().Int64Value();

  gchar *name = mixer_add_videotestsrc( this->mixer_, pattern, xpos, ypos, width, height, zorder );

  return Napi::String::New( info.Env(), name );
}

Napi::Value MediaMixer::AddTestAudioSrc( const Napi::CallbackInfo &info ) {
  Napi::Env env = info.Env();
  if( info.Length() < 1 ) {
    Napi::TypeError::New( env, "Wrong number of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsNumber() ) {
    Napi::TypeError::New( env, "Wrong arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  double freq = info[0].As<Napi::Number>().DoubleValue();

  gchar *name = mixer_add_audiotestsrc( this->mixer_, freq );

  return Napi::String::New( env, name );
}

Napi::Value MediaMixer::AddRtpSrc( const Napi::CallbackInfo &info ) {
  Napi::Env env = info.Env();

  if( info.Length() < 9 ) {
    Napi::TypeError::New( env, "Wrong number of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber() || !info[3].IsNumber() ||
      !info[4].IsNumber() || !info[5].IsNumber() || !info[6].IsNumber() || !info[7].IsNumber() || 
      !info[8].IsNumber() || !info[9].IsNumber() || !info[10].IsNumber() || !info[11].IsNumber() ){
    Napi::TypeError::New( env, "Wrong type of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  } 

  std::string host         = info[0].As<Napi::String>().Utf8Value();
  int video_send_rtp_port  = info[1].As<Napi::Number>().Int64Value();
  int video_send_rtcp_port = info[2].As<Napi::Number>().Int64Value();
  int video_recv_rtcp_port = info[3].As<Napi::Number>().Int64Value();
  int audio_send_rtp_port  = info[4].As<Napi::Number>().Int64Value();
  int audio_send_rtcp_port = info[5].As<Napi::Number>().Int64Value();
  int audio_recv_rtcp_port = info[6].As<Napi::Number>().Int64Value();
  int xpos                 = info[7].As<Napi::Number>().Int64Value();
  int ypos                 = info[8].As<Napi::Number>().Int64Value();
  int width                = info[9].As<Napi::Number>().Int64Value();
  int height               = info[10].As<Napi::Number>().Int64Value();
  int zorder               = info[11].As<Napi::Number>().Int64Value();

  RtpSource *rtp_source = mixer_add_rtpsrc( 
    this->mixer_, host.c_str(),
    video_send_rtp_port, video_send_rtcp_port, video_recv_rtcp_port,
    audio_send_rtp_port, audio_send_rtcp_port, audio_recv_rtcp_port,
    xpos, ypos, width, height, zorder
  );

  if( rtp_source ) {
    Napi::Object obj = Napi::Object::New( env );
    obj.Set( Napi::String::New( env, "id"),            Napi::Number::New( env, rtp_source->id ));
    obj.Set( Napi::String::New( env, "video_channel_name"), Napi::String::New( env, rtp_source->video_channel->name ));
    obj.Set( Napi::String::New( env, "audio_channel_name"), Napi::String::New( env, rtp_source->audio_channel->name ));

    return obj;
  } else {
    return env.Null();
  }
}

Napi::Value MediaMixer::ChangePosition( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  if( info.Length() < 5 ) {
    Napi::TypeError::New( env, "Wrong number of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber() || !info[3].IsNumber() || !info[4].IsNumber() ) {
    Napi::TypeError::New( env, "Wrong arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string name = info[0].As<Napi::String>().Utf8Value();
  int xpos   = info[1].As<Napi::Number>().Int64Value();
  int ypos   = info[2].As<Napi::Number>().Int64Value();
  int width  = info[3].As<Napi::Number>().Int64Value();
  int height = info[4].As<Napi::Number>().Int64Value();

  mixer_change_position( this->mixer_, (char *)name.c_str(), xpos, ypos, width, height );

  return Napi::Number::New( env, 0 );
}

Napi::Value MediaMixer::ReleaseVideoSrc( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  if( info.Length() < 1 ) {
    Napi::TypeError::New( env, "Wrong number of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsString() ) {
    Napi::TypeError::New( env, "Wrong arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string name = info[0].As<Napi::String>().Utf8Value();

  mixer_release_videosrc( this->mixer_, (char *)name.c_str() );

  return Napi::Number::New( env, 0 );
}

Napi::Value MediaMixer::ReleaseAudioSrc( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  if( info.Length() < 1 ) {
    Napi::TypeError::New( env, "Wrong number of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  } 

  if( !info[0].IsString() ) {
    Napi::TypeError::New( env, "Wrong arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string name = info[0].As<Napi::String>().Utf8Value();

  mixer_release_audiosrc( this->mixer_, (char *)name.c_str() );

  return Napi::Number::New( env, 0 );
}

Napi::Value MediaMixer::ReleaseRtpSrc( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();

  if( info.Length() < 1 ) {
    Napi::TypeError::New( env, "Wrong number of arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsNumber() ) {
    Napi::TypeError::New( env, "Wrong arguments." )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  guint id = info[0].As<Napi::Number>().Int64Value();

  mixer_release_rtpsrc( this->mixer_, id );

  return Napi::Number::New( env, 0 );
}

Napi::Value MediaMixer::Terminate( const Napi::CallbackInfo& info ) {
  mixer_terminate( this->mixer_ );

  return Napi::Number::New( info.Env(), 0 );
}