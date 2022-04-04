{
  "targets": [
    {
      "target_name": "addon",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ "mixer/src/addon.cc", "mixer/src/media-mixer.cc", "mixer/src/mixer/mixer.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!@(pkg-config gstreamer-1.0 --cflags-only-I | sed s/-I//g)"
      ],
      "libraries": [
        "<!@(pkg-config gstreamer-1.0 --libs)"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}