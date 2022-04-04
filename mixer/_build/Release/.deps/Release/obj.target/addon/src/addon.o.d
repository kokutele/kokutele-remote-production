cmd_Release/obj.target/addon/src/addon.o := g++ -o Release/obj.target/addon/src/addon.o ../src/addon.cc '-DNODE_GYP_MODULE_NAME=addon' '-DUSING_UV_SHARED=1' '-DUSING_V8_SHARED=1' '-DV8_DEPRECATION_WARNINGS=1' '-DV8_DEPRECATION_WARNINGS' '-DV8_IMMINENT_DEPRECATION_WARNINGS' '-D_GLIBCXX_USE_CXX11_ABI=1' '-D_LARGEFILE_SOURCE' '-D_FILE_OFFSET_BITS=64' '-D__STDC_FORMAT_MACROS' '-DOPENSSL_NO_PINSHARED' '-DOPENSSL_THREADS' '-DNAPI_DISABLE_CPP_EXCEPTIONS' '-DBUILDING_NODE_EXTENSION' -I/root/.cache/node-gyp/16.14.2/include/node -I/root/.cache/node-gyp/16.14.2/src -I/root/.cache/node-gyp/16.14.2/deps/openssl/config -I/root/.cache/node-gyp/16.14.2/deps/openssl/openssl/include -I/root/.cache/node-gyp/16.14.2/deps/uv/include -I/root/.cache/node-gyp/16.14.2/deps/zlib -I/root/.cache/node-gyp/16.14.2/deps/v8/include -I/work/mixer/node_modules/node-addon-api -I/usr/include/gstreamer-1.0 -I/usr/include/x86_64-linux-gnu -I/usr/include/glib-2.0 -I/usr/lib/x86_64-linux-gnu/glib-2.0/include  -fPIC -pthread -Wall -Wextra -Wno-unused-parameter -m64 -O3 -fno-omit-frame-pointer -fno-rtti -std=gnu++14 -MMD -MF ./Release/.deps/Release/obj.target/addon/src/addon.o.d.raw   -c
Release/obj.target/addon/src/addon.o: ../src/addon.cc \
 /work/mixer/node_modules/node-addon-api/napi.h \
 /root/.cache/node-gyp/16.14.2/include/node/node_api.h \
 /root/.cache/node-gyp/16.14.2/include/node/js_native_api.h \
 /root/.cache/node-gyp/16.14.2/include/node/js_native_api_types.h \
 /root/.cache/node-gyp/16.14.2/include/node/node_api_types.h \
 /work/mixer/node_modules/node-addon-api/napi-inl.h \
 /work/mixer/node_modules/node-addon-api/napi-inl.deprecated.h \
 ../src/media-mixer.h ../src/mixer/mixer.h \
 /usr/include/gstreamer-1.0/gst/gst.h /usr/include/glib-2.0/glib.h \
 /usr/include/glib-2.0/glib/galloca.h /usr/include/glib-2.0/glib/gtypes.h \
 /usr/lib/x86_64-linux-gnu/glib-2.0/include/glibconfig.h \
 /usr/include/glib-2.0/glib/gmacros.h \
 /usr/include/glib-2.0/glib/gversionmacros.h \
 /usr/include/glib-2.0/glib/garray.h \
 /usr/include/glib-2.0/glib/gasyncqueue.h \
 /usr/include/glib-2.0/glib/gthread.h \
 /usr/include/glib-2.0/glib/gatomic.h /usr/include/glib-2.0/glib/gerror.h \
 /usr/include/glib-2.0/glib/gquark.h /usr/include/glib-2.0/glib/gutils.h \
 /usr/include/glib-2.0/glib/gbacktrace.h \
 /usr/include/glib-2.0/glib/gbase64.h \
 /usr/include/glib-2.0/glib/gbitlock.h \
 /usr/include/glib-2.0/glib/gbookmarkfile.h \
 /usr/include/glib-2.0/glib/gdatetime.h \
 /usr/include/glib-2.0/glib/gtimezone.h \
 /usr/include/glib-2.0/glib/gbytes.h \
 /usr/include/glib-2.0/glib/gcharset.h \
 /usr/include/glib-2.0/glib/gchecksum.h \
 /usr/include/glib-2.0/glib/gconvert.h \
 /usr/include/glib-2.0/glib/gdataset.h /usr/include/glib-2.0/glib/gdate.h \
 /usr/include/glib-2.0/glib/gdir.h /usr/include/glib-2.0/glib/genviron.h \
 /usr/include/glib-2.0/glib/gfileutils.h \
 /usr/include/glib-2.0/glib/ggettext.h /usr/include/glib-2.0/glib/ghash.h \
 /usr/include/glib-2.0/glib/glist.h /usr/include/glib-2.0/glib/gmem.h \
 /usr/include/glib-2.0/glib/gnode.h /usr/include/glib-2.0/glib/ghmac.h \
 /usr/include/glib-2.0/glib/gchecksum.h \
 /usr/include/glib-2.0/glib/ghook.h \
 /usr/include/glib-2.0/glib/ghostutils.h \
 /usr/include/glib-2.0/glib/giochannel.h \
 /usr/include/glib-2.0/glib/gmain.h /usr/include/glib-2.0/glib/gpoll.h \
 /usr/include/glib-2.0/glib/gslist.h /usr/include/glib-2.0/glib/gstring.h \
 /usr/include/glib-2.0/glib/gunicode.h \
 /usr/include/glib-2.0/glib/gkeyfile.h \
 /usr/include/glib-2.0/glib/gmappedfile.h \
 /usr/include/glib-2.0/glib/gmarkup.h \
 /usr/include/glib-2.0/glib/gmessages.h \
 /usr/include/glib-2.0/glib/gvariant.h \
 /usr/include/glib-2.0/glib/gvarianttype.h \
 /usr/include/glib-2.0/glib/goption.h \
 /usr/include/glib-2.0/glib/gpattern.h \
 /usr/include/glib-2.0/glib/gprimes.h /usr/include/glib-2.0/glib/gqsort.h \
 /usr/include/glib-2.0/glib/gqueue.h /usr/include/glib-2.0/glib/grand.h \
 /usr/include/glib-2.0/glib/grcbox.h \
 /usr/include/glib-2.0/glib/grefcount.h \
 /usr/include/glib-2.0/glib/grefstring.h \
 /usr/include/glib-2.0/glib/gmem.h /usr/include/glib-2.0/glib/gmacros.h \
 /usr/include/glib-2.0/glib/gregex.h \
 /usr/include/glib-2.0/glib/gscanner.h \
 /usr/include/glib-2.0/glib/gsequence.h \
 /usr/include/glib-2.0/glib/gshell.h /usr/include/glib-2.0/glib/gslice.h \
 /usr/include/glib-2.0/glib/gspawn.h \
 /usr/include/glib-2.0/glib/gstrfuncs.h \
 /usr/include/glib-2.0/glib/gstringchunk.h \
 /usr/include/glib-2.0/glib/gstrvbuilder.h \
 /usr/include/glib-2.0/glib/gtestutils.h \
 /usr/include/glib-2.0/glib/gthreadpool.h \
 /usr/include/glib-2.0/glib/gtimer.h \
 /usr/include/glib-2.0/glib/gtrashstack.h \
 /usr/include/glib-2.0/glib/gtree.h /usr/include/glib-2.0/glib/guri.h \
 /usr/include/glib-2.0/glib/guuid.h /usr/include/glib-2.0/glib/gversion.h \
 /usr/include/glib-2.0/glib/deprecated/gallocator.h \
 /usr/include/glib-2.0/glib/deprecated/gcache.h \
 /usr/include/glib-2.0/glib/deprecated/gcompletion.h \
 /usr/include/glib-2.0/glib/deprecated/gmain.h \
 /usr/include/glib-2.0/glib/deprecated/grel.h \
 /usr/include/glib-2.0/glib/deprecated/gthread.h \
 /usr/include/glib-2.0/glib/glib-autocleanups.h \
 /usr/include/gstreamer-1.0/gst/glib-compat.h \
 /usr/include/gstreamer-1.0/gst/gstenumtypes.h \
 /usr/include/glib-2.0/glib-object.h \
 /usr/include/glib-2.0/gobject/gbinding.h \
 /usr/include/glib-2.0/gobject/gobject.h \
 /usr/include/glib-2.0/gobject/gtype.h \
 /usr/include/glib-2.0/gobject/gvalue.h \
 /usr/include/glib-2.0/gobject/gparam.h \
 /usr/include/glib-2.0/gobject/gclosure.h \
 /usr/include/glib-2.0/gobject/gsignal.h \
 /usr/include/glib-2.0/gobject/gmarshal.h \
 /usr/include/glib-2.0/gobject/gboxed.h \
 /usr/include/glib-2.0/gobject/glib-types.h \
 /usr/include/glib-2.0/gobject/genums.h \
 /usr/include/glib-2.0/gobject/glib-enumtypes.h \
 /usr/include/glib-2.0/gobject/gparamspecs.h \
 /usr/include/glib-2.0/gobject/gsourceclosure.h \
 /usr/include/glib-2.0/gobject/gtypemodule.h \
 /usr/include/glib-2.0/gobject/gtypeplugin.h \
 /usr/include/glib-2.0/gobject/gvaluearray.h \
 /usr/include/glib-2.0/gobject/gvaluetypes.h \
 /usr/include/glib-2.0/gobject/gobject-autocleanups.h \
 /usr/include/gstreamer-1.0/gst/gstconfig.h \
 /usr/include/gstreamer-1.0/gst/gstversion.h \
 /usr/include/gstreamer-1.0/gst/gstatomicqueue.h \
 /usr/include/gstreamer-1.0/gst/gstbin.h \
 /usr/include/gstreamer-1.0/gst/gstelement.h \
 /usr/include/gstreamer-1.0/gst/gstobject.h \
 /usr/include/gstreamer-1.0/gst/gstcontrolbinding.h \
 /usr/include/gstreamer-1.0/gst/gstcontrolsource.h \
 /usr/include/gstreamer-1.0/gst/gstclock.h \
 /usr/include/gstreamer-1.0/gst/gstpad.h \
 /usr/include/gstreamer-1.0/gst/gstbuffer.h \
 /usr/include/gstreamer-1.0/gst/gstminiobject.h \
 /usr/include/gstreamer-1.0/gst/gstallocator.h \
 /usr/include/gstreamer-1.0/gst/gstmemory.h \
 /usr/include/gstreamer-1.0/gst/gstcaps.h \
 /usr/include/gstreamer-1.0/gst/gststructure.h \
 /usr/include/gstreamer-1.0/gst/gstdatetime.h \
 /usr/include/gstreamer-1.0/gst/gstcapsfeatures.h \
 /usr/include/gstreamer-1.0/gst/gstmeta.h \
 /usr/include/gstreamer-1.0/gst/gstbufferlist.h \
 /usr/include/gstreamer-1.0/gst/gstpadtemplate.h \
 /usr/include/gstreamer-1.0/gst/gstevent.h \
 /usr/include/gstreamer-1.0/gst/gstformat.h \
 /usr/include/gstreamer-1.0/gst/gstiterator.h \
 /usr/include/gstreamer-1.0/gst/gsttaglist.h \
 /usr/include/gstreamer-1.0/gst/gstsample.h \
 /usr/include/gstreamer-1.0/gst/gstsegment.h \
 /usr/include/gstreamer-1.0/gst/gstmessage.h \
 /usr/include/gstreamer-1.0/gst/gstquery.h \
 /usr/include/gstreamer-1.0/gst/gsttoc.h \
 /usr/include/gstreamer-1.0/gst/gstcontext.h \
 /usr/include/gstreamer-1.0/gst/gstdevice.h \
 /usr/include/gstreamer-1.0/gst/gststreams.h \
 /usr/include/gstreamer-1.0/gst/gststreamcollection.h \
 /usr/include/gstreamer-1.0/gst/gsttask.h \
 /usr/include/gstreamer-1.0/gst/gsttaskpool.h \
 /usr/include/gstreamer-1.0/gst/gstbus.h \
 /usr/include/gstreamer-1.0/gst/gstelementfactory.h \
 /usr/include/gstreamer-1.0/gst/gstplugin.h \
 /usr/include/gstreamer-1.0/gst/gstmacros.h \
 /usr/include/gstreamer-1.0/gst/gstpluginfeature.h \
 /usr/include/gstreamer-1.0/gst/gsturi.h \
 /usr/include/gstreamer-1.0/gst/gstminiobject.h \
 /usr/include/gstreamer-1.0/gst/gstbufferpool.h \
 /usr/include/gstreamer-1.0/gst/gstchildproxy.h \
 /usr/include/gstreamer-1.0/gst/gstdebugutils.h \
 /usr/include/gstreamer-1.0/gst/gstdevicemonitor.h \
 /usr/include/gstreamer-1.0/gst/gstdeviceprovider.h \
 /usr/include/gstreamer-1.0/gst/gstdeviceproviderfactory.h \
 /usr/include/gstreamer-1.0/gst/gstdynamictypefactory.h \
 /usr/include/gstreamer-1.0/gst/gstelementmetadata.h \
 /usr/include/gstreamer-1.0/gst/gsterror.h \
 /usr/include/gstreamer-1.0/gst/gstghostpad.h \
 /usr/include/gstreamer-1.0/gst/gstinfo.h \
 /usr/include/gstreamer-1.0/gst/gstparamspecs.h \
 /usr/include/gstreamer-1.0/gst/gstvalue.h \
 /usr/include/gstreamer-1.0/gst/gstpipeline.h \
 /usr/include/gstreamer-1.0/gst/gstpoll.h \
 /usr/include/gstreamer-1.0/gst/gstpreset.h \
 /usr/include/gstreamer-1.0/gst/gstprotection.h \
 /usr/include/gstreamer-1.0/gst/gstregistry.h \
 /usr/include/gstreamer-1.0/gst/gstpromise.h \
 /usr/include/gstreamer-1.0/gst/gstsystemclock.h \
 /usr/include/gstreamer-1.0/gst/gsttagsetter.h \
 /usr/include/gstreamer-1.0/gst/gsttocsetter.h \
 /usr/include/gstreamer-1.0/gst/gsttracer.h \
 /usr/include/gstreamer-1.0/gst/gsttracerfactory.h \
 /usr/include/gstreamer-1.0/gst/gsttracerrecord.h \
 /usr/include/gstreamer-1.0/gst/gsttypefind.h \
 /usr/include/gstreamer-1.0/gst/gsttypefindfactory.h \
 /usr/include/gstreamer-1.0/gst/gstutils.h \
 /usr/include/gstreamer-1.0/gst/gstparse.h \
 /usr/include/gstreamer-1.0/gst/gstcompat.h
