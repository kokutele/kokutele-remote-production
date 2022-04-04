#ifndef MEDIA_MIXER_H
#define MEDIA_MIXER_H

#include <napi.h>
#include "mixer/mixer.h"

class MediaMixer : public Napi::ObjectWrap<MediaMixer> {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports );
    MediaMixer( const Napi::CallbackInfo& info );

  private:
    Napi::Value Start( const Napi::CallbackInfo& info );
    Napi::Value AddTestAudioSrc( const Napi::CallbackInfo& info );
    Napi::Value AddTestVideoSrc( const Napi::CallbackInfo& info );
    Napi::Value AddRtpSrc( const Napi::CallbackInfo& info );
    Napi::Value ChangePosition( const Napi::CallbackInfo& info );
    Napi::Value ReleaseVideoSrc( const Napi::CallbackInfo& info );
    Napi::Value ReleaseAudioSrc( const Napi::CallbackInfo& info );
    Napi::Value Terminate( const Napi::CallbackInfo& info );

    Mixer *mixer_;
};

#endif