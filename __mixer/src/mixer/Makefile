CXX=gcc
MY_LIBS=gstreamer-1.0
CPPFLAGS = $(shell pkg-config --cflags ${MY_LIBS})
LDLIBS = $(shell pkg-config --libs ${MY_LIBS})

main: main.cc mixer.cc