../src/addon.cc:
/work/mixer/node_modules/node-addon-api/napi.h:
/root/.cache/node-gyp/16.14.2/include/node/node_api.h:
/root/.cache/node-gyp/16.14.2/include/node/js_native_api.h:
/root/.cache/node-gyp/16.14.2/include/node/js_native_api_types.h:
/root/.cache/node-gyp/16.14.2/include/node/node_api_types.h:
/work/mixer/node_modules/node-addon-api/napi-inl.h:
/work/mixer/node_modules/node-addon-api/napi-inl.deprecated.h:
../src/media-mixer.h:
../src/mixer/mixer.h:
/usr/include/gstreamer-1.0/gst/gst.h:
/usr/include/glib-2.0/glib.h:
/usr/include/glib-2.0/glib/galloca.h:
/usr/include/glib-2.0/glib/gtypes.h:
/usr/lib/x86_64-linux-gnu/glib-2.0/include/glibconfig.h:
/usr/include/glib-2.0/glib/gmacros.h:
/usr/include/glib-2.0/glib/gversionmacros.h:
/usr/include/glib-2.0/glib/garray.h:
/usr/include/glib-2.0/glib/gasyncqueue.h:
/usr/include/glib-2.0/glib/gthread.h:
/usr/include/glib-2.0/glib/gatomic.h:
/usr/include/glib-2.0/glib/gerror.h:
/usr/include/glib-2.0/glib/gquark.h:
/usr/include/glib-2.0/glib/gutils.h:
/usr/include/glib-2.0/glib/gbacktrace.h:
/usr/include/glib-2.0/glib/gbase64.h:
/usr/include/glib-2.0/glib/gbitlock.h:
/usr/include/glib-2.0/glib/gbookmarkfile.h:
/usr/include/glib-2.0/glib/gdatetime.h:
/usr/include/glib-2.0/glib/gtimezone.h:
/usr/include/glib-2.0/glib/gbytes.h:
/usr/include/glib-2.0/glib/gcharset.h:
/usr/include/glib-2.0/glib/gchecksum.h:
/usr/include/glib-2.0/glib/gconvert.h:
/usr/include/glib-2.0/glib/gdataset.h:
/usr/include/glib-2.0/glib/gdate.h:
/usr/include/glib-2.0/glib/gdir.h:
/usr/include/glib-2.0/glib/genviron.h:
/usr/include/glib-2.0/glib/gfileutils.h:
/usr/include/glib-2.0/glib/ggettext.h:
/usr/include/glib-2.0/glib/ghash.h:
/usr/include/glib-2.0/glib/glist.h:
/usr/include/glib-2.0/glib/gmem.h:
/usr/include/glib-2.0/glib/gnode.h:
/usr/include/glib-2.0/glib/ghmac.h:
/usr/include/glib-2.0/glib/gchecksum.h:
/usr/include/glib-2.0/glib/ghook.h:
/usr/include/glib-2.0/glib/ghostutils.h:
/usr/include/glib-2.0/glib/giochannel.h:
/usr/include/glib-2.0/glib/gmain.h:
/usr/include/glib-2.0/glib/gpoll.h:
/usr/include/glib-2.0/glib/gslist.h:
/usr/include/glib-2.0/glib/gstring.h:
/usr/include/glib-2.0/glib/gunicode.h:
/usr/include/glib-2.0/glib/gkeyfile.h:
/usr/include/glib-2.0/glib/gmappedfile.h:
/usr/include/glib-2.0/glib/gmarkup.h:
/usr/include/glib-2.0/glib/gmessages.h:
/usr/include/glib-2.0/glib/gvariant.h:
/usr/include/glib-2.0/glib/gvarianttype.h:
/usr/include/glib-2.0/glib/goption.h:
/usr/include/glib-2.0/glib/gpattern.h:
/usr/include/glib-2.0/glib/gprimes.h:
/usr/include/glib-2.0/glib/gqsort.h:
/usr/include/glib-2.0/glib/gqueue.h:
/usr/include/glib-2.0/glib/grand.h:
/usr/include/glib-2.0/glib/grcbox.h:
/usr/include/glib-2.0/glib/grefcount.h:
/usr/include/glib-2.0/glib/grefstring.h:
/usr/include/glib-2.0/glib/gmem.h:
/usr/include/glib-2.0/glib/gmacros.h:
/usr/include/glib-2.0/glib/gregex.h:
/usr/include/glib-2.0/glib/gscanner.h:
/usr/include/glib-2.0/glib/gsequence.h:
/usr/include/glib-2.0/glib/gshell.h:
/usr/include/glib-2.0/glib/gslice.h:
/usr/include/glib-2.0/glib/gspawn.h:
/usr/include/glib-2.0/glib/gstrfuncs.h:
/usr/include/glib-2.0/glib/gstringchunk.h:
/usr/include/glib-2.0/glib/gstrvbuilder.h:
/usr/include/glib-2.0/glib/gtestutils.h:
/usr/include/glib-2.0/glib/gthreadpool.h:
/usr/include/glib-2.0/glib/gtimer.h:
/usr/include/glib-2.0/glib/gtrashstack.h:
/usr/include/glib-2.0/glib/gtree.h:
/usr/include/glib-2.0/glib/guri.h:
/usr/include/glib-2.0/glib/guuid.h:
/usr/include/glib-2.0/glib/gversion.h:
/usr/include/glib-2.0/glib/deprecated/gallocator.h:
/usr/include/glib-2.0/glib/deprecated/gcache.h:
/usr/include/glib-2.0/glib/deprecated/gcompletion.h:
/usr/include/glib-2.0/glib/deprecated/gmain.h:
/usr/include/glib-2.0/glib/deprecated/grel.h:
/usr/include/glib-2.0/glib/deprecated/gthread.h:
/usr/include/glib-2.0/glib/glib-autocleanups.h:
/usr/include/gstreamer-1.0/gst/glib-compat.h:
/usr/include/gstreamer-1.0/gst/gstenumtypes.h:
/usr/include/glib-2.0/glib-object.h:
/usr/include/glib-2.0/gobject/gbinding.h:
/usr/include/glib-2.0/gobject/gobject.h:
/usr/include/glib-2.0/gobject/gtype.h:
/usr/include/glib-2.0/gobject/gvalue.h:
/usr/include/glib-2.0/gobject/gparam.h:
/usr/include/glib-2.0/gobject/gclosure.h:
/usr/include/glib-2.0/gobject/gsignal.h:
/usr/include/glib-2.0/gobject/gmarshal.h:
/usr/include/glib-2.0/gobject/gboxed.h:
/usr/include/glib-2.0/gobject/glib-types.h:
/usr/include/glib-2.0/gobject/genums.h:
/usr/include/glib-2.0/gobject/glib-enumtypes.h:
/usr/include/glib-2.0/gobject/gparamspecs.h:
/usr/include/glib-2.0/gobject/gsourceclosure.h:
/usr/include/glib-2.0/gobject/gtypemodule.h:
/usr/include/glib-2.0/gobject/gtypeplugin.h:
/usr/include/glib-2.0/gobject/gvaluearray.h:
/usr/include/glib-2.0/gobject/gvaluetypes.h:
/usr/include/glib-2.0/gobject/gobject-autocleanups.h:
/usr/include/gstreamer-1.0/gst/gstconfig.h:
/usr/include/gstreamer-1.0/gst/gstversion.h:
/usr/include/gstreamer-1.0/gst/gstatomicqueue.h:
/usr/include/gstreamer-1.0/gst/gstbin.h:
/usr/include/gstreamer-1.0/gst/gstelement.h:
/usr/include/gstreamer-1.0/gst/gstobject.h:
/usr/include/gstreamer-1.0/gst/gstcontrolbinding.h:
/usr/include/gstreamer-1.0/gst/gstcontrolsource.h:
/usr/include/gstreamer-1.0/gst/gstclock.h:
/usr/include/gstreamer-1.0/gst/gstpad.h:
/usr/include/gstreamer-1.0/gst/gstbuffer.h:
/usr/include/gstreamer-1.0/gst/gstminiobject.h:
/usr/include/gstreamer-1.0/gst/gstallocator.h:
/usr/include/gstreamer-1.0/gst/gstmemory.h:
/usr/include/gstreamer-1.0/gst/gstcaps.h:
/usr/include/gstreamer-1.0/gst/gststructure.h:
/usr/include/gstreamer-1.0/gst/gstdatetime.h:
/usr/include/gstreamer-1.0/gst/gstcapsfeatures.h:
/usr/include/gstreamer-1.0/gst/gstmeta.h:
/usr/include/gstreamer-1.0/gst/gstbufferlist.h:
/usr/include/gstreamer-1.0/gst/gstpadtemplate.h:
/usr/include/gstreamer-1.0/gst/gstevent.h:
/usr/include/gstreamer-1.0/gst/gstformat.h:
/usr/include/gstreamer-1.0/gst/gstiterator.h:
/usr/include/gstreamer-1.0/gst/gsttaglist.h:
/usr/include/gstreamer-1.0/gst/gstsample.h:
/usr/include/gstreamer-1.0/gst/gstsegment.h:
/usr/include/gstreamer-1.0/gst/gstmessage.h:
/usr/include/gstreamer-1.0/gst/gstquery.h:
/usr/include/gstreamer-1.0/gst/gsttoc.h:
/usr/include/gstreamer-1.0/gst/gstcontext.h:
/usr/include/gstreamer-1.0/gst/gstdevice.h:
/usr/include/gstreamer-1.0/gst/gststreams.h:
/usr/include/gstreamer-1.0/gst/gststreamcollection.h:
/usr/include/gstreamer-1.0/gst/gsttask.h:
/usr/include/gstreamer-1.0/gst/gsttaskpool.h:
/usr/include/gstreamer-1.0/gst/gstbus.h:
/usr/include/gstreamer-1.0/gst/gstelementfactory.h:
/usr/include/gstreamer-1.0/gst/gstplugin.h:
/usr/include/gstreamer-1.0/gst/gstmacros.h:
/usr/include/gstreamer-1.0/gst/gstpluginfeature.h:
/usr/include/gstreamer-1.0/gst/gsturi.h:
/usr/include/gstreamer-1.0/gst/gstminiobject.h:
/usr/include/gstreamer-1.0/gst/gstbufferpool.h:
/usr/include/gstreamer-1.0/gst/gstchildproxy.h:
/usr/include/gstreamer-1.0/gst/gstdebugutils.h:
/usr/include/gstreamer-1.0/gst/gstdevicemonitor.h:
/usr/include/gstreamer-1.0/gst/gstdeviceprovider.h:
/usr/include/gstreamer-1.0/gst/gstdeviceproviderfactory.h:
/usr/include/gstreamer-1.0/gst/gstdynamictypefactory.h:
/usr/include/gstreamer-1.0/gst/gstelementmetadata.h:
/usr/include/gstreamer-1.0/gst/gsterror.h:
/usr/include/gstreamer-1.0/gst/gstghostpad.h:
/usr/include/gstreamer-1.0/gst/gstinfo.h:
/usr/include/gstreamer-1.0/gst/gstparamspecs.h:
/usr/include/gstreamer-1.0/gst/gstvalue.h:
/usr/include/gstreamer-1.0/gst/gstpipeline.h:
/usr/include/gstreamer-1.0/gst/gstpoll.h:
/usr/include/gstreamer-1.0/gst/gstpreset.h:
/usr/include/gstreamer-1.0/gst/gstprotection.h:
/usr/include/gstreamer-1.0/gst/gstregistry.h:
/usr/include/gstreamer-1.0/gst/gstpromise.h:
/usr/include/gstreamer-1.0/gst/gstsystemclock.h:
/usr/include/gstreamer-1.0/gst/gsttagsetter.h:
/usr/include/gstreamer-1.0/gst/gsttocsetter.h:
/usr/include/gstreamer-1.0/gst/gsttracer.h:
/usr/include/gstreamer-1.0/gst/gsttracerfactory.h:
/usr/include/gstreamer-1.0/gst/gsttracerrecord.h:
/usr/include/gstreamer-1.0/gst/gsttypefind.h:
/usr/include/gstreamer-1.0/gst/gsttypefindfactory.h:
/usr/include/gstreamer-1.0/gst/gstutils.h:
/usr/include/gstreamer-1.0/gst/gstparse.h:
/usr/include/gstreamer-1.0/gst/gstcompat.h:
