#include <napi.h>
#include "media-mixer.h"

Napi::Object InitAll( Napi::Env env, Napi::Object exports ) {
  return MediaMixer::Init( env, exports );
}

NODE_API_MODULE( addon, InitAll )