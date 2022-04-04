#include <napi.h>

Napi::String Hello( const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::String::New( env, "world" );
}

Napi::Value Add( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();

  if( info.Length() < 2 ) {
    Napi::TypeError::New( env, "Wrong number of arguments" )
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  if( !info[0].IsNumber() || !info[1].IsNumber() ) {
    Napi::TypeError::New( env, "Wrong arguments")
      .ThrowAsJavaScriptException();
    return env.Null();
  }

  double arg0 = info[0].As<Napi::Number>().DoubleValue();
  double arg1 = info[1].As<Napi::Number>().DoubleValue();
  Napi::Number num = Napi::Number::New( env, arg0 + arg1 );

  return num;
}

void RunCallback( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  Napi::Function cb = info[0].As<Napi::Function>();
  cb.Call( env.Global(), { Napi::String::New( env, "hello world") } );
}

Napi::Object CreateObject( const Napi::CallbackInfo &info ) {
  Napi::Env env = info.Env();

  Napi::Object obj = Napi::Object::New( env );
  obj.Set( Napi::String::New( env, "msg"), info[0].ToString() );

  return obj;
}

Napi::String MyFunction( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  return Napi::String::New( env, "hello world" );
}

Napi::Function CreateFunction( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  Napi::Function fn = Napi::Function::New( env, MyFunction );
  return fn;
}

Napi::Object Init( Napi::Env env, Napi::Object exports ) {
  exports.Set( Napi::String::New( env, "hello"), Napi::Function::New(env, Hello ));
  exports.Set( Napi::String::New( env, "add"), Napi::Function::New(env, Add ));
  exports.Set( Napi::String::New( env, "runCallback"), Napi::Function::New(env, RunCallback));
  exports.Set( Napi::String::New( env, "createObject"), Napi::Function::New(env, CreateObject));
  exports.Set( Napi::String::New( env, "createFunction"), Napi::Function::New(env, CreateFunction));

  return exports;
}

NODE_API_MODULE( addon, Init